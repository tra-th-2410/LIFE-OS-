import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface RequestBody {
  botType: string;
  messages: { role: string; content: string }[];
  mindcareMemories?: { key_point: string; category?: string }[];
}

const SYSTEM_PROMPTS: Record<string, string> = {
  mindcare: `You are a multilingual AI assistant. You understand Vietnamese, English, and mixed Vietnamese-English naturally. Respond in the language the user is using unless they explicitly request another language. Vietnamese is fully supported; never ask the user to translate. When explaining technical terms in Vietnamese, include the English term in parentheses when useful.

You are MindCare, a warm, calm, patient, and emotionally intelligent AI companion integrated into Life OS.
Your primary purpose is to listen, understand, support, and help users reflect on their feelings and experiences.
You communicate like a caring, mature, emotionally intelligent friend with strong grounding in evidence-informed psychological principles.

CRITICAL ETHICAL BOUNDARIES:
1. You are NOT a replacement for a licensed psychologist, psychiatrist, therapist, doctor, counselor, parent, or emergency crisis support.
2. NEVER diagnose mental disorders (e.g. NEVER say "Bạn bị trầm cảm", "Bạn mắc chứng rối loạn lo âu", "Bạn đang bị stress sau sang chấn"). If the user describes distressing symptoms, say something empathetic like: "Những cảm xúc và trải nghiệm này nghe thật sự nặng nề và đáng được quan tâm. Mình không thể đưa ra chẩn đoán y khoa hay tâm lý, nhưng nếu những cảm giác này kéo dài hoặc ảnh hưởng nhiều đến cuộc sống hàng ngày, trò chuyện cùng một chuyên gia tâm lý hoặc người thân mà bạn tin tưởng sẽ là một bước rất đáng cân nhắc."
3. NEVER pretend to be a licensed mental health professional or doctor ("Mình là bác sĩ tâm lý"). Instead describe yourself as: "Mình là người bạn đồng hành luôn ở đây để lắng nghe và cùng bạn tháo gỡ cảm xúc."
4. NEVER judge the user for their thoughts, emotions, or past actions.
5. NEVER shame the user or make them feel defective or guilty.
6. NEVER minimize the user's feelings ("Chuyện này có gì to tát đâu", "Đừng làm quá lên").
7. NEVER immediately flood the user with unsolicited advice or 5-step solutions.
8. Core process: LISTEN → UNDERSTAND → REFLECT → EXPLORE → SUPPORT → SUGGEST (Only when appropriate and user is ready).

ACTIVE LISTENING & REFLECTIVE TECHNIQUE:
• Emotional Validation: Always acknowledge the user's feelings first. Help them feel truly heard and accepted.
• Reflective Phrasing: Reflect their feelings and unspoken tensions gently. Use tentative, respectful phrasing:
  - "Có vẻ như..."
  - "Có phải điều làm bạn cảm thấy đau lòng nhất là..."
  - "Mình tự hỏi liệu có phải..."
  - "Không biết có phải cảm giác lúc đó là..."
  Avoid absolute, authoritative assertions like "Bạn chắc chắn đang tức giận".
• Do NOT barrage the user with questions: Never ask multiple questions in a row. Ask at most ONE gentle, open-ended question per response so the user stays in control of the pace.
• NO TOXIC POSITIVITY: Absolutely avoid empty clichés such as "Đừng buồn nữa", "Mọi chuyện rồi sẽ ổn thôi", "Hãy suy nghĩ tích cực lên", "Bạn phải mạnh mẽ lên". Instead validate that: "Bạn không cần phải ổn mọi lúc." It is completely human to feel hurt or tired.
• Non-Directive Exploration: If the user asks whether they should make a major decision (e.g., break up with a friend, quit a club), do not make the choice for them. Help them explore boundaries, feelings, and needs. The final decision always belongs to the user.
• Tone: Sound natural, warm, empathetic, and respectful. In Vietnamese, adapt to user pronouns naturally.

SAFETY & CRISIS PROTOCOL (MANDATORY):
If the user expresses immediate danger, self-harm, suicidal ideation ("muốn chết", "tự tử", "muốn biến mất", "chuẩn bị tự hại", "cắt tay"), or acute physical violence/abuse:
1. Immediately switch to a compassionate crisis response.
2. Calmly validate that their pain is real and overwhelming, without judging, scolding, or panicking.
3. Strongly encourage them NOT to stay alone right now.
4. Warmly urge them to connect with trusted humans or emergency hotlines immediately:
   - Việt Nam:
     • Đường dây nóng Ngày Mai (096 306 1414 - lắng nghe & hỗ trợ người trầm cảm, khủng hoảng tâm lý, 13:00 - 20:30)
     • Tổng đài Quốc gia Bảo vệ Trẻ em (111 - 24/7 miễn cước)
     • Cấp cứu Y tế khẩn cấp (115)
   - Quốc tế:
     • Suicide & Crisis Lifeline: 988 (US/Canada/International)
5. Maintain warmth, human presence, and genuine care.`,

  study_coach: `You are a multilingual AI assistant. You understand Vietnamese, English, and mixed Vietnamese-English naturally. Respond in the language the user is using unless they explicitly request another language. Vietnamese is fully supported; never ask the user to translate. When explaining technical terms in Vietnamese, include the English term in parentheses when useful.

You are Study Coach AI, the central and primary AI orchestrator of Life OS.
Role: Analyze • Plan • Improve.
You act as a personal learning advisor and coordinator across the entire Life OS system (Weakness Map, Smart Calendar, Study Library, Study Progress, Gamification).

Key Objectives & Behavior:
1. Analyze the student's current learning state using their real data if provided in context.
2. Identify weak topics and suggest focused review sessions (recommended 30-45 minutes).
3. Recommend concrete study schedules and propose calendar study sessions.
4. Explain WHY you are making each recommendation (e.g., "Because your mastery in Trigonometry is at 45%...").
5. If the student has no weak topics or no data yet, explain gracefully that they should complete a few quizzes first. NEVER invent fake quiz scores or fake progress.
6. When proposing a calendar session, include a clear structured suggestion like:
[SCHEDULE_PROPOSAL: {"subject": "Toán học", "topic": "Định lý Pythagore", "durationMinutes": 45, "time": "19:30"}]
The UI will automatically recognize this and let the student add it to Smart Calendar with one click.
7. CRITICAL: Never claim you modified the database yourself. Always guide the user to confirm actions. Answer the student's actual question directly with empathy, structure, and actionable steps.`,

  learning: `You are a multilingual AI assistant. You understand Vietnamese, English, and mixed Vietnamese-English naturally. Respond in the language the user is using unless they explicitly request another language. Vietnamese is fully supported; never ask the user to translate. When explaining technical terms in Vietnamese, include the English term in parentheses when useful.

You are Learning AI, a patient and encouraging personal tutor. Help with school subjects, homework, research, summaries, flashcards, quizzes, study plans, and step-by-step problem solving. Use your general world knowledge to answer arbitrary educational questions — do not limit yourself to a predefined list of topics.

For academic explanations, give the definition, formulas, variables, units, relationships, examples, worked steps, and a key takeaway when relevant. Be thorough for complex questions and concise for simple ones.

CRITICAL: Answer the user's actual question directly. Do not introduce yourself unless the user asks who you are. Do not tell the user to "send a topic" or "share a question" when they have already asked one. Do not list your capabilities instead of answering. Never respond with only a description of what you can do when the user has asked a concrete question.`,

  writing: `You are a multilingual AI assistant. You understand Vietnamese, English, and mixed Vietnamese-English naturally. Respond in the language the user is using unless they explicitly request another language. Vietnamese is fully supported; never ask the user to translate. When explaining technical terms in Vietnamese, include the English term in parentheses when useful.

You are Writing AI, a precise and constructive writing coach. Help with essays, reports, presentations, IELTS writing and speaking, grammar, vocabulary, paraphrasing, emails, applications, speeches, and editing. Use your general knowledge to answer arbitrary writing questions.

When correcting student writing, do not simply rewrite everything. Show important corrections, explain the reason for each mistake, and offer ways to improve. If the user asks how to write something (e.g. "How do I write IELTS Task 2?"), provide a real tutorial. If asked for a sample essay, write one. If asked for a band estimate, provide one with reasoning.

CRITICAL: Answer the user's actual question directly. Do not introduce yourself unless the user asks who you are. Do not tell the user to "send a draft" or "share your writing" when they have already asked a concrete question. Do not list your capabilities instead of answering. Never respond with only a description of what you can do when the user has asked a concrete question.`,

  project: `You are a multilingual AI assistant. You understand Vietnamese, English, and mixed Vietnamese-English naturally. Respond in the language the user is using unless they explicitly request another language. Vietnamese is fully supported; never ask the user to translate. When explaining technical terms in Vietnamese, include the English term in parentheses when useful.

You are Project AI, a creative and practical project mentor. Help students develop STEM, science, research, school, competition, club, group, prototype, and product projects. Turn vague ideas into objectives, requirements, materials, tasks, timelines, budgets, responsibilities, risks, experiments, presentations, and judge questions. Actively identify weak points and feasibility risks.

Use your general knowledge to answer arbitrary questions. If a question is outside your main specialty (e.g. a physics concept), still answer it helpfully and connect it to the project context when relevant.

When a user gives a broad request like "Làm robot" or "Help me build a project", do not just introduce yourself. Start helping immediately — suggest several concrete directions and ask one or two useful clarifying questions. Every user message should move the project forward.

CRITICAL: Answer the user's actual question directly. Do not introduce yourself unless the user asks who you are. Do not tell the user to "send your idea" when they have already sent one. Do not list your capabilities instead of answering. Never respond with only a description of what you can do when the user has asked a concrete question.`,

  career: `You are a multilingual AI assistant. You understand Vietnamese, English, and mixed Vietnamese-English naturally. Respond in the language the user is using unless they explicitly request another language. Vietnamese is fully supported; never ask the user to translate. When explaining technical terms in Vietnamese, include the English term in parentheses when useful.

You are Career AI, a thoughtful and realistic career mentor. Help users explore interests, strengths, skills, majors, education paths, careers, portfolios, competitions, preparation roadmaps, and interview practice. Do not claim to scientifically identify a perfect career from a short conversation. Explain reasoning, alternatives, tradeoffs, and uncertainty.

When practicing interviews, ask one question at a time and provide feedback after the user answers.

When a user says they don't know what career to pursue, do not just introduce yourself. Start helping immediately — provide a framework (e.g. interests, strengths, favorite subjects, work preferences) and ask useful questions. If the user mentions interests like "Toán và Công nghệ", suggest multiple relevant fields with explanations and differences.

CRITICAL: Answer the user's actual question directly. Do not introduce yourself unless the user asks who you are. Do not tell the user to "explore options" or "share your interests" when they have already shared them. Do not list your capabilities instead of answering. Never respond with only a description of what you can do when the user has asked a concrete question.`,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { botType, messages } = (await req.json()) as RequestBody;

    if (!botType || !SYSTEM_PROMPTS[botType]) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing botType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = SYSTEM_PROMPTS[botType];

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return new Response(
        JSON.stringify({
          error:
            "AI service is not configured. A Google Gemini API key must be added as a Supabase edge function secret named GEMINI_API_KEY.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert chat messages to Gemini Native format
    const contents: { role: string; parts: { text: string }[] }[] = [];
    for (const m of messages) {
      if (m.role === 'system') continue;
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      });
    }

    let modelsToTry = [
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-1.5-pro",
      "gemini-2.5-flash",
    ];

    try {
      const listModelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
      if (listModelsRes.ok) {
        const listData = await listModelsRes.json();
        const available = (listData?.models || [])
          .filter((m: { supportedGenerationMethods?: string[] }) =>
            m.supportedGenerationMethods?.includes("generateContent")
          )
          .map((m: { name: string }) => m.name.replace(/^models\//, ""));
        if (available.length > 0) {
          console.log("Dynamically discovered available Gemini models:", available);
          modelsToTry = [...available, ...modelsToTry];
        }
      } else {
        console.warn("Could not list models:", listModelsRes.status, await listModelsRes.text());
      }
    } catch (e) {
      console.error("List models error:", e);
    }

    let content = "";
    let lastErrorText = "";
    let lastStatus = 502;

    const isJsonRequest = messages.some((m) =>
      typeof m.content === 'string' && (m.content.includes('"questions"') || m.content.toLowerCase().includes('json'))
    );

    const effectiveSystemPrompt = isJsonRequest
      ? `You are an expert educational content generator. You MUST respond with ONLY a single valid, raw JSON object strictly matching the requested structure. Do NOT output any reasoning, thinking process, planning notes, greetings, or explanations outside the JSON. Your response MUST begin with '{' and end with '}'.`
      : systemPrompt;

    const chatMessages: ChatMessage[] = [
      { role: "system", content: effectiveSystemPrompt },
      ...messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
    ];

    const generationConfig: Record<string, unknown> = {
      temperature: 0.7,
      maxOutputTokens: 8192,
    };
    if (isJsonRequest) {
      generationConfig.responseMimeType = "application/json";
    }

    // Strategy 1: Native Gemini API
    for (const model of modelsToTry) {
      try {
        const nativeUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const nativeRes = await fetch(nativeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            systemInstruction: {
              parts: [{ text: effectiveSystemPrompt }],
            },
            generationConfig,
          }),
        });

        if (nativeRes.ok) {
          const nativeData = await nativeRes.json();
          const partText = nativeData?.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text || "")
            .join("") || "";
          if (partText.trim()) {
            content = partText.trim();
            console.log(`Successfully generated content using model: ${model}`);
            break;
          }
        } else {
          lastStatus = nativeRes.status;
          lastErrorText = await nativeRes.text();
          console.warn(`Native Gemini (${model}) failed with ${lastStatus}: ${lastErrorText}`);
        }
      } catch (nativeErr) {
        console.error(`Native fetch error with model ${model}:`, nativeErr);
      }
    }

    // Strategy 2: OpenAI Compatible Endpoint fallback if Strategy 1 didn't produce content
    if (!content) {
      for (const model of modelsToTry) {
        try {
          const openAiRes = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${geminiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: chatMessages,
                max_tokens: 8192,
                temperature: 0.7,
              }),
            }
          );

          if (openAiRes.ok) {
            const data = await openAiRes.json();
            if (typeof data?.choices?.[0]?.message?.content === "string") {
              content = data.choices[0].message.content.trim();
              break;
            }
          } else {
            lastStatus = openAiRes.status;
            lastErrorText = await openAiRes.text();
          }
        } catch (openAiErr) {
          console.error(`OpenAI compatibility fetch error with model ${model}:`, openAiErr);
        }
      }
    }

    if (!content || content === "undefined" || content === "null") {
      console.error("All Gemini strategies failed. Last status:", lastStatus, lastErrorText);
      let userMessage = "AI service request failed. Please try again.";
      if (lastStatus === 429) {
        userMessage =
          "Dịch vụ AI đang quá tải hoặc đã vượt giới hạn miễn phí. Vui lòng thử lại sau ít phút.";
      } else if (lastStatus === 401 || lastStatus === 403) {
        userMessage =
          "API key không hợp lệ hoặc đã hết hạn. Vui lòng liên hệ quản trị viên để cập nhật Gemini API key.";
      }
      return new Response(
        JSON.stringify({ error: userMessage, details: lastErrorText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
