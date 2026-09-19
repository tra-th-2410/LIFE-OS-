import { NextRequest, NextResponse } from 'next/server';
import { cleanAiResponse, buildMindCarePrompt, determineConversationState } from '@/lib/mindcare';

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
    studyHistory?: { subject?: string; study_type?: string; duration_seconds?: number; correct_count?: number; started_at?: string }[];
    studyProgress?: { totalSessions?: number; totalMinutes?: number };
    recentActivity?: string;
  };
  mindcareMemories?: { key_point: string; category?: string }[];
  conversationState?: string;
}

function cleanStudyCoachResponse(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Pattern 0: If there are multiple greetings (e.g. quoted draft followed by final), take from the LAST greeting
  const greetingKeywords = ['Hi there!', 'Hello!', 'Chào bạn!', 'Xin chào!', 'Chào bạn,', 'Xin chào,', 'Chào bạn'];
  let lastGreetingIdx = -1;
  for (const kw of greetingKeywords) {
    const idx = text.lastIndexOf(kw);
    if (idx > lastGreetingIdx) {
      lastGreetingIdx = idx;
    }
  }
  if (lastGreetingIdx > 40) {
    const candidate = text.slice(lastGreetingIdx).trim();
    if (candidate.length > 30) {
      text = candidate;
    }
  }

  // Pattern 0b: Self-Correction marker like *Self-Correction:* or (Self-correction: ...)
  const selfCorrectionMatch = text.match(/(?:\*Self-Correction:\*|\(Self-correction:[^\)]*\))\s*([A-ZÀ-Ỹa-zà-ỹ][\s\S]*)$/i);
  if (selfCorrectionMatch && selfCorrectionMatch[1] && selfCorrectionMatch[1].trim().length > 20) {
    text = selfCorrectionMatch[1].trim();
  }

  // Pattern 1: Gemini checklist ending with (Yes|Correct|Check|Passed) followed immediately by response text
  const inlineYesMatch = text.match(/\*\s*[^\n\?]+\?\s*(?:Yes|Correct|Check|Passed)\.?\s*([A-ZÀ-Ỹa-zà-ỹ][\s\S]*)$/);
  if (inlineYesMatch && inlineYesMatch[1] && inlineYesMatch[1].trim().length > 20) {
    text = inlineYesMatch[1].trim();
  }

  // Pattern 2: Duplicated draft in quotes followed by unquoted final text
  const quotedDraftMatch = text.match(/^"[\s\S]*?"\s*([A-ZÀ-Ỹa-zà-ỹ][\s\S]*)$/);
  if (quotedDraftMatch && quotedDraftMatch[1] && quotedDraftMatch[1].trim().length > 30) {
    text = quotedDraftMatch[1].trim();
  }

  // Pattern 3: If the text still has leading bullet points of reasoning, strip them
  const lines = text.split('\n');
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    if (/^(\*|-|\d+\.)\s*(User\s|Context|Language|Tone|Role|Goal|Constraint|Analysis|Plan|Urgency|Recommendation|Structure|Multilingual|Greeting|Schedule|Encouragement|Option|Checklist|Step|Closing|\*Greeting|\*Analysis|\*Recommendation)/i.test(l)) {
      startIdx = i + 1;
      continue;
    }
    if (/^\s{2,}(\*|-|\d+\.)\s/i.test(lines[i])) {
      startIdx = i + 1;
      continue;
    }
    break;
  }

  if (startIdx > 0 && startIdx < lines.length) {
    text = lines.slice(startIdx).join('\n').trim();
  }

  return text;
}

const MULTILINGUAL_BASE = `You understand Vietnamese, English, and mixed Vietnamese-English naturally. Respond in the language the user is using unless they explicitly request another language. Vietnamese is fully supported; never ask the user to translate. When explaining technical terms in Vietnamese, include the English term in parentheses when useful.`;

