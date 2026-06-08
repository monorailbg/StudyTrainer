/**
 * api/upload-chunk.js — Vercel Serverless Function
 *
 * Forwards one base64-encoded chunk to an active Gemini resumable upload
 * session. Chunks arrive as JSON (≤ ~3.5 MB), well under Vercel's 4.5 MB
 * body limit. The final chunk triggers Gemini to finalize and returns the
 * file URI.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { uploadUrl, chunkBase64, offset, isLast } = req.body ?? {};

  if (!uploadUrl || chunkBase64 === undefined || offset === undefined) {
    return res.status(400).json({ error: '"uploadUrl", "chunkBase64", and "offset" are required.' });
  }

  let chunk;
  try {
    chunk = Buffer.from(chunkBase64, 'base64');
  } catch {
    return res.status(400).json({ error: 'Invalid base64 in "chunkBase64".' });
  }

  try {
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Length': String(chunk.length),
        'X-Goog-Upload-Offset': String(offset),
        // Non-final: 'upload'   Final: 'upload, finalize'
        'X-Goog-Upload-Command': isLast ? 'upload, finalize' : 'upload',
      },
      body: chunk,
    });

    // 308 Resume Incomplete is the expected success response for non-final chunks.
    if (!uploadRes.ok && uploadRes.status !== 308) {
      const errData = await uploadRes.json().catch(() => ({}));
      const msg = errData.error?.message ?? `HTTP ${uploadRes.status}`;
      return res.status(500).json({ error: `Gemini chunk upload failed: ${msg}` });
    }

    if (isLast) {
      const data = await uploadRes.json();
      const fileUri = data.file?.uri;
      if (!fileUri) {
        return res.status(500).json({ error: 'Gemini did not return a file URI after finalize.' });
      }
      return res.json({ fileUri });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[upload-chunk] Error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
