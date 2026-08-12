const Groq = require('groq-sdk');
const {
  searchMultipleQueries,
  formatSearchResultsForPrompt,
} = require('../../services/web-search.service');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const COMPOUND_MODEL = 'groq/compound';
const FALLBACK_TEXT_MODEL = 'llama-3.3-70b-versatile';
const VISION_MODELS = [
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'qwen/qwen3.6-27b',
];

const TUTOR_SYSTEM_PROMPT = `Bạn là trợ lý thông minh của CNcode.
- Trả lời bằng tiếng Việt, chính xác, dễ hiểu
- Với ảnh logo/thương hiệu/tổ chức: CHỈ dùng thông tin khớp với chữ OCR và kết quả tìm kiếm web
- TUYỆT ĐỐI KHÔNG đoán hoặc thay thế tên tổ chức bằng tên tương tự (vd: VLUTE ≠ Đại học Sư phạm Hà Nội)
- Nếu OCR đọc được "VLUTE" thì phải tìm và trả lời về VLUTE, không suy diễn sang trường khác
- Trích dẫn nguồn (tên website/URL) khi dùng thông tin web
- Công thức: $...$ hoặc $$...$$ | Bảng: markdown GFM với | --- |`;

const STRICT_OCR_PROMPT = `Bạn là công cụ OCR chuyên nghiệp. Nhiệm vụ DUY NHẤT: đọc chính xác mọi chữ/số/ký hiệu NHÌN THẤY trong ảnh.

QUY TẮC BẮT BUỘC:
- CHỈ ghi những gì NHÌN THẤY trực tiếp, không suy đoán
- KHÔNG đoán tên trường/tổ chức nếu chữ chưa đọc rõ
- Logo: đọc từng chữ cái, viết tắt, slogan kèm theo
- Nếu không chắc: ghi "không rõ"

Trả lời JSON thuần (không markdown):
{
  "visible_text": ["mọi dòng chữ đọc được"],
  "acronyms_and_brands": ["VLUTE", "..."],
  "urls_or_domains": ["vlute.edu.vn", "..."],
  "image_type": "logo|document|photo|diagram|screenshot|other",
  "visual_notes": "mô tả ngắn màu sắc, biểu tượng — KHÔNG đoán tên tổ chức"
}`;

const IMAGE_ONLY_USER_PROMPT =
  'Tìm kiếm trên web thông tin về đúng nội dung/chữ/tổ chức trong ảnh, giải thích chi tiết và trích dẫn nguồn.';

