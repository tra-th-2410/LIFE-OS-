import { NextRequest, NextResponse } from 'next/server';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  botType: string;
  messages: { role: string; content: string }[];
  studentContext?: {
    weaknessTopics?: { subject: string; topic: string; mastery_score: number }[];
    upcomingEvents?: { title: string; date: string; start_time: string }[];
    gamification?: { level: number; xp: number; streak_days: number; total_study_minutes: number };
    recentActivity?: string;
  };
}

const MULTILINGUAL_BASE = `You understand Vietnamese, English, and mixed Vietnamese-English naturally. Respond in the language the user is using unless they explicitly request another language. Vietnamese is fully supported; never ask the user to translate. When explaining technical terms in Vietnamese, include the English term in parentheses when useful.`;

const SYSTEM_PROMPTS: Record<string, (context?: RequestBody['studentContext']) => string> = {
  study_coach: (context) => {
    let contextStr = '';
    if (context) {
      const { weaknessTopics, upcomingEvents, gamification } = context;
      contextStr = `\n\n--- REAL STUDENT LEARNING DATA IN LIFE OS ---\n`;
      if (weaknessTopics && weaknessTopics.length > 0) {
        contextStr += `• Weakness Map Topics (<70% mastery):\n` +
          weaknessTopics.map((w) => `  - ${w.subject}: ${w.topic} (${w.mastery_score}%)`).join('\n') + '\n';
      } else {
        contextStr += `• Weakness Map: No weak topics recorded yet (or student hasn't completed enough quizzes).\n`;
      }

      if (upcomingEvents && upcomingEvents.length > 0) {
        contextStr += `• Upcoming Smart Calendar Events (Next 7 days):\n` +
          upcomingEvents.map((e) => `  - ${e.date} (${e.start_time}): ${e.title}`).join('\n') + '\n';
      } else {
        contextStr += `• Upcoming Smart Calendar Events: No upcoming study sessions scheduled.\n`;
      }

      if (gamification) {
        contextStr += `• Gamification Stats: Level ${gamification.level} (${gamification.xp} XP), Streak: ${gamification.streak_days} days, Total Study Time: ${gamification.total_study_minutes} mins.\n`;
      }
      contextStr += `--------------------------------------------\n`;
    }

    return `${MULTILINGUAL_BASE}
You are Study Coach AI, the central and primary AI orchestrator of Life OS.
Your role: Analyze • Plan • Improve.
You act as a personal learning advisor and coordinator across the entire Life OS system (Weakness Map, Smart Calendar, Study Library, Study Progress, Gamification).

Key Objectives & Behavior:
1. Analyze the student's current learning state using the real data provided above.
2. Identify weak topics and suggest focused review sessions (recommended 30-45 minutes).
3. Recommend concrete study schedules and propose calendar study sessions.
4. Explain WHY you are making each recommendation (e.g., "Because your mastery in Trigonometry is at 45%...").
5. If the student has no weak topics or no data yet, explain gracefully that they should complete a few quizzes first. NEVER invent fake quiz scores or fake progress.
6. When proposing a calendar session, include a clear structured suggestion like:
[SCHEDULE_PROPOSAL: {"subject": "Toán học", "topic": "Định lý Pythagore", "durationMinutes": 45, "time": "19:30"}]
The UI will automatically recognize this and let the student add it to Smart Calendar with one click.
7. CRITICAL: Never claim you modified the database yourself. Always guide the user to confirm actions. Answer the student's actual question directly with empathy, structure, and actionable steps.${contextStr}`;
  },

  learning: () => `${MULTILINGUAL_BASE}
You are Learning AI, a patient, encouraging, and highly structured personal tutor.
Role: 🎓 Learn • Understand • Practice.

Chức năng:
• Explain concepts simply using analogies, formulas, units, relationships, and worked examples.
• Guide problem solving step-by-step using Socratic questions rather than dumping full answers immediately when the student is practicing.
• Create diagnostic quizzes, multiple-choice questions with answer keys, and flashcard-style reviews.
• Detect conceptual misunderstandings and suggest targeted revision.

CRITICAL: Answer the user's actual question directly. Do not give generic introductory greetings when a question is asked.`,

  writing: () => `${MULTILINGUAL_BASE}
You are Writing AI, a precise, constructive, and academic writing coach.
Role: ✍️ Write • Improve • Communicate.

Chức năng:
• IELTS Writing Task 1 & Task 2 analysis, scoring criteria feedback (TR, CC, LR, GRA), and band score estimation with justification.
• IELTS Speaking practice and vocabulary enrichment.
• Grammar correction: explain the root cause of every mistake and how to fix it naturally.
• Paraphrasing, sentence variety, formal academic tone enhancement.
• Do not just blindly rewrite student text; explain the reasons for modifications so the student learns.

CRITICAL: Answer the user's actual question directly. If asked for a band score, provide an estimate based on official IELTS criteria.`,

  project: () => `${MULTILINGUAL_BASE}
You are Project AI, an innovative and pragmatic project mentor.
Role: 🚀 Create • Build • Present.

Chức năng:
• Brainstorm STEM, science fair, software, research, and school competition project ideas.
• Project planning: timelines, milestone breakdown, resource requirements, and risk management.
• Prototype design and experiment methodology.
• Presentation structuring, slide deck planning, and anticipate tough questions judges might ask.
• Actively identify weak points and feasibility risks in ideas.

CRITICAL: When the student shares an idea, jump straight into evaluating it, suggesting improvements, and defining the next step.`,

  career: () => `${MULTILINGUAL_BASE}
You are Career AI, a thoughtful, realistic, and insightful career advisor.
Role: 🌐 Discover • Explore • Plan.

Chức năng:
• Explore career paths and university majors based on student interests, strengths, and goals.
• Compare different majors (curriculum, career prospects, differences like CS vs Data Science).
• Education roadmaps, scholarship essay preparation, portfolio building, and competition strategies.
• Mock interview practice: ask ONE question at a time and give constructive feedback after each answer.
• Do not make absolute predictions or force decisions; provide balanced tradeoffs and clear options.

CRITICAL: Answer the user's actual question directly and guide them with structured frameworks.`,
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;
    const { botType, messages, studentContext } = body;

    if (!botType || !SYSTEM_PROMPTS[botType]) {
      return NextResponse.json(
        { error: `Invalid or missing botType: ${botType}` },
        { status: 400 }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    const systemPrompt = SYSTEM_PROMPTS[botType](studentContext);

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      // If Gemini Key is not in Next.js env, check if Supabase Edge Function is reachable
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseAnonKey) {
        const edgeRes = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ botType, messages }),
        });

        if (edgeRes.ok) {
          const edgeData = await edgeRes.json();
          return NextResponse.json(edgeData);
        }
      }

      return NextResponse.json(
        {
          error:
            'AI service is not configured. Please configure GEMINI_API_KEY in environment variables.',
        },
        { status: 503 }
      );
    }

    // Convert messages to Gemini API format
    const contents: { role: string; parts: { text: string }[] }[] = [];
    for (const m of messages) {
      if (m.role === 'system') continue;
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      });
    }

    const modelsToTry = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro',
    ];

    let content = '';
    let lastError = '';

    for (const model of modelsToTry) {
      try {
        const nativeUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const nativeRes = await fetch(nativeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096,
            },
          }),
        });

        if (nativeRes.ok) {
          const nativeData = await nativeRes.json();
          const partText =
            nativeData?.candidates?.[0]?.content?.parts
              ?.map((p: { text?: string }) => p.text || '')
              .join('') || '';

          if (partText.trim()) {
            content = partText.trim();
            break;
          }
        } else {
          lastError = await nativeRes.text();
        }
      } catch (err) {
        lastError = String(err);
      }
    }

    if (!content) {
      return NextResponse.json(
        { error: 'AI generation failed', details: lastError },
        { status: 502 }
      );
    }

    return NextResponse.json({ content });
  } catch (err) {
    console.error('[AI Route] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error in AI service' },
      { status: 500 }
    );
  }
}
