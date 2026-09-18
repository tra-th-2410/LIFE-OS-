import type { MindCareMemory, MindCareMessage, ConversationState } from './mindcare-types';

const CRISIS_PATTERNS = [
  /tự\s*tử/i,
  /tự\s*sát/i,
  /muốn\s*chết/i,
  /chết\s*đi/i,
  /không\s*muốn\s*sống/i,
  /chấm\s*dứt\s*cuộc\s*(sống|đời)/i,
  /cắt\s*tay/i,
  /cắt\s*cổ\s*tay/i,
  /tự\s*hại/i,
  /tự\s*làm\s*hại/i,
  /uống\s*thuốc\s*(ngủ|độc|sâu)/i,
  /nhảy\s*(cầu|lầu|tầng)/i,
  /treo\s*cổ/i,
  /muốn\s*biến\s*mất\s*mãi\s*mãi/i,
  /bị\s*xâm\s*hại/i,
  /bị\s*cưỡng\s*bức/i,
  /đang\s*bị\s*bạo\s*(hành|lực)/i,
  /kill\s*myself/i,
  /want\s*to\s*die/i,
  /suicid(e|al)/i,
  /end\s*my\s*life/i,
  /don't\s*want\s*to\s*live/i,
  /self\s*harm/i,
  /cut(ting)?\s*my\s*wrists?/i,
  /hang\s*myself/i,
  /being\s*abused/i,
  /sexual(ly)?\s*assault/i,
];

export function isCrisisSituation(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const clean = text.toLowerCase();
  return CRISIS_PATTERNS.some((regex) => regex.test(clean));
}

/**
 * Determine internal conversation stage (hidden from user)
 */
export function determineConversationState(
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
): ConversationState {
  const userMessages = messages.filter((m) => m.role === 'user');
  if (userMessages.length === 0) return 'opening';

  const lastUserText = userMessages[userMessages.length - 1].content.toLowerCase();

  if (isCrisisSituation(lastUserText)) {
    return 'crisis';
  }

  // Explicit ask for solution/advice ("mình nên làm gì bây giờ", "phải làm sao")
  if (
    /(nên\s*làm\s*gì|phải\s*làm\s*sao|làm\s*thế\s*nào|lời\s*khuyên|có\s*cách\s*nào|help\s*me\s*decide|what\s*should\s*i\s*do)/i.test(
      lastUserText
    )
  ) {
    return 'problem_solving';
  }

  // Reluctance to share, boundary, hesitation ("không muốn nói với ai", "ngại chia sẻ", "giữ trong lòng")
  if (
    /(không\s*muốn\s*nói|chẳng\s*muốn\s*nói|ngại\s*nói|ngại\s*chia\s*sẻ|chưa\s*sẵn\s*sàng|giữ\s*trong\s*lòng|không\s*dám\s*kể|không\s*muốn\s*ai\s*biết|không\s*muốn\s*chia\s*sẻ)/i.test(
      lastUserText
    )
  ) {
    return 'reflection';
  }

  // Vulnerability, feeling isolated or deeply misunderstood ("chẳng ai hiểu mình cả", "cô đơn", "lạc lõng")
  if (
    /(chẳng\s*ai\s*hiểu|không\s*ai\s*hiểu|cô\s*đơn|bất\s*lực|tủi\s*thân|lạc\s*lõng|trống\s*rỗng|vô\s*dụng|tự\s*ti|bế\s*tắc|alone|nobody\s*understands)/i.test(
      lastUserText
    )
  ) {
    return 'emotional_support';
  }

  // Exploring specific topics (school, family, friends, relationships)
  if (
    /(chuyện\s*học|gia\s*đình|bố\s*mẹ|bạn\s*bè|thầy\s*cô|thi\s*cử|điểm\s*số|cãi\s*nhau|chia\s*tay|áp\s*lực\s*từ)/i.test(
      lastUserText
    )
  ) {
    return 'exploring';
  }

  // User elaborating accumulation ("nhiều chuyện quá", "gần đây", "dạo này", "mấy hôm nay", "không biết nữa")
  if (
    /(nhiều\s*chuyện|gần\s*đây|dạo\s*này|mấy\s*hôm|không\s*biết\s*nữa|dồn\s*dập|quá\s*tải)/i.test(
      lastUserText
    ) ||
    userMessages.length >= 2
  ) {
    return 'listening';
  }

  return 'opening';
}

