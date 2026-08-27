import { supabase } from './supabase';
import type {
  StudySet,
  StudyQuestion,
  StudyProgress,
  StudySession,
  StudySubject,
  ProgressDifficulty,
  ProgressStatus,
} from './types';

export const STUDY_SUBJECTS: { value: StudySubject; labelVi: string; labelEn: string; icon: string; color: string }[] = [
  { value: 'math', labelVi: 'Toán học', labelEn: 'Mathematics', icon: '📐', color: 'blue' },
  { value: 'physics', labelVi: 'Vật lý', labelEn: 'Physics', icon: '⚡', color: 'amber' },
  { value: 'chemistry', labelVi: 'Hóa học', labelEn: 'Chemistry', icon: '🧪', color: 'purple' },
  { value: 'biology', labelVi: 'Sinh học', labelEn: 'Biology', icon: '🧬', color: 'emerald' },
  { value: 'english', labelVi: 'Tiếng Anh', labelEn: 'English', icon: '🇬🇧', color: 'rose' },
  { value: 'literature', labelVi: 'Ngữ văn', labelEn: 'Literature', icon: '📖', color: 'indigo' },
  { value: 'history', labelVi: 'Lịch sử', labelEn: 'History', icon: '🏛️', color: 'orange' },
  { value: 'geography', labelVi: 'Địa lý', labelEn: 'Geography', icon: '🌍', color: 'teal' },
  { value: 'it', labelVi: 'Tin học', labelEn: 'Computer Science', icon: '💻', color: 'cyan' },
  { value: 'other', labelVi: 'Môn khác', labelEn: 'Other', icon: '📚', color: 'gray' },
];

export function getSubjectMeta(subject: string) {
  return STUDY_SUBJECTS.find((s) => s.value === subject) || {
    value: 'other' as StudySubject,
    labelVi: 'Tổng hợp',
    labelEn: 'General',
    icon: '📚',
    color: 'gray',
  };
}

/**
 * Intelligent comparison for Fill in the Blank answers
 * - Normalizes whitespaces
 * - Case-insensitive for normal words / concepts / names
 * - Handles mathematical expressions with standard equivalence
 */
export function smartAnswerCompare(userInput: string, expectedAnswer: string): boolean {
  if (!userInput || !expectedAnswer) return false;

  const cleanUser = userInput.trim().replace(/\s+/g, ' ');
  const cleanExpected = expectedAnswer.trim().replace(/\s+/g, ' ');

  // Exact match
  if (cleanUser === cleanExpected) return true;

  // Case-insensitive match
  if (cleanUser.toLowerCase() === cleanExpected.toLowerCase()) return true;

  // Normalize LaTeX / Math symbols: remove spaces around operators
  const normalizeMath = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s*([=+\-*/^_{}()[\],])\s*/g, '$1')
      .replace(/\\text\{([^}]*)\}/g, '$1')
      .replace(/\\left|\\right/g, '')
      .trim();

  if (normalizeMath(cleanUser) === normalizeMath(cleanExpected)) return true;

  // Number comparison: e.g. "3.0" vs "3" or "3 cm" vs "3cm"
  const cleanUnits = (s: string) => s.toLowerCase().replace(/\s*(cm|m|mm|km|kg|g|s|h|n|j|w|v|a|mol|rad)\b/g, '$1').trim();
  if (cleanUnits(cleanUser) === cleanUnits(cleanExpected)) return true;

  return false;
}

/**
 * Spaced Repetition interval calculation
 * - Easy: +7 days
 * - Medium: +3 days
 * - Hard: +0 days (now)
 */
export function calculateNextReview(difficulty: ProgressDifficulty): string {
  const date = new Date();
  if (difficulty === 'easy') {
    date.setDate(date.getDate() + 7);
  } else if (difficulty === 'medium') {
    date.setDate(date.getDate() + 3);
  } else {
    // hard -> review today / immediate
    date.setMinutes(date.getMinutes() + 10);
  }
  return date.toISOString();
}

// ----------------------------------------------------
// Supabase Data Operations
// ----------------------------------------------------

export async function fetchStudySets(userId?: string | null): Promise<StudySet[]> {
  let query = supabase
    .from('study_sets')
    .select(`
      *,
      study_questions (count)
    `);

  if (userId) {
    query = query.or(`user_id.eq.${userId},is_system.eq.true`);
  } else {
    query = query.eq('is_system', true);
  }

  const { data: sets, error } = await query
    .order('is_system', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase fetchStudySets error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return [];
  }

  return (sets || []).map((s) => {
    const qCount = Array.isArray(s.study_questions) ? s.study_questions[0]?.count ?? 0 : 0;

    return {
      id: s.id,
      user_id: s.user_id,
      title: s.title,
      subject: s.subject,
      topic: s.topic,
      description: s.description,
      default_type: s.default_type || 'flashcard',
      is_system: s.is_system ?? false,
      created_at: s.created_at,
      updated_at: s.updated_at,
      questions_count: qCount,
      mastered_count: 0,
    };
  });
}