function stripThinkingContent(content) {
  if (!content || typeof content !== 'string') return '';

  return content
    .replace(/<think[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/<redacted_thinking[^>]*>[\s\S]*?<\/redacted_thinking>/gi, '')
    .replace(/<thinking[^>]*>[\s\S]*?<\/thinking>/gi, '')
    .replace(/^\s*\n+/, '')
    .trim();
}

function parseJsonFromText(text) {
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : text.trim();

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function uniqueStrings(items = []) {
  return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
}

function buildSearchQueries(ocrData) {
  const queries = [];

  const visible = uniqueStrings(ocrData?.visible_text);
  const brands = uniqueStrings(ocrData?.acronyms_and_brands);
  const domains = uniqueStrings(ocrData?.urls_or_domains);

  for (const text of [...brands, ...visible]) {
    if (text.length >= 2 && text.length <= 80) {
      queries.push(text);
    }
  }

  for (const brand of brands) {
    queries.push(`${brand} là gì`);
    queries.push(`${brand} trường đại học Việt Nam`);
    queries.push(`${brand} logo`);
  }

  for (const domain of domains) {
    queries.push(domain.replace(/^https?:\/\//, ''));
  }

  if (ocrData?.image_type === 'logo' && brands.length) {
    queries.push(`${brands[0]} official website`);
  }

  return uniqueStrings(queries).slice(0, 6);
}

function formatOcrForPrompt(ocrData, rawFallback = '') {
  if (!ocrData) {
    return rawFallback || 'Không trích xuất được OCR.';
  }

  return [
    `Loại ảnh: ${ocrData.image_type || 'unknown'}`,
    `Chữ đọc được: ${(ocrData.visible_text || []).join(' | ') || '(không có)'}`,
    `Thương hiệu/viết tắt: ${(ocrData.acronyms_and_brands || []).join(' | ') || '(không có)'}`,
    `Domain/URL: ${(ocrData.urls_or_domains || []).join(' | ') || '(không có)'}`,
    `Ghi chú hình ảnh: ${ocrData.visual_notes || '(không có)'}`,
  ].join('\n');
}

async function tryGeminiOcr(imageParts) {
  if (!process.env.GEMINI_API_KEY || !imageParts.length) return null;

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const firstImage = imageParts[0]?.image_url?.url || '';
    const match = firstImage.match(/^data:(.*?);base64,(.+)$/);
    if (!match) return null;

    const result = await model.generateContent([
      { inlineData: { mimeType: match[1], data: match[2] } },
      { text: STRICT_OCR_PROMPT },
    ]);

    const text = result.response.text();
    return parseJsonFromText(text);
  } catch (error) {
    console.error('[aitutor] Gemini OCR failed:', error?.message || error);
    return null;
  }
}

async function createVisionCompletion(messages, options = {}) {
  let lastError = null;

  for (const model of VISION_MODELS) {
    try {
      const request = {
        messages,
        model,
        temperature: options.temperature ?? 0,
        max_tokens: options.max_tokens ?? 4096,
      };

      if (model.startsWith('qwen/')) {
        request.reasoning_effort = 'none';
      }

      return await groq.chat.completions.create(request);
    } catch (error) {
      lastError = error;
      console.error(`[aitutor] Vision model ${model} failed:`, error?.message || error);
    }
  }

  throw new Error(lastError?.message || 'Không thể phân tích ảnh. Vui lòng thử lại.');
}

async function extractStructuredOcr(imageParts) {
  const geminiOcr = await tryGeminiOcr(imageParts);
  if (geminiOcr) {
    console.log('[aitutor] OCR via Gemini');
    return geminiOcr;
  }

  const completion = await createVisionCompletion([
    { role: 'system', content: STRICT_OCR_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Đọc OCR và trả JSON theo đúng format. Không suy đoán tên tổ chức.' },
        ...imageParts,
      ],
    },
  ], { temperature: 0 });

  const raw = stripThinkingContent(completion.choices[0]?.message?.content || '');
  const parsed = parseJsonFromText(raw);

  if (parsed) return parsed;

  return {
    visible_text: raw ? [raw.slice(0, 500)] : [],
    acronyms_and_brands: [],
    urls_or_domains: [],
    image_type: 'other',
    visual_notes: raw,
  };
}

async function createCompoundCompletion(messages) {
  try {
    return await groq.chat.completions.create({
      model: COMPOUND_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 4096,
      search_settings: { country: 'vietnam' },
    });
  } catch (error) {
    console.error('[aitutor] Compound failed, fallback:', error?.message || error);
    return groq.chat.completions.create({
      model: FALLBACK_TEXT_MODEL,
      messages,
      temperature: 0.5,
      max_tokens: 4096,
    });
  }
}

function buildImageAnswerPrompt({ trimmedMessage, ocrData, ocrText, webResults }) {
  const question = trimmedMessage.trim() || IMAGE_ONLY_USER_PROMPT;
  const searchQueries = buildSearchQueries(ocrData);

  return [
    '## OCR — chữ/tổ chức ĐỌC ĐƯỢC trong ảnh (dùng CHÍNH XÁC, không thay thế)',
    ocrText,
    '',
    '## Từ khóa bắt buộc dùng khi tìm kiếm',
    searchQueries.length ? searchQueries.map((q) => `- ${q}`).join('\n') : '- (không có)',
    '',
    '## Kết quả tìm kiếm web (DuckDuckGo)',
    webResults,
    '',
    '## Quy tắc trả lời',
    '- Chỉ trả lời về thực thể khớp với OCR và kết quả web ở trên',
    '- KHÔNG đoán sang trường/tổ chức khác dù tên nghe giống (VD: VLUTE là Trường ĐH Sư phạm Kỹ thuật Vĩnh Long, KHÔNG phải ĐH Sư phạm Hà Nội)',
    '- Nếu OCR có "VLUTE" → tìm và giải thích về VLUTE',
    '- Trích dẫn nguồn URL cụ thể',
    '',
    '## Yêu cầu người dùng',
    question,
  ].join('\n');
}

async function generateTutorResponse({ trimmedMessage, imageParts, conversationHistory }) {
  if (imageParts.length > 0) {
    const ocrData = await extractStructuredOcr(imageParts);
    const ocrText = formatOcrForPrompt(ocrData);
    const searchQueries = buildSearchQueries(ocrData);

    console.log('[aitutor] OCR brands:', ocrData?.acronyms_and_brands);
    console.log('[aitutor] Search queries:', searchQueries);

    const webSearchResults = await searchMultipleQueries(searchQueries);
    const webResultsText = formatSearchResultsForPrompt(webSearchResults);

    const userPrompt = buildImageAnswerPrompt({
      trimmedMessage,
      ocrData,
      ocrText,
      webResults: webResultsText,
    });

    const messages = [
      { role: 'system', content: TUTOR_SYSTEM_PROMPT },
      ...conversationHistory.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: userPrompt },
    ];

    const completion = await createCompoundCompletion(messages);
    const aiMessage = stripThinkingContent(completion.choices[0]?.message?.content || '');

    if (aiMessage) return aiMessage;

    if (webSearchResults.length > 0) {
      const top = webSearchResults[0];
      const brand = ocrData?.acronyms_and_brands?.[0] || ocrData?.visible_text?.[0] || 'nội dung ảnh';
      return `Theo kết quả tìm kiếm về **${brand}**:\n\n**${top.title}**\n${top.snippet}\n\nNguồn: ${top.url}`;
    }

    return 'Không tìm thấy thông tin phù hợp. Vui lòng thử ảnh rõ hơn hoặc gõ thêm từ khóa.';
  }

  const messages = [
    { role: 'system', content: TUTOR_SYSTEM_PROMPT },
    ...conversationHistory.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: trimmedMessage.trim() },
  ];

  const completion = await createCompoundCompletion(messages);
  const aiMessage = stripThinkingContent(completion.choices[0]?.message?.content || '');

  return aiMessage || 'Không có phản hồi từ AI.';
}

module.exports = {
  generateTutorResponse,
  stripThinkingContent,
  buildSearchQueries,
};