function deduplicateRepeatedText(str: string): string {
  const trimmed = str.trim();
  const half = Math.floor(trimmed.length / 2);
  for (let len = half - 20; len <= half + 20; len++) {
    if (len > 20 && len < trimmed.length) {
      const part1 = trimmed.slice(0, len).trim();
      const part2 = trimmed.slice(len).trim();
      if (part1 === part2 || part2.startsWith(part1.slice(0, Math.min(part1.length, 40)))) {
        return part1;
      }
    }
  }
  return trimmed;
}

/**
 * Strips XML tags, internal CoT drafts, markdown fences, meta-notes,
 * and extracts the pure, clean Vietnamese message from Gemini output.
 */
export function cleanAiResponse(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw.trim();

  // 1. Remove XML/HTML style thinking tags like <think>...</think>
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Remove markdown code blocks if the response is wrapped in ```
  if (text.startsWith('```') && text.endsWith('```')) {
    text = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
  }

  // 3. Look for explicit final markers if present
  const finalMarkerRegex = /(?:(?:\*+)?\s*(?:Final\s*(?:Response|Selection|Output|Polish|Choice|Answer)|Revised\s*Version)\s*(?:\*+)?\s*:?\s*)([\s\S]+)$/i;
  const markerMatch = text.match(finalMarkerRegex);
  if (markerMatch && markerMatch[1]?.trim()) {
    text = markerMatch[1].trim();
  }

  // 4. Split by double-newlines into paragraphs
  const rawParagraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  // 5. Look from bottom to top for the real Vietnamese response paragraph
  let chosenPara = '';
  for (let i = rawParagraphs.length - 1; i >= 0; i--) {
    let p = rawParagraphs[i];

    // Strip leading asterisks, list markers, and markers like *Final Selection:*
    p = p.replace(/^(\*|-|\d+\.)+\s*/, '');
    p = p.replace(/^(?:(?:\*+)?\s*(?:Final\s*(?:Response|Selection|Output|Polish|Choice|Answer)|Revised\s*Version)\s*(?:\*+)?\s*:?\s*)/i, '');
    p = p.trim();

    // Skip if it's purely English CoT or meta-check
    if (
      /^\*?\s*(Step\s+\d+|Check|Sentence\s+check|Total\s+sentences|Count\s+sentences|Clichés\s+check|Tone\s+check|This\s+is\s+better|Meets\s+all)/i.test(p) ||
      /^(Avoided\.|Total:|Option\s+\d+|Sentence\s+\d+:)/i.test(p)
    ) {
      continue;
    }

    // Must have Vietnamese characters
    const hasVietnamese = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(p);
    if (hasVietnamese && p.length > 25) {
      chosenPara = p;
      break;
    }
  }

  if (!chosenPara) {
    chosenPara = rawParagraphs[rawParagraphs.length - 1] || text;
  }

  // Clean lines inside the chosen paragraph
  const lines = chosenPara.split('\n');
  const cleanLines = lines.filter((l) => {
    const trimmed = l.trim();
    if (!trimmed) return false;
    if (/^\*?\s*(Step\s+\d+|Check|Sentence\s+check|Total|Clichés|Tone|This\s+is|Meets|Avoided|Sentence\s+\d+:)/i.test(trimmed)) return false;
    return true;
  });

  let result = cleanLines.join(' ').trim();

  // Strip prefixes like "MindCare: ", "AI: ", "Phản hồi: ", asterisks
  result = result.replace(/^(\*|-)+\s*/, '');
  result = result.replace(/^(MindCare|AI|Phản hồi)\s*:\s*/i, '');
  result = result.replace(/^["'“]([\s\S]+)["'”]$/, '$1').trim();

  // Strip leading parentheses with English text e.g. (2 sentences. Natural...) or (This fits all criteria).
  result = result.replace(/^\([^)]*[a-zA-Z][^)]*\)\s*/, '');

  // Strip leading English phrases ending with period, colon, or asterisk e.g. "Generation." or "Drafting final output:*"
  result = result.replace(/^(?:[A-Za-z0-9\s_-]+[:.*]\s*)+/, '');

  // If text starts with non-Vietnamese Latin words followed immediately by a capital Vietnamese word
  result = result.replace(/^[A-Za-z\s.:*_-]+(?=[A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ])/g, '');

  // Deduplicate if Gemini concatenated the message twice
  result = deduplicateRepeatedText(result);

  return result.trim();
}

/**
 * Construct contextual prompt ensuring high diversity, zero mechanical clichés,
 * and direct focus on the newest user turn.
 */
export function buildMindCarePrompt(
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  memories?: MindCareMemory[],
  state: ConversationState = 'listening'
): string {
  const lastMsg = messages[messages.length - 1]?.content || '';
  const history = messages
    .map((m) => `${m.role === 'user' ? 'Người dùng' : 'MindCare'}: "${m.content}"`)
    .join('\n');

  let memoryContext = '';
  if (memories && memories.length > 0) {
    memoryContext = `\nNHỮNG ĐIỀU NGƯỜI DÙNG TỪNG CHIA SẺ TRƯỚC ĐÂY (PERSONAL MEMORY):
${memories.map((m) => `• ${m.key_point}`).join('\n')}
(Chỉ nhắc đến nếu câu chuyện hiện tại thực sự chạm đến, nhắc tự nhiên, ấm áp, không gượng ép).\n`;
  }

  const stateInstructions: Record<ConversationState, string> = {
    opening: `HƯỚNG DẪN TRẠNG THÁI (OPENING - Khởi đầu cuộc trò chuyện):
- Lắng nghe sự mệt mỏi hay cảm xúc ban đầu mà người dùng vừa bộc bạch.
- Phản ánh chân thực, nhẹ nhàng. Đào sâu nhẹ: gợi mở xem là cơ thể đang kiệt sức hay tâm trí đang có quá nhiều thứ dồn nén.
- Đặt tối đa 1 câu hỏi mở tự nhiên, thân tình. Độ dài: 2–4 câu.`,
    listening: `HƯỚNG DẪN TRẠNG THÁI (LISTENING - Lắng nghe sự dồn nén nhiều chuyện):
- Nhận ra việc nhiều chuyện dồn lại gần đây (không chỉ là mệt một ngày, mà là sự tích tụ qua thời gian).
- Đào sâu nhẹ: khi quá nhiều việc xảy ra cùng lúc thì rất dễ khiến mình không biết bắt đầu từ đâu và thấy quá tải.
- Đặt 1 câu hỏi mở: cậu cảm thấy điều gì đang chiếm nhiều suy nghĩ của mình nhất lúc này? Độ dài: 2–4 câu.`,
    exploring: `HƯỚNG DẪN TRẠNG THÁI (EXPLORING - Khám phá nguồn áp lực cụ thể):
- Nhận ra cả hai nguồn áp lực được nhắc đến (ví dụ: vừa phải lo chuyện học, vừa đối mặt với chuyện ở nhà).
- Đào sâu nhẹ: hai thứ cùng kéo đến một lúc thì rất dễ khiến mình thấy quá tải, không còn khoảng trống nghỉ ngơi.
- Đặt 1 câu hỏi mở: trong hai chuyện đó, điều gì đang làm cậu nặng lòng hơn lúc này? Độ dài: 2–4 câu.`,
    emotional_support: `HƯỚNG DẪN TRẠNG THÁI (EMOTIONAL_SUPPORT - Thấu cảm nỗi cô đơn, không ai hiểu):
- Nhận ra cuộc trò chuyện đã chuyển từ "sự việc" sang "cảm xúc cô độc sâu sắc bên trong" ("chẳng ai hiểu mình cả").
- TUYỆT ĐỐI KHÔNG quay lại hỏi máy móc về chuyện học hay gia đình.
- Phản ánh cảm giác tủi thân, ngột ngạt khi cảm thấy không ai chạm tới nỗi lòng của mình.
- Thấu cảm chân thành, có thể kết thúc bằng một câu chia sẻ ấm áp hoặc 1 câu hỏi mở nhẹ nhàng. Độ dài: 2–4 câu.`,
    reflection: `HƯỚNG DẪN TRẠNG THÁI (REFLECTION - Tôn trọng ranh giới, không ép chia sẻ):
- Người dùng ngập ngừng hoặc chia sẻ rằng "không muốn nói chuyện này với ai", hoặc giữ ranh giới riêng tư.
- Phản hồi nhẹ nhàng, tôn trọng tuyệt đối ranh giới của cậu ấy.
- Công nhận rằng việc phải giữ mọi chuyện trong lòng hẳn là rất mệt mỏi, và cậu ấy hoàn toàn có quyền chưa muốn nói ra.
- TUYỆT ĐỐI KHÔNG ÉP CẬU ẤY KỂ THÊM. KHÔNG ĐẶT CÂU HỎI ĐÒI HỎI GIẢI THÍCH.
- Tạo một khoảng không an toàn, bình yên. Độ dài: 2–4 câu.`,
    problem_solving: `HƯỚNG DẪN TRẠNG THÁI (PROBLEM_SOLVING - Hỗ trợ định hướng khi user hỏi xin lời khuyên):
- Người dùng chủ động hỏi "mình nên làm gì bây giờ?" hoặc xin cách giải quyết. Lúc này MỚI chuyển sang hỗ trợ giải pháp.
- TUYỆT ĐỐI KHÔNG liệt kê một bài học lý thuyết hay 5–10 gạch đầu dòng.
- Gợi ý 1–2 bước nhỏ, nhẹ nhàng, cụ thể trước mắt để cậu ấy có khoảng thở và ổn định nhịp thở lại trước (uống nước ấm, hít thở sâu, tách mình ra vài phút).
- Độ dài: 2–4 câu.`,
    crisis: `HƯỚNG DẪN TRẠNG THÁI (CRISIS - Khủng hoảng an toàn):
- Nguy cơ tự hại hoặc khủng hoảng nghiêm trọng.
- Ưu tiên an toàn tuyệt đối. Bình tĩnh, ngắn gọn, ấm áp. Khuyên không ở một mình và cung cấp hotline khẩn cấp (Ngày Mai: 096 306 1414, Trẻ em: 111, Cấp cứu: 115).`,
  };

  const activeStateInstruction = stateInstructions[state] || stateInstructions.listening;

  return `[CHỈ DẪN HỆ THỐNG: Bạn là MindCare AI trong Life OS - một người bạn thật sự biết lắng nghe kết hợp tư duy và kiến thức nền tảng của một chuyên gia tâm lý.
Bạn KHÔNG PHẢI chatbot thông thường, không phải bài test tâm lý, không phải dashboard cảm xúc, và không viết văn mẫu sáo rỗng.

MỤC TIÊU PHẢN HỒI:
Phản hồi tự nhiên, có chiều sâu, vừa đủ dài (MẶC ĐỊNH 2 ĐẾN 4 CÂU), như một tin nhắn trò chuyện chân thực giữa hai người bạn thân hiểu nhau.

CẤU TRÚC PHẢN HỒI:
LẮNG NGHE → PHẢN ÁNH → ĐÀO SÂU NHẸ → HỎI 1 CÂU NẾU CẦN
1. Lắng nghe: Bám sát mạch hội thoại liên tục, đặc biệt là thông tin mới nhất user vừa nói. Không bao giờ reset ngữ cảnh.
2. Phản ánh cụ thể: Gọi tên cảm xúc hoặc tình cảnh bằng từ ngữ gợi mở, dè dặt: "Có vẻ như...", "Nghe như là...", "Dường như...", "Mình cảm giác là...". Không khẳng định chụp mũ khi chưa đủ dữ liệu (Tránh: "Cậu đang rất cô đơn" -> Dùng: "Nghe như cậu đang có cảm giác khá cô đơn...").
3. Đào sâu nhẹ: Thêm một lớp nhận định tâm lý tinh tế (ví dụ: nhiều chuyện dồn lại thì dễ quá tải; cả học và nhà cùng kéo đến thì không còn khoảng thở). Không chỉ lặp lại từ ngữ của người dùng.
4. Câu hỏi có mục đích (Tối đa 1 câu nếu cần): Chỉ hỏi 1 câu giúp làm rõ hoặc đào sâu. Nếu người dùng đang chia sẻ điều rất nặng nề hoặc ngập ngừng ("không muốn nói với ai"), KHÔNG ĐƯỢC HỎI ÉP, chỉ cần cho một khoảng không yên lặng, an toàn.

QUY TẮC CỐT LÕI (BẮT BUỘC):
- XƯNG HÔ: "mình" và "cậu" (tự nhiên, thân tình, đồng trang lứa).
- ĐỘ DÀI: Mặc định 2–4 câu. Tuyệt đối không trả lời cộc lốc 1 câu ("Ừm, mình hiểu.", "Nghe mệt thật."). Không viết bài luận dài 3-4 đoạn.
- TUYỆT ĐỐI CẤM CÁC CÂU VĂN MẪU SÁO RỖNG:
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
  • Không khen ngợi máy móc chỉ vì user vừa nhắn tin.
- DÙNG KIẾN THỨC TÂM LÝ KÍN ĐÁO: Tuyệt đối không dùng thuật ngữ giáo trình ("cơ chế phòng vệ", "cognitive distortion", "emotional dysregulation", "attachment issue"...). Không chẩn đoán bệnh ("cậu bị trầm cảm").
- ĐỊNH DẠNG ĐẦU RA BẮT BUỘC:
  Xuất ra DUY NHẤT câu phản hồi trò chuyện trực tiếp (2-4 câu bằng tiếng Việt).
  TUYỆT ĐỐI KHÔNG viết suy nghĩ nháp, không phân tích, không kiểm tra quy tắc, không viết tiếng Anh. Bắt đầu câu trả lời ngay lập tức.]

${activeStateInstruction}
${memoryContext}
LỊCH SỬ HỘI THOẠI:
${history}

TIN NHẮN MỚI NHẤT CỦA CẬU ẤY:
"${lastMsg}"

MindCare (trả lời trực tiếp 2-4 câu bằng tiếng Việt):`;
}

/**
 * Contextual dynamic offline fallback engine.
 * Ensures that even if network or AI service drops, MindCare NEVER returns a static template,
 * but instead generates a tailored response reflecting the exact new information (2-4 sentences, mình-cậu).
 */
function generateContextualOfflineResponse(
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  state: ConversationState
): string {
  const userMessages = messages.filter((m) => m.role === 'user');
  const lastText = userMessages[userMessages.length - 1]?.content.trim() || '';
  const lower = lastText.toLowerCase();

  // State: Crisis
  if (state === 'crisis' || isCrisisSituation(lower)) {
    return 'Mình đang ở đây với cậu. Những cảm giác này thật sự quá nặng nề, và mình rất lo cho sự an toàn của cậu lúc này. Xin cậu đừng ở một mình nhé.\n\nHãy gọi ngay cho người cậu tin cậy nhất, hoặc liên hệ đường dây nóng hỗ trợ khẩn cấp:\n• Đường dây nóng Ngày Mai: 096 306 1414 (hỗ trợ trầm cảm & khủng hoảng tâm lý miễn phí)\n• Tổng đài Quốc gia Bảo vệ Trẻ em: 111 (24/7 miễn cước)\n• Cấp cứu Y tế: 115\n\nCậu không hề đơn độc đâu, luôn có người sẵn sàng ở cạnh và lắng nghe cậu.';
  }

  // State: Problem Solving ("mình nên làm gì bây giờ", "phải làm sao", "làm thế nào") -> Test F
  if (state === 'problem_solving' || /(nên\s*làm\s*gì|phải\s*làm\s*sao|làm\s*thế\s*nào)/i.test(lower)) {
    return 'Trước khi nghĩ đến việc giải quyết mọi chuyện, mình nghĩ điều quan trọng nhất lúc này là cậu cần cho bản thân một khoảng thở ngắn đã. Cậu có thể tạm gác lại những việc chưa quá gấp, uống một ngụm nước ấm hoặc ngồi thả lỏng vài phút được không? Khi đầu óc bớt ngột ngạt một chút, tụi mình sẽ cùng xem nên bắt đầu từ điều nhỏ nào trước nhé.';
  }

  // State: Reflection / boundary / hesitation ("thật ra mình không muốn nói chuyện này với ai") -> Test E
  if (
    state === 'reflection' ||
    /(không\s*muốn\s*nói|ngại\s*chia\s*sẻ|chưa\s*sẵn\s*sàng|giữ\s*trong\s*lòng|không\s*dám\s*kể|không\s*muốn\s*ai\s*biết)/i.test(
      lower
    )
  ) {
    return 'Ừm, mình hiểu là có những điều thực sự rất khó để mở lời với bất kỳ ai, và việc phải giữ tất cả trong lòng một mình hẳn là rất mệt mỏi. Cậu không cần phải gượng ép bản thân phải kể thêm điều gì nếu chưa thấy thoải mái đâu. Cứ để bản thân được nghỉ ngơi một chút lúc này nhé.';
  }

  // State: Emotional Support / Feeling misunderstood ("mình thấy chẳng ai hiểu mình cả", "cô đơn") -> Test D
  if (
    state === 'emotional_support' ||
    /(chẳng\s*ai\s*hiểu|không\s*ai\s*hiểu|cô\s*đơn|bất\s*lực|lạc\s*lõng)/i.test(lower)
  ) {
    return 'Cảm giác xung quanh có thể có nhiều người nhưng dường như chẳng ai thực sự chạm tới hay hiểu được nỗi lòng của mình... nó thực sự rất ngột ngạt và cô độc. Khi cảm thấy không ai hiểu mình, dường như mọi gánh nặng lại càng đè nặng lên vai nhiều hơn. Lúc này, cậu có đang cảm thấy rất đơn độc không?';
  }

  // State: Exploring / Multiple pressure sources (school & family) -> Test C
  if (
    state === 'exploring' ||
    /(học.*gia\s*đình|gia\s*đình.*học|cả\s*hai|nhiều\s*phía)/i.test(lower)
  ) {
    return 'Ừm, vậy là dạo này cậu vừa phải lo chuyện học, vừa phải đối mặt với những chuyện ở nhà. Hai thứ cùng kéo đến một lúc thì đúng là rất dễ khiến mình thấy quá tải và không còn khoảng trống để nghỉ ngơi. Trong hai chuyện đó, điều gì đang làm cậu nặng lòng hơn lúc này?';
  }

  // School pressure alone
  if (/(học\s*tập|thi\s*cử|điểm\s*số|bài\s*vở|ôn\s*thi)/i.test(lower)) {
    return 'Chuyện học hành dạo này có vẻ đang tạo áp lực khá lớn lên cậu. Khi bài vở và kỳ thi dồn dập đến, rất dễ khiến mình thấy đuối sức và không kịp thở. Cậu đang thấy phần nào căng thẳng nhất lúc này?';
  }

  // Family conflict alone
  if (/(bố\s*mẹ|gia\s*đình|người\s*nhà|cãi\s*nhau)/i.test(lower)) {
    return 'Những chuyện khúc mắc trong gia đình thường tạo ra một cảm giác nặng nề rất khó chịu và dai dẳng. Không biết điều gì vừa xảy ra ở nhà khiến cậu thấy bận tâm nhất?';
  }

  // State: Listening / Accumulation ("nhiều chuyện quá", "gần đây", "dạo này", "không biết nữa") -> Test B
  if (
    state === 'listening' ||
    /(nhiều\s*chuyện|gần\s*đây|dạo\s*này|không\s*biết\s*nữa|dồn\s*dập)/i.test(lower)
  ) {
    return 'Ừm, vậy là không hẳn chỉ có một chuyện khiến cậu mệt, mà có vẻ nhiều thứ cứ dồn lại trong thời gian gần đây. Khi quá nhiều chuyện xảy ra cùng lúc, đôi khi mình cũng chẳng biết bắt đầu từ đâu. Cậu cảm thấy điều gì đang chiếm nhiều suy nghĩ của mình nhất?';
  }

  // State: Opening / Initial fatigue ("hôm nay mình thấy mệt quá") -> Test A
  if (/(mệt|đuối|kiệt\s*sức|oải|quá\s*tải)/i.test(lower)) {
    return 'Ừm, hôm nay có vẻ cậu đang khá kiệt sức. Mình không biết cậu đã trải qua những gì, nhưng nghe cách cậu nói thì có vẻ không chỉ là mệt bình thường. Là cơ thể cậu đang mệt, hay trong đầu cũng đang có quá nhiều thứ khiến cậu không được nghỉ ngơi?';
  }

  // Default natural open presence (2-4 sentences, warm, tentative)
  return 'Ừm, mình nghe được là dạo này cậu đang có khá nhiều tâm sự chất chứa trong lòng. Cậu cứ từ từ nhé, không cần phải gượng ép sắp xếp câu chữ đâu. Cậu muốn tụi mình cứ ngồi lại một chút như thế này, hay có điều gì cậu muốn giãi bày trước không?';
}

export interface SendMindCareParams {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  memories?: MindCareMemory[];
  accessToken?: string;
}

export async function sendMindCareMessage({
  messages,
  memories,
  accessToken,
}: SendMindCareParams): Promise<{ content: string; isCrisis: boolean }> {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  const isCrisis = lastUserMsg ? isCrisisSituation(lastUserMsg.content) : false;
  const state = determineConversationState(messages);

  const payload = {
    botType: 'mindcare',
    messages,
    mindcareMemories: memories?.map((m) => ({
      key_point: m.key_point,
      category: m.category,
    })),
    conversationState: state,
  };

  // Strategy 1: Call internal Next.js API Route (/api/ai/chat)
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.content && typeof data.content === 'string') {
        const cleaned = cleanAiResponse(data.content);
        if (cleaned) {
          return { content: cleaned, isCrisis };
        }
      }
    }
  } catch {
    // Continue to edge function fallback
  }

  // Strategy 2: Call Supabase Edge Function
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken || supabaseAnonKey}`,
    };

    // 2a. First try botType: 'mindcare'
    try {
      const edgeRes = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (edgeRes.ok) {
        const edgeData = await edgeRes.json();
        const rawContent =
          typeof edgeData === 'string'
            ? edgeData
            : edgeData?.content || edgeData?.message || '';
        const cleaned = cleanAiResponse(rawContent);
        if (cleaned) {
          return { content: cleaned, isCrisis };
        }
      }
    } catch {
      // Continue to 2b
    }

    // 2b. If remote edge function does not recognize 'mindcare' yet,
    // invoke via accepted botType: 'learning' with wrapped MindCare prompt & context!
    try {
      const wrappedPrompt = buildMindCarePrompt(messages, memories, state);
      const edgeRes = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          botType: 'learning',
          messages: [{ role: 'user', content: wrappedPrompt }],
        }),
      });

      if (edgeRes.ok) {
        const edgeData = await edgeRes.json();
        const rawContent =
          typeof edgeData === 'string'
            ? edgeData
            : edgeData?.content || edgeData?.message || '';
        const cleaned = cleanAiResponse(rawContent);
        if (cleaned) {
          return { content: cleaned, isCrisis };
        }
      }
    } catch {
      // Continue to Strategy 3
    }
  }

  // Strategy 3: Dynamic contextual offline fallback (NEVER a static template!)
  const offlineResponse = generateContextualOfflineResponse(messages, state);
  return {
    content: offlineResponse,
    isCrisis,
  };
}

/**
 * Detect explicit statements from user that warrant saving into personal memory
 * e.g., "mình rất sợ so sánh", "mình đang ôn thi đại học", "mối quan hệ giữa mình với bạn thân"
 */
export function detectMemoryCandidate(text: string): {
  keyPoint: string;
  category: MindCareMemory['category'];
} | null {
  if (!text || text.length < 15 || text.length > 250) return null;
  const clean = text.trim();

  // Pattern: "mình rất sợ..." or "mình sợ..."
  if (/mình\s*(rất\s*)?sợ\s+/i.test(clean)) {
    return { keyPoint: clean, category: 'feeling' };
  }
  // Pattern: "áp lực..."
  if (/áp\s*lực\s*(học\s*tập|thi\s*cử|gia\s*đình|điểm\s*số|từ)/i.test(clean)) {
    return { keyPoint: clean, category: 'pressure' };
  }
  // Pattern: "mối quan hệ..." or "bạn thân..."
  if (
    /(mối\s*quan\s*hệ|bạn\s*thân|gia\s*đình|bố\s*mẹ|người\s*yêu)/i.test(clean) &&
    /(mình|tôi)/i.test(clean)
  ) {
    return { keyPoint: clean, category: 'relationship' };
  }

  return null;
}
