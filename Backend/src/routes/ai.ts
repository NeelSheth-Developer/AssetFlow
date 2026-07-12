import { Router, type Response } from 'express';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_PROMPT_LENGTH = 4000;
const MAX_OUTPUT_TOKENS = 200;
const SYSTEM_INSTRUCTION =
  'Answer clearly and briefly. Use at most 3 short sentences unless the user explicitly asks for more detail.';

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
}

export const aiRouter = Router();

const response = (res: Response, status: number, success: boolean, message: string, data?: object) =>
  res.status(status).json({ success, message, ...(data && { data }), timestamp: new Date().toISOString() });

// POST /api/ai/chat — requires "Authorization: Bearer <access_token>".
// Body: { "prompt": "..." } → { "reply": "..." } from Gemini.
aiRouter.post('/chat', requireAuth, async (req, res, next) => {
  try {
    const prompt = String(req.body.prompt ?? '').trim();
    if (!prompt) return response(res, 400, false, 'prompt is required');
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return response(res, 400, false, `prompt must be at most ${MAX_PROMPT_LENGTH} characters`);
    }
    if (!config.gemini.apiKey) {
      return response(res, 503, false, 'Gemini is not configured on the server (set GEMINI_API_KEY)');
    }

    const geminiRes = await fetch(`${GEMINI_URL}/${config.gemini.model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.gemini.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    const json = (await geminiRes.json().catch(() => ({}))) as GeminiResponse;

    if (!geminiRes.ok) {
      req.log.error({ status: geminiRes.status, error: json.error?.message }, 'Gemini request failed');
      return response(res, 502, false, json.error?.message ?? 'Gemini request failed');
    }

    const reply = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!reply) return response(res, 502, false, 'Gemini returned an empty reply');

    req.log.info(
      { userId: req.user!.id, model: config.gemini.model, promptChars: prompt.length, replyChars: reply.length },
      'AI reply generated',
    );

    return response(res, 200, true, 'Reply generated', {
      reply,
      model: config.gemini.model,
      user_id: req.user!.id,
    });
  } catch (error) {
    next(error);
  }
});
