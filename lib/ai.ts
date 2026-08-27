import type { BotType } from './types';

export interface BotConfig {
  type: BotType;
  name: string;
  description: string;
  flow: string;
  icon: string;
  color: string;
  systemPrompt: string;
  greeting: string;
  suggestions: string[];
}

const MULTILINGUAL_PROMPT = 'You understand Vietnamese, English, and mixed Vietnamese-English naturally. Respond in the language the user is using unless they explicitly request another language. Vietnamese is fully supported; never ask the user to translate. When explaining technical terms in Vietnamese, include the English term in parentheses when useful.';

export const AI_BOTS: Record<BotType, BotConfig> = {
  learning: {
    type: 'learning',
    name: 'Learning AI',
    description: 'Your personal learning tutor for understanding concepts and practicing with confidence.',
    flow: 'Learn • Understand • Practice',
    icon: '🎓',
    color: 'blue',
    systemPrompt: `${MULTILINGUAL_PROMPT} You are Learning AI, a patient and encouraging tutor. Help with school subjects, homework, research, summaries, flashcards, quizzes, study plans, and step-by-step problem solving. For academic explanations, give the definition, formulas, variables, units, relationships, examples, worked steps, and a key takeaway when relevant.`,
    greeting: 'I’m your personal learning tutor. I can explain concepts, solve problems step by step, make practice questions, and plan your study sessions.',
    suggestions: [
      "Explain Newton's Second Law.",
      'Help me solve this physics problem.',
      'Quiz me on World War II.',
      'Explain this lesson in simple terms.',
    ],
  },
  writing: {
    type: 'writing',
    name: 'Writing AI',
    description: 'Your personal writing coach for academic work, IELTS, and everyday communication.',
    flow: 'Write • Improve • Communicate',
    icon: '✍️',
    color: 'green',
    systemPrompt: `${MULTILINGUAL_PROMPT} You are Writing AI, a precise and constructive writing coach. Help with essays, reports, presentations, IELTS writing and speaking, grammar, vocabulary, paraphrasing, emails, applications, speeches, and editing. Do not only rewrite student work: show important corrections, explain the reason, and offer a way to improve.`,
    greeting: 'I’m your personal writing coach. Share a draft, prompt, or speaking goal and I’ll help you write more clearly and confidently.',
    suggestions: [
      'Check my IELTS Writing Task 2.',
      'Fix the grammar in this paragraph.',
      'Make this essay more academic.',
      'Help me practice IELTS Speaking.',
    ],
  },
  project: {
    type: 'project',
    name: 'Project AI',
    description: 'Your personal project mentor for turning ideas into plans, prototypes, and presentations.',
    flow: 'Create • Build • Present',
    icon: '🚀',
    color: 'amber',
    systemPrompt: `${MULTILINGUAL_PROMPT} You are Project AI, a creative and practical project mentor. Help students develop STEM, science, research, school, competition, club, group, prototype, and product projects. Turn vague ideas into objectives, requirements, materials, tasks, timelines, budgets, responsibilities, risks, experiments, presentations, and judge questions. Actively identify weak points and feasibility risks.`,
    greeting: 'I’m your project mentor. Bring me a rough idea and I’ll help you plan, build, test, improve, and present it.',
    suggestions: [
      'Help me create a STEM project.',
      'Improve my science project idea.',
      'Make a project timeline.',
      'Give me questions a judge might ask.',
    ],
  },
  career: {
    type: 'career',
    name: 'Career AI',
    description: 'Explore education and career paths, compare majors, and prepare for your next step.',
    flow: 'Discover • Explore • Plan',
    icon: '🌐',
    color: 'teal',
    systemPrompt: `${MULTILINGUAL_PROMPT} You are Career AI, a thoughtful and realistic career mentor. Help users explore interests, strengths, skills, majors, education paths, careers, portfolios, competitions, preparation roadmaps, and interview practice. Do not claim to scientifically identify a perfect career from a short conversation. Explain reasoning, alternatives, tradeoffs, and uncertainty. Ask one interview question at a time when practicing.`,
    greeting: 'I’m here to help you explore possibilities, compare majors, build a realistic roadmap, and prepare for interviews without making absolute predictions.',
    suggestions: [
      'Which university major might fit my interests?',
      'Compare Computer Science and Data Science.',
      'Help me plan my university preparation.',
      'Practice a scholarship interview with me.',
    ],
  },
};

