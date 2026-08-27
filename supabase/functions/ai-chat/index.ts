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
}

const SYSTEM_PROMPTS: Record<string, string> = {
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

    const chatMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
    ];

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

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${geminiKey}`,
        },
        body: JSON.stringify({
          model: "gemini-3.6-flash",
          messages: chatMessages,
          max_tokens: 8192,
          temperature: 0.7,
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errorText);
      let userMessage = "AI service request failed. Please try again.";
      if (geminiResponse.status === 429) {
        userMessage =
          "Dịch vụ AI đang quá tải hoặc đã vượt giới hạn miễn phí. Vui lòng thử lại sau ít phút.";
      } else if (geminiResponse.status === 401 || geminiResponse.status === 403) {
        userMessage =
          "API key không hợp lệ hoặc đã hết hạn. Vui lòng liên hệ quản trị viên để cập nhật Gemini API key.";
      }
      return new Response(
        JSON.stringify({ error: userMessage }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await geminiResponse.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "AI service returned an empty response." }),
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
