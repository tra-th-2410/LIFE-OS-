import { supabase } from '@/lib/supabase';
import type { StudyWeaknessTopic, ExamAnswerRecord, StudyQuestion } from '@/lib/types';

export interface WeaknessRecommendation {
  topic: string;
  subject: string;
  masteryScore: number;
  message: string;
  actionCards: { type: 'flashcard' | 'basic_quiz' | 'advanced_quiz'; count: number; title: string }[];
  calendarProposal?: {
    title: string;
    durationMinutes: number;
    sessionsCount: number;
  };
}

/**
 * Record and update user weakness map from quiz / exam answers
 */
export async function recordQuizResultsToWeaknessMap(
  userId: string,
  subject: string,
  questions: StudyQuestion[],
  answers: Record<string, string>
): Promise<StudyWeaknessTopic[]> {
  try {
    // Group questions and correctness by topic
    const topicStats: Record<string, { total: number; correct: number }> = {};

    questions.forEach((q) => {
      const topic = (q as any).topic || (q.metadata as any)?.topic || 'Kiến thức trọng tâm';
      if (!topicStats[topic]) {
        topicStats[topic] = { total: 0, correct: 0 };
      }
      topicStats[topic].total += 1;

      const userAns = (answers[q.id] || '').trim().toLowerCase();
      const correctAns = (q.correct_option || q.answer || '').trim().toLowerCase();
      if (userAns && userAns === correctAns) {
        topicStats[topic].correct += 1;
      }
    });

    const updatedTopics: StudyWeaknessTopic[] = [];

    // Update each topic in database
    for (const [topicName, stats] of Object.entries(topicStats)) {
      // Fetch existing topic stats
      const { data: existing } = await supabase
        .from('study_weakness_topics')
        .select('*')
        .eq('user_id', userId)
        .eq('subject', subject)
        .eq('topic', topicName)
        .maybeSingle();

      const prevTotal = existing?.total_questions || 0;
      const prevCorrect = existing?.correct_questions || 0;

      const newTotal = prevTotal + stats.total;
      const newCorrect = prevCorrect + stats.correct;
      const masteryScore = newTotal > 0 ? Math.round((newCorrect / newTotal) * 100) : 0;

      const { data: upserted } = await supabase
        .from('study_weakness_topics')
        .upsert(
          {
            user_id: userId,
            subject,
            topic: topicName,
            total_questions: newTotal,
            correct_questions: newCorrect,
            mastery_score: masteryScore,
            last_assessed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,subject,topic' }
        )
        .select()
        .single();

      if (upserted) {
        updatedTopics.push(upserted as StudyWeaknessTopic);
      }
    }

    return updatedTopics;
  } catch (err) {
    console.error('Error updating weakness map:', err);
    return [];
  }
}

/**
 * Fetch all weakness map topics for a user
 */
export async function getWeaknessMapForUser(
  userId: string,
  subject?: string
): Promise<StudyWeaknessTopic[]> {
  let query = supabase
    .from('study_weakness_topics')
    .select('*')
    .eq('user_id', userId)
    .order('mastery_score', { ascending: true }); // lowest score (weakest) first

  if (subject) {
    query = query.eq('subject', subject);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching weakness map:', error);
    return [];
  }

  return (data as StudyWeaknessTopic[]) ?? [];
}

/**
 * AI Weakness Recommendation Generator
 */
export function generateWeaknessRecommendations(
  topics: StudyWeaknessTopic[]
): WeaknessRecommendation[] {
  const weakTopics = topics.filter((t) => t.mastery_score < 70);

  return weakTopics.map((t) => {
    const isCritical = t.mastery_score < 50;

    return {
      topic: t.topic,
      subject: t.subject,
      masteryScore: t.mastery_score,
      message: isCritical
        ? `Chủ đề "${t.topic}" hiện đạt ${t.mastery_score}%. Cần củng cố gấp lý thuyết và làm bài tập cơ bản.`
        : `Chủ đề "${t.topic}" đạt ${t.mastery_score}%. Hãy luyện thêm các dạng bài nâng cao để đạt điểm 9+.`,
      actionCards: [
        { type: 'flashcard', count: 5, title: `5 Flashcards cốt lõi ${t.topic}` },
        { type: 'basic_quiz', count: 10, title: `10 câu trắc nghiệm căn bản` },
        { type: 'advanced_quiz', count: 5, title: `5 bài tập nâng cao vận dụng` },
      ],
      calendarProposal: {
        title: `Ôn tập trọng điểm: ${t.subject} - ${t.topic}`,
        durationMinutes: 45,
        sessionsCount: isCritical ? 3 : 2,
      },
    };
  });
}