export async function generateAiResponse(
  botType: BotType,
  messages: { role: string; content: string }[],
  accessToken?: string
): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl) {
    throw new Error('Supabase URL is not configured');
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (supabaseAnonKey) {
    headers['apikey'] = supabaseAnonKey;
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  } else if (supabaseAnonKey) {
    headers['Authorization'] = `Bearer ${supabaseAnonKey}`;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ botType, messages }),
  });

  const rawText = await response.text();
  console.log('[AI Pipeline] 1. RAW EDGE FUNCTION HTTP Status:', response.status);
  console.log('[AI Pipeline] 1. RAW EDGE FUNCTION Body:', rawText);

  if (!response.ok) {
    let errorMsg = `Request failed (${response.status})`;
    try {
      const errorData = JSON.parse(rawText);
      errorMsg = errorData.error || errorData.message || errorMsg;
    } catch {
      // ignore parse error
    }
    throw new Error(errorMsg);
  }

  let data: Record<string, unknown> | string = {};
  try {
    data = JSON.parse(rawText);
  } catch (parseErr) {
    console.error('[AI Pipeline] JSON parse error:', parseErr);
    data = rawText;
  }
  console.log('[AI Pipeline] 2. Parsed JSON:', data);

  let content = '';

  if (typeof data === 'string') {
    content = data;
  } else if (typeof (data as Record<string, unknown>)?.content === 'string') {
    content = (data as Record<string, unknown>).content as string;
  } else if (Array.isArray((data as Record<string, unknown>)?.content)) {
    content = ((data as Record<string, unknown>).content as unknown[])
      .map((p: unknown) => {
        if (typeof p === 'string') return p;
        if (p && typeof p === 'object' && 'text' in p && typeof (p as { text: unknown }).text === 'string') {
          return (p as { text: string }).text;
        }
        return '';
      })
      .join('');
  } else if (typeof (data as Record<string, unknown>)?.message === 'string') {
    content = (data as Record<string, unknown>).message as string;
  } else if (typeof (data as Record<string, unknown>)?.text === 'string') {
    content = (data as Record<string, unknown>).text as string;
  }

  content = content.trim();
  console.log('[AI Pipeline] 3. generateAiResponse() return value:', content);

  if (!content || content === 'undefined' || content === 'null') {
    throw new Error('AI service returned an empty or invalid response');
  }

  return content;
}

export interface MoodAnalysisResult {
  avgMood: number;
  positiveDaysCount: number;
  neutralDaysCount: number;
  difficultDaysCount: number;
  trend: 'improving' | 'stable' | 'declining' | 'mixed';
  summaryText: string;
  encouragement: string;
  habitSuggestions: string[];
}

