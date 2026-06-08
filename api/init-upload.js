/**
 * api/init-upload.js — Vercel Serverless Function
 *
 * Starts a Gemini Files API resumable upload session and returns the
 * short-lived upload URL to the client. The client then uploads the file
 * bytes directly to that URL (browser → Gemini), bypassing Vercel's 4.5 MB
 * request-body limit. The API key never leaves the server.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { mimeType, displayName, size } = req.body ?? {};

  if (!mimeType || !size) {
    return res.status(400).json({ error: '"mimeType" and "size" are required.' });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set.' });
  }

  try {
    const initRes = await fetch(
      'https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=resumable',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(size),
          'X-Goog-Upload-Header-Content-Type': mimeType,
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({ file: { displayName: displayName ?? 'file' } }),
      },
    );

    if (!initRes.ok) {
      const errData = await initRes.json().catch(() => ({}));
      const msg = errData.error?.message ?? `HTTP ${initRes.status}`;
      return res.status(500).json({ error: `Gemini init-upload failed: ${msg}` });
    }

    const uploadUrl = initRes.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
      return res.status(500).json({ error: 'Gemini did not return an upload URL.' });
    }

    return res.json({ uploadUrl });
  } catch (err) {
    console.error('[init-upload] Error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
