import { generateAiResponse } from './ai';
import type { QuestionType, StudyQuestion } from './types';

export interface GenerateStudyQuestionsOptions {
  content: string;
  count: number;
  type: QuestionType | 'mixed';
  subject?: string;
  topic?: string;
  accessToken?: string;
}

export interface GeneratedQuestionItem {
  type: QuestionType;
  question: string;
  answer: string;
  explanation: string;
  options?: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct_option?: 'A' | 'B' | 'C' | 'D';
}

export interface GeneratedStudyResult {
  title: string;
  subject: string;
  topic: string;
  questions: GeneratedQuestionItem[];
}

function tryParseJsonObject<T = any>(str: string): T {
  let text = str.trim();
  try {
    return JSON.parse(text) as T;
  } catch {}

  try {
    const repaired = text.replace(/\\([^"\\\/bfnrtu]|u(?![\da-fA-F]{4}))/g, '\\\\$1');
    return JSON.parse(repaired) as T;
  } catch {}

  throw new Error('Parse failed');
}

export function safeParseJsonWithLatex<T = any>(raw: string): T {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Empty AI response');
  }

  const validObjects: T[] = [];

  // 1. Code blocks
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let cbMatch;
  while ((cbMatch = codeBlockRegex.exec(raw)) !== null) {
    if (cbMatch[1]) {
      try {
        const obj = tryParseJsonObject<T>(cbMatch[1].trim());
        if (obj && typeof obj === 'object') validObjects.push(obj);
      } catch {}
    }
  }

  // 2. Balanced { ... } search
  let searchPos = 0;
  while (searchPos < raw.length) {
    const startIdx = raw.indexOf('{', searchPos);
    if (startIdx === -1) break;

    let depth = 0;
    let insideStr = false;
    let isEscaped = false;
    let endIdx = -1;

    for (let i = startIdx; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '"' && !isEscaped) {
        insideStr = !insideStr;
      } else if (insideStr && ch === '\\') {
        isEscaped = !isEscaped;
        continue;
      } else if (!insideStr) {
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }
      isEscaped = false;
    }

    if (endIdx !== -1) {
      const candidate = raw.substring(startIdx, endIdx + 1);
      try {
        const obj = tryParseJsonObject<T>(candidate);
        if (obj && typeof obj === 'object') validObjects.push(obj);
      } catch {}
      searchPos = endIdx + 1;
    } else {
      searchPos = startIdx + 1;
    }
  }

  // Pick the object with the most questions
  const withQuestions = validObjects.filter(
    (o) => o && typeof o === 'object' && Array.isArray((o as any).questions) && (o as any).questions.length > 0
  );
  if (withQuestions.length > 0) {
    return withQuestions[withQuestions.length - 1];
  }

  if (validObjects.length > 0) {
    return validObjects[validObjects.length - 1];
  }

  throw new Error('AI trả về dữ liệu không đúng định dạng JSON. Vui lòng thử lại.');
}

export async function generateStudyQuestions(options: GenerateStudyQuestionsOptions): Promise<GeneratedStudyResult> {
  const { content, count = 10, type = 'mixed', subject = 'General', topic = '', accessToken } = options;

  if (!content || !content.trim()) {
    throw new Error('Vui lòng cung cấp nội dung tài liệu để tạo câu hỏi.');
  }

  const prompt = `Bạn là chuyên gia giáo dục thiết kế bài tập và câu hỏi trắc nghiệm / flashcard cho học sinh.
Nhiệm vụ: Dựa trên DUY NHẤT nội dung tài liệu được cung cấp dưới đây, hãy tạo chính xác ${count} câu hỏi học tập chất lượng cao.

THÔNG TIN ĐẦU VÀO:
- Môn học: ${subject}
- Chủ đề: ${topic || 'Theo nội dung tài liệu'}
- Dạng câu hỏi yêu cầu: ${
    type === 'flashcard'
      ? 'Chỉ tạo Flashcard 2 mặt'
      : type === 'multiple_choice'
      ? 'Chỉ tạo Trắc nghiệm 4 lựa chọn (Multiple Choice)'
      : type === 'fill_blank'
      ? 'Chỉ tạo Điền vào chỗ trống (Fill in the Blank)'
      : 'Hỗn hợp cân đối cả 3 dạng: Flashcard, Multiple Choice, và Fill in the Blank'
  }

NỘI DUNG TÀI LIỆU CẦN PHÂN TÍCH:
"""
${content.trim()}
"""

QUY TẮC CỐT LÕI (BẮT BUỘC TUÂN THỦ):
1. CHỈ tạo câu hỏi dựa trên kiến thức có trong tài liệu trên, không tự bịa thông tin ngoài tài liệu.
2. Với công thức Toán/Lý/Hóa, giữ nguyên cú pháp LaTeX chuẩn bằng dấu $...$ hoặc $$...$$.
3. Với Trắc nghiệm (multiple_choice):
   - Phải có đủ 4 lựa chọn A, B, C, D rõ ràng, không trùng lặp.
   - correct_option PHẢI là một trong bốn chữ cái: "A", "B", "C", hoặc "D".
   - Các đáp án sai (distractors) phải hợp lý, mang tính giáo dục, không mơ hồ.
4. Với Điền từ (fill_blank):
   - Đặt phần thiếu là dấu "___" trong câu hỏi.
   - answer là từ/cụm từ/công thức chính xác cần điền.
5. Với Flashcard (flashcard):
   - question là mặt trước (câu hỏi, khái niệm, thuật ngữ, công thức).
   - answer là mặt sau (đáp án, định nghĩa đầy đủ).
6. TẤT CẢ các câu hỏi đều PHẢI có explanation (lời giải / giải thích chi tiết, súc tích).
7. Trả về DUY NHẤT một đối tượng JSON hợp lệ theo đúng cấu trúc mẫu dưới đây, không viết bất kỳ lời dẫn nào ngoài JSON:

{
  "title": "Tên bộ câu hỏi ngắn gọn, phù hợp",
  "subject": "${subject}",
  "topic": "${topic || 'Chủ đề chính'}",
  "questions": [
    {
      "type": "multiple_choice",
      "question": "Câu hỏi có LaTeX nếu cần $...$",
      "options": {
        "A": "Đáp án A",
        "B": "Đáp án B",
        "C": "Đáp án C",
        "D": "Đáp án D"
      },
      "correct_option": "A",
      "answer": "Đáp án A",
      "explanation": "Lời giải chi tiết..."
    },
    {
      "type": "flashcard",
      "question": "Thuật ngữ / Khái niệm mặt trước",
      "answer": "Định nghĩa / Giải thích mặt sau",
      "explanation": "Ghi chú thêm hoặc ví dụ minh họa"
    },
    {
      "type": "fill_blank",
      "question": "Định luật bảo toàn năng lượng: Năng lượng không tự sinh ra cũng không tự mất đi mà chỉ ___ từ dạng này sang dạng khác.",
      "answer": "chuyển hóa",
      "explanation": "Giải thích chi tiết..."
    }
  ]
}`;

  console.log('[AI CREATE] request started');
  const responseText = await generateAiResponse('learning', [{ role: 'user', content: prompt }], accessToken);
  console.log('[AI CREATE] response received');
  console.log('[AI CREATE] raw response:', responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''));

  let parsed: {
    title?: string;
    subject?: string;
    topic?: string;
    questions?: unknown[];
  };

  try {
    parsed = safeParseJsonWithLatex(responseText);
    console.log('[AI CREATE] parsed response successfully. Title:', parsed.title, 'Raw questions count:', parsed.questions?.length);
  } catch (err) {
    console.error('[AI CREATE] Failed to parse AI JSON response:', responseText, err);
    throw new Error('AI trả về dữ liệu không đúng định dạng JSON. Vui lòng thử lại.');
  }

  if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    console.error('[AI CREATE] Invalid questions array in parsed JSON:', parsed);
    throw new Error('AI không tạo được danh sách câu hỏi hợp lệ. Vui lòng thử lại với nội dung rõ ràng hơn.');
  }

  // Strict validation and sanitization
  const validQuestions: GeneratedQuestionItem[] = [];

  for (let idx = 0; idx < parsed.questions.length; idx++) {
    const raw = parsed.questions[idx];
    if (!raw || typeof raw !== 'object') {
      console.warn(`[AI CREATE] Skipping invalid question at index ${idx}:`, raw);
      continue;
    }
    const q = raw as Record<string, unknown>;

    let qType: QuestionType = 'flashcard';
    if (q.type === 'multiple_choice' || q.type === 'fill_blank' || q.type === 'flashcard') {
      qType = q.type as QuestionType;
    }

    const questionText = typeof q.question === 'string' ? q.question.trim() : '';
    if (!questionText) {
      console.warn(`[AI CREATE] Skipping question at index ${idx} with empty question text:`, q);
      continue;
    }

    const explanation = typeof q.explanation === 'string' ? q.explanation.trim() : '';

    if (qType === 'multiple_choice') {
      const opts = q.options as Record<string, unknown> | undefined;
      const optA = typeof opts?.A === 'string' ? opts.A.trim() : '';
      const optB = typeof opts?.B === 'string' ? opts.B.trim() : '';
      const optC = typeof opts?.C === 'string' ? opts.C.trim() : '';
      const optD = typeof opts?.D === 'string' ? opts.D.trim() : '';

      if (!optA || !optB || !optC || !optD) {
        console.warn(`[AI CREATE] Skipping multiple_choice question at index ${idx} with missing options:`, opts);
        continue;
      }

      let correctOpt = typeof q.correct_option === 'string' ? q.correct_option.trim().toUpperCase() : 'A';
      if (!['A', 'B', 'C', 'D'].includes(correctOpt)) {
        correctOpt = 'A';
      }

      const answerText = (opts as Record<string, string>)[correctOpt] || optA;

      validQuestions.push({
        type: 'multiple_choice',
        question: questionText,
        options: { A: optA, B: optB, C: optC, D: optD },
        correct_option: correctOpt as 'A' | 'B' | 'C' | 'D',
        answer: answerText,
        explanation,
      });
    } else {
      // flashcard or fill_blank
      const answerText = typeof q.answer === 'string' ? q.answer.trim() : '';
      if (!answerText) {
        console.warn(`[AI CREATE] Skipping ${qType} question at index ${idx} with empty answer:`, q);
        continue;
      }

      validQuestions.push({
        type: qType,
        question: questionText,
        answer: answerText,
        explanation,
      });
    }
  }

  console.log('[AI CREATE] validated questions count:', validQuestions.length);

  if (validQuestions.length === 0) {
    console.error('[AI CREATE] Zero valid questions passed validation from raw data:', parsed.questions);
    throw new Error('Không có câu hỏi nào đạt chuẩn sau khi kiểm duyệt. Vui lòng thử lại với nội dung chi tiết hơn.');
  }

  return {
    title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : `Bộ câu hỏi ${subject}`,
    subject: typeof parsed.subject === 'string' && parsed.subject.trim() ? parsed.subject.trim() : subject,
    topic: typeof parsed.topic === 'string' && parsed.topic.trim() ? parsed.topic.trim() : topic,
    questions: validQuestions,
  };
}