export async function generateWeeklyMoodAnalysis(
  entries: { mood: number; note: string | null; tags: string[]; created_at: string }[],
  userHabits: { name: string; icon: string; category?: string }[],
  language: 'en' | 'vi' = 'vi',
  accessToken?: string
): Promise<MoodAnalysisResult> {
  if (entries.length === 0) {
    return {
      avgMood: 3,
      positiveDaysCount: 0,
      neutralDaysCount: 0,
      difficultDaysCount: 0,
      trend: 'stable',
      summaryText: language === 'vi' 
        ? 'Chưa có đủ dữ liệu tâm trạng trong 7 ngày qua để tạo nhận xét chi tiết. Hãy tiếp tục ghi lại cảm xúc mỗi ngày nhé!'
        : 'Not enough mood records in the past 7 days to generate a detailed summary. Keep checking in daily!',
      encouragement: language === 'vi'
        ? 'Mỗi ngày là một khởi đầu mới. Chúc bạn có những ngày học tập và trải nghiệm thật trọn vẹn!'
        : 'Every day is a fresh start. Wishing you fruitful study and positive experiences ahead!',
      habitSuggestions: userHabits.slice(0, 2).map((h) => `${h.icon} ${h.name}`),
    };
  }

  const moodValues = entries.map((e) => e.mood);
  const avgMood = Number((moodValues.reduce((a, b) => a + b, 0) / moodValues.length).toFixed(2));
  const positiveDaysCount = entries.filter((e) => e.mood >= 4).length;
  const neutralDaysCount = entries.filter((e) => e.mood === 3).length;
  const difficultDaysCount = entries.filter((e) => e.mood <= 2).length;

  // Trend detection
  let trend: 'improving' | 'stable' | 'declining' | 'mixed' = 'stable';
  if (entries.length >= 3) {
    const firstHalf = entries.slice(Math.floor(entries.length / 2));
    const secondHalf = entries.slice(0, Math.floor(entries.length / 2));
    const avgFirst = firstHalf.reduce((a, b) => a + b.mood, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b.mood, 0) / secondHalf.length;
    if (avgSecond - avgFirst > 0.5) trend = 'improving';
    else if (avgFirst - avgSecond > 0.5) trend = 'declining';
    else if (Math.abs(avgSecond - avgFirst) <= 0.5) trend = 'stable';
    else trend = 'mixed';
  }

  const habitNames = userHabits.map((h) => `${h.icon} ${h.name}`).join(', ');

  // Deterministic fallback templates (empathetic, non-diagnostic)
  let defaultSummary = '';
  let defaultEncouragement = '';
  const defaultHabitSuggestions: string[] = [];

  if (language === 'vi') {
    if (avgMood >= 4) {
      defaultSummary = `Tuần qua bạn có trạng thái cảm xúc rất tích cực với ${positiveDaysCount}/${entries.length} ngày vui vẻ và phấn khởi. Năng lượng học tập và sinh hoạt của bạn đang được duy trì rất tốt.`;
      defaultEncouragement = 'Hãy tiếp tục giữ vững nhịp độ này và lan tỏa năng lượng tích cực đến bạn bè xung quanh!';
    } else if (avgMood >= 3) {
      defaultSummary = `Cảm xúc tuần qua của bạn nhìn chung ở mức cân bằng, ổn định (${positiveDaysCount} ngày tốt, ${neutralDaysCount} ngày bình thường). Bạn đang kiểm soát tốt nhịp sống thường nhật.`;
      defaultEncouragement = 'Duy trì sự đều đặn trong các thói quen nhỏ mỗi ngày sẽ giúp bạn luôn có tâm lý vững vàng.';
    } else {
      defaultSummary = `Tuần qua có vẻ có một vài ngày nhiều áp lực hoặc khó khăn đối với bạn (${difficultDaysCount} ngày cảm xúc lắng xuống). Điều này hoàn toàn bình thường trong hành trình học tập.`;
      defaultEncouragement = 'Hãy cho phép bản thân nghỉ ngơi, đừng quá khắt khe với chính mình. Nếu cảm thấy quá tải, hãy chia sẻ cùng bạn bè hoặc người thân nhé.';
    }

    if (userHabits.length > 0) {
      const suggested = userHabits.slice(0, 2);
      suggested.forEach((h) => {
        defaultHabitSuggestions.push(`Dành 10–15 phút cho thói quen ${h.icon} "${h.name}" để tái tạo năng lượng.`);
      });
    } else {
      defaultHabitSuggestions.push('Thử đi bộ nhẹ nhàng hoặc nghe một bản nhạc thư giãn để thả lỏng tâm trí.');
    }
  } else {
    if (avgMood >= 4) {
      defaultSummary = `You had a highly positive week with ${positiveDaysCount}/${entries.length} uplifting days. Your motivation and routine are on a great track.`;
      defaultEncouragement = 'Keep this momentum going and celebrate your personal progress!';
    } else if (avgMood >= 3) {
      defaultSummary = `Your mood throughout the week was steady and balanced (${positiveDaysCount} good days, ${neutralDaysCount} neutral days). You are pacing yourself well.`;
      defaultEncouragement = 'Maintaining simple daily habits will keep your mind resilient and focused.';
    } else {
      defaultSummary = `It looks like you encountered some challenging or heavy moments this week (${difficultDaysCount} tough days). Ups and downs are a natural part of student life.`;
      defaultEncouragement = 'Remember to take breaks and be gentle with yourself. Reach out to trusted friends if you feel overwhelmed.';
    }

    if (userHabits.length > 0) {
      const suggested = userHabits.slice(0, 2);
      suggested.forEach((h) => {
        defaultHabitSuggestions.push(`Spend 10–15 minutes on ${h.icon} "${h.name}" to refresh your mind.`);
      });
    } else {
      defaultHabitSuggestions.push('Take a short walk or listen to relaxing music to decompress.');
    }
  }

  // Try generating with AI Edge Function if available
  try {
    const prompt = `Analyze the student's 7-day mood logs and habits.
Data:
- Mood ratings (1 to 5): ${entries.map((e) => e.mood).join(', ')}
- Average mood: ${avgMood} / 5
- Positive days: ${positiveDaysCount}, Neutral days: ${neutralDaysCount}, Difficult days: ${difficultDaysCount}
- Trend: ${trend}
- User's own registered habits: ${habitNames || 'None'}
- Language requested: ${language === 'vi' ? 'Vietnamese' : 'English'}

CRITICAL SAFETY & TONE RULES:
1. Be supportive, empathetic, realistic, and non-diagnostic.
2. DO NOT diagnose or mention medical conditions like depression or anxiety.
3. If recommending habits, ONLY recommend from the user's registered habits: [${habitNames}].
4. Return ONLY valid JSON with this exact schema:
{
  "summaryText": "...",
  "encouragement": "...",
  "habitSuggestions": ["...", "..."]
}`;

    const rawResponse = await generateAiResponse('learning', [{ role: 'user', content: prompt }], accessToken);
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        avgMood,
        positiveDaysCount,
        neutralDaysCount,
        difficultDaysCount,
        trend,
        summaryText: parsed.summaryText || defaultSummary,
        encouragement: parsed.encouragement || defaultEncouragement,
        habitSuggestions: Array.isArray(parsed.habitSuggestions) && parsed.habitSuggestions.length > 0 ? parsed.habitSuggestions : defaultHabitSuggestions,
      };
    }
  } catch {
    // Fallback to deterministic summary if AI call fails or is unconfigured
  }

  return {
    avgMood,
    positiveDaysCount,
    neutralDaysCount,
    difficultDaysCount,
    trend,
    summaryText: defaultSummary,
    encouragement: defaultEncouragement,
    habitSuggestions: defaultHabitSuggestions,
  };
}

