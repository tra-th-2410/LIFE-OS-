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
  if (!supabaseUrl) {
    throw new Error('Supabase URL is not configured');
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ botType, messages }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed (${response.status})`);
  }

  const data = await response.json();
  if (!data.content) {
    throw new Error('AI service returned an empty response');
  }

  return data.content as string;
}