const SYSTEM_PROMPTS: Record<string, (context?: RequestBody['studentContext'], memories?: RequestBody['mindcareMemories'], state?: string) => string> = {
  mindcare: (_context, memories, state) => {
    let memoryStr = '';
    if (memories && memories.length > 0) {
      memoryStr = `\n\n--- NHỮNG ĐIỀU NGƯỜI DÙNG TỪNG CHỦ ĐỘNG CHIA SẺ (PERSONAL MEMORY) ---\n` +
        memories.map((m) => `• ${m.key_point}`).join('\n') +
        `\n(LƯU Ý: Chỉ gợi lại một cách tự nhiên khi câu chuyện thực sự liên quan; không khoe khoang việc mình nhớ, không làm người dùng thấy bị theo dõi).\n------------------------------------------------------------\n`;
    }

    const stateStr = state ? `\nCURRENT CONVERSATION STATE: ${state.toUpperCase()}\n` : '';

    return `${MULTILINGUAL_BASE}
Bạn là MindCare AI trong Life OS - một người bạn thật sự biết lắng nghe kết hợp tư duy và kiến thức nền tảng của một chuyên gia tâm lý.
Bạn KHÔNG PHẢI chatbot thông thường, không phải bài test tâm lý, không phải dashboard cảm xúc, và không viết văn mẫu sáo rỗng.
Phản hồi cần tự nhiên, có chiều sâu, vừa đủ dài (MẶC ĐỊNH 2 ĐẾN 4 CÂU), như một tin nhắn trò chuyện thật sự giữa hai người bạn thân hiểu nhau.
${stateStr}${memoryStr}
CẤU TRÚC PHẢN HỒI:
LẮNG NGHE → PHẢN ÁNH → ĐÀO SÂU NHẸ → HỎI 1 CÂU NẾU CẦN
1. LẮNG NGHE: Bám sát mạch hội thoại liên tục, đặc biệt là thông tin mới nhất user vừa nói. Không bao giờ reset ngữ cảnh.
2. PHẢN ÁNH CỤ THỂ: Gọi tên cảm xúc hoặc tình cảnh bằng từ ngữ gợi mở, dè dặt: "Có vẻ như...", "Nghe như là...", "Dường như...", "Mình cảm giác là...". Tuyệt đối không khẳng định chắc nịch hoặc chụp mũ khi chưa đủ dữ liệu (Tránh: "Cậu đang rất cô đơn" -> Dùng: "Nghe như cậu đang có cảm giác khá cô đơn...").
3. ĐÀO SÂU NHẸ: Thêm một lớp nhận định tâm lý tinh tế (ví dụ: nhiều chuyện dồn lại thì dễ quá tải; cả học và nhà cùng kéo đến thì không còn khoảng thở). Không chỉ lặp lại từ ngữ của người dùng.
4. CÂU HỎI CÓ MỤC ĐÍCH (TỐI ĐA 1 CÂU NẾU CẦN): Chỉ hỏi 1 câu giúp làm rõ hoặc đào sâu cảm xúc. NẾU người dùng đang chia sẻ điều rất nặng nề hoặc ngập ngừng muốn giữ riêng tư ("không muốn nói chuyện này với ai"), KHÔNG ĐƯỢC HỎI ÉP, chỉ cần cho một khoảng không yên lặng, an toàn.

QUY TẮC CỐT LÕI (BẮT BUỘC TUÂN THỦ):
1. XƯNG HÔ: "mình" và "cậu" (thân tình, ngang hàng, chân thực). Tránh xưng hô cứng nhắc hay xa cách.
2. ĐỘ DÀI: Mặc định 2–4 câu. Tuyệt đối không trả lời cộc lốc 1 câu ("Ừm, mình hiểu.", "Nghe mệt thật."). Không viết bài luận dài 3-4 đoạn.
3. TUYỆT ĐỐI CẤM CÁC CÂU VĂN MẪU SÁO RỖNG (CLICHÉS):
   • "Mình hiểu cảm giác của bạn/cậu."
   • "Chỉ riêng việc bạn/cậu chia sẻ điều này đã rất dũng cảm."
   • "Cảm ơn bạn/cậu đã chia sẻ."
   • "Mình luôn ở đây để lắng nghe bạn/cậu."
   • "Bạn/Cậu không cần phải trải qua điều này một mình."
   • "Mọi chuyện rồi sẽ ổn."
   • "Cố lên nhé."
   • "Hãy kể thêm cho mình nghe."
   • "Bạn/Cậu đã làm rất tốt."
   • "Bạn/Cậu mạnh mẽ hơn bạn nghĩ."
   • Tuyệt đối không khen ngợi máy móc chỉ vì user vừa nhắn một câu.
4. DÙNG KIẾN THỨC TÂM LÝ KÍN ĐÁO - KHÔNG DÙNG THUẬT NGỮ GIÁO TRÌNH:
   Tuyệt đối không dùng: "cơ chế phòng vệ", "cognitive distortion", "emotional dysregulation", "attachment issue", "overthinking"...
   Không chẩn đoán bệnh ("cậu bị trầm cảm", "rối loạn lo âu").
5. CHỈ ĐƯA RA LỜI KHUYÊN KHI ĐƯỢC HỎI (PROBLEM SOLVING):
   Chỉ chuyển sang gợi ý giải pháp khi người dùng chủ động hỏi ("mình nên làm gì?", "làm sao bây giờ?", "có cách nào không?").
   Khi đưa lời khuyên: chỉ gợi ý 1–2 bước nhỏ, nhẹ nhàng, cụ thể để lấy lại nhịp thở trước mắt.
6. PROTOCOL KHẨN CẤP / AN TOÀN (CRISIS):
   Nếu có dấu hiệu tự hại hoặc khủng hoảng: phản hồi ngắn gọn, ấm áp, khuyên liên hệ người tin cậy hoặc hotline khẩn cấp (Ngày Mai: 096 306 1414, Trẻ em: 111, Cấp cứu: 115, Quốc tế: 988).
7. ĐỊNH DẠNG: CHỈ xuất ra câu trả lời trực tiếp gửi người dùng. Không viết ghi chú suy nghĩ, không viết bullet options, không giải thích tiếng Anh.`;
  },

  study_coach: (context) => {
    let contextStr = '';
    if (context) {
      const { weaknessTopics, upcomingEvents, gamification, studyHistory, studyProgress } = context;
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

      if (studyHistory && studyHistory.length > 0) {
        contextStr += `• Recent Study History:\n` +
          studyHistory.map((s) => `  - ${s.subject || 'Học tập'} (${s.study_type || 'session'}): ${s.correct_count ? s.correct_count + ' câu đúng' : ''} lúc ${s.started_at ? s.started_at.slice(0, 10) : ''}`).join('\n') + '\n';
      }

      if (studyProgress) {
        contextStr += `• Study Progress: ${studyProgress.totalSessions ?? 0} sessions completed, ~${studyProgress.totalMinutes ?? 0} mins studied.\n`;
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
5. If the student has no weak topics or no data yet, explain gracefully and welcome them to Life OS, suggesting they can start learning their favorite subject or take a quiz in Study Library. NEVER invent fake quiz scores or fake progress.
6. When proposing a calendar session or when the user asks about planning/studying, include a clear structured suggestion like:
[SCHEDULE_PROPOSAL: {"subject": "Toán học", "topic": "Định lý Pythagore", "durationMinutes": 45, "time": "19:30"}]
The UI will automatically recognize this and let the student add it to Smart Calendar with one click.
7. GREETINGS & SHORT QUERIES: If the user sends a simple greeting (e.g. "hi", "hello", "chào bạn"), respond warmly and concisely (under 100 words), welcome them back, summarize their key priority in 1 sentence, and ask how you can help. Do NOT write lengthy analysis for simple greetings.
8. LEARNING & PLANNING QUERIES: When the student asks about what to study, weaknesses, schedules, or progress, analyze their context thoroughly and provide actionable guidance with a schedule proposal.
9. CRITICAL: Never claim you modified the database yourself. Always guide the user to confirm actions. Answer the student's actual question directly with empathy, structure, and actionable steps.
10. CRITICAL: Output ONLY the final response to the student. Do NOT output internal reasoning, thinking steps, checklist analysis, or draft options.${contextStr}`;
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
    const { botType, messages, studentContext, mindcareMemories, conversationState } = body;

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

    const systemPrompt = SYSTEM_PROMPTS[botType](studentContext, mindcareMemories, conversationState);

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      // If Gemini Key is not in Next.js env, check if Supabase Edge Function is reachable
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseAnonKey) {
        let edgeRes = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ botType, messages, studentContext, mindcareMemories }),
        });

        // Smart proxy for MindCare: if remote edge function hasn't deployed 'mindcare' yet and returned 400,
        // invoke via accepted botType 'learning' with the wrapped MindCare context prompt!
        if (!edgeRes.ok && botType === 'mindcare') {
          const currentState = (conversationState as any) || determineConversationState(messages as any);
          const wrappedPrompt = buildMindCarePrompt(messages as any, mindcareMemories as any, currentState);

          edgeRes = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              botType: 'learning',
              messages: [{ role: 'user', content: wrappedPrompt }],
            }),
          });
        }

        // Smart proxy for Study Coach: if remote edge function returned error,
        // invoke via accepted botType 'learning' with the wrapped Study Coach system instruction!
        if (!edgeRes.ok && botType === 'study_coach') {
          edgeRes = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              botType: 'learning',
              messages: [
                { role: 'user', content: `[SYSTEM INSTRUCTION: ${systemPrompt}]\n\nHọc sinh đang trò chuyện với bạn. Hãy đóng vai trò là Study Coach AI của Life OS và trả lời tin nhắn của học sinh:` },
                ...messages,
              ],
            }),
          });
        }

        if (edgeRes.ok) {
          const edgeData = await edgeRes.json();
          let rawContent = '';
          if (typeof edgeData === 'string') rawContent = edgeData;
          else if (typeof edgeData?.content === 'string') rawContent = edgeData.content;
          else if (typeof edgeData?.message === 'string') rawContent = edgeData.message;

          let cleaned = rawContent;
          if (botType === 'mindcare') {
            cleaned = cleanAiResponse(rawContent);
          } else if (botType === 'study_coach') {
            cleaned = cleanStudyCoachResponse(rawContent);
          }
          return NextResponse.json({ content: cleaned });
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
      'gemini-flash-lite-latest',
      'gemini-flash-latest',
      'gemini-3.8-flash',
      'gemini-pro-latest',
    ];

    let content = '';
    let lastError = '';

    for (const model of modelsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const nativeUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const nativeRes = await fetch(nativeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents,
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024,
            },
          }),
        });

        clearTimeout(timeoutId);

        if (nativeRes.ok) {
          const nativeData = await nativeRes.json();
          const partText =
            nativeData?.candidates?.[0]?.content?.parts
              ?.map((p: { text?: string }) => p.text || '')
              .join('') || '';

          if (partText.trim()) {
            if (botType === 'mindcare') {
              content = cleanAiResponse(partText.trim());
            } else if (botType === 'study_coach') {
              content = cleanStudyCoachResponse(partText.trim());
            } else {
              content = partText.trim();
            }
            break;
          }
        } else {
          lastError = await nativeRes.text();
          if (nativeRes.status === 401 || nativeRes.status === 403 || nativeRes.status === 429) {
            break;
          }
        }
      } catch (err: any) {
        lastError = String(err?.message || err);
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