export async function fetchStudySetById(setId: string): Promise<StudySet | null> {
  const { data, error } = await supabase
    .from('study_sets')
    .select('*')
    .eq('id', setId)
    .maybeSingle();

  if (error) {
    console.error('Supabase fetchStudySetById error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }
  return data as StudySet;
}

export async function createStudySet(set: {
  user_id: string;
  title: string;
  subject: string;
  topic?: string | null;
  description?: string | null;
  default_type?: string | null;
}): Promise<StudySet> {
  const { data, error } = await supabase
    .from('study_sets')
    .insert([{ ...set, is_system: false }])
    .select()
    .single();

  if (error) {
    console.error('Supabase createStudySet error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(error.message || `Lỗi Supabase ${error.code || ''}: ${error.details || ''}`);
  }

  return {
    ...data,
    questions_count: 0,
    mastered_count: 0,
    is_system: false,
  } as StudySet;
}

export async function updateStudySet(
  setId: string,
  updates: Partial<Pick<StudySet, 'title' | 'subject' | 'topic' | 'description' | 'default_type'>>
): Promise<boolean> {
  const { error } = await supabase
    .from('study_sets')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', setId);

  if (error) {
    console.error('Supabase updateStudySet error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(error.message || 'Lỗi khi cập nhật bộ học');
  }
  return true;
}

export async function deleteStudySet(setId: string): Promise<boolean> {
  const { error } = await supabase.from('study_sets').delete().eq('id', setId);
  if (error) {
    console.error('Supabase deleteStudySet error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(error.message || 'Lỗi khi xóa bộ học');
  }
  return true;
}

export async function fetchStudyQuestions(setId: string): Promise<StudyQuestion[]> {
  const { data, error } = await supabase
    .from('study_questions')
    .select('*')
    .eq('set_id', setId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching study questions:', error);
    return [];
  }
  return (data || []) as StudyQuestion[];
}

export async function createStudyQuestion(question: Omit<StudyQuestion, 'id' | 'created_at' | 'updated_at'>): Promise<StudyQuestion> {
  const { data, error } = await supabase
    .from('study_questions')
    .insert([question])
    .select()
    .single();

  if (error) {
    console.error('Supabase createStudyQuestion error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(error.message || 'Lỗi khi tạo câu hỏi');
  }
  return data as StudyQuestion;
}

export async function createStudyQuestionsBatch(
  questions: Omit<StudyQuestion, 'id' | 'created_at' | 'updated_at'>[]
): Promise<StudyQuestion[]> {
  if (questions.length === 0) return [];
  const { data, error } = await supabase
    .from('study_questions')
    .insert(questions)
    .select();

  if (error) {
    console.error('Supabase createStudyQuestionsBatch error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(error.message || 'Lỗi khi lưu danh sách câu hỏi');
  }
  return (data || []) as StudyQuestion[];
}

export async function updateStudyQuestion(
  questionId: string,
  updates: Partial<Omit<StudyQuestion, 'id' | 'set_id' | 'created_at' | 'updated_at'>>
): Promise<boolean> {
  const { error } = await supabase
    .from('study_questions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', questionId);

  if (error) {
    console.error('Supabase updateStudyQuestion error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(error.message || 'Lỗi khi cập nhật câu hỏi');
  }
  return true;
}

export async function deleteStudyQuestion(questionId: string): Promise<boolean> {
  const { error } = await supabase.from('study_questions').delete().eq('id', questionId);
  if (error) {
    console.error('Supabase deleteStudyQuestion error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(error.message || 'Lỗi khi xóa câu hỏi');
  }
  return true;
}

export async function fetchStudyProgressMap(userId: string, questionIds: string[]): Promise<Map<string, StudyProgress>> {
  if (questionIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('study_progress')
    .select('*')
    .eq('user_id', userId)
    .in('question_id', questionIds);

  if (error) {
    console.error('Error fetching study progress:', error);
    return new Map();
  }

  const map = new Map<string, StudyProgress>();
  (data || []).forEach((p) => map.set(p.question_id, p as StudyProgress));
  return map;
}

export async function recordQuestionProgress(
  userId: string,
  questionId: string,
  difficulty: ProgressDifficulty | null,
  isCorrect: boolean
): Promise<void> {
  const nextReviewAt = difficulty ? calculateNextReview(difficulty) : new Date().toISOString();

  // Get current progress
  const { data: existing } = await supabase
    .from('study_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .maybeSingle();

  const correctCount = (existing?.correct_count ?? 0) + (isCorrect ? 1 : 0);
  const incorrectCount = (existing?.incorrect_count ?? 0) + (!isCorrect ? 1 : 0);

  let status: ProgressStatus = 'learning';
  if (correctCount >= 3 && difficulty === 'easy') {
    status = 'mastered';
  } else if (correctCount >= 1) {
    status = 'reviewing';
  }

  const payload = {
    user_id: userId,
    question_id: questionId,
    status,
    difficulty,
    next_review_at: nextReviewAt,
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    last_reviewed_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase.from('study_progress').update(payload).eq('id', existing.id);
  } else {
    await supabase.from('study_progress').insert([payload]);
  }
}

export async function saveStudySession(session: Omit<StudySession, 'id' | 'created_at'>): Promise<StudySession | null> {
  const { data, error } = await supabase
    .from('study_sessions')
    .insert([session])
    .select()
    .single();

  if (error) {
    console.error('Error saving study session:', error);
    return null;
  }
  return data as StudySession;
}
