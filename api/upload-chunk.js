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
    // Gemini Files API — Google's X-Goog-Upload-* (Goog) protocol.
    // Non-final: X-Goog-Upload-Command: upload  → HTTP 200, X-Goog-Upload-Status: active
    // Final:     X-Goog-Upload-Command: upload, finalize → HTTP 200 + file object in body
    // Content-Type must be set; Content-Length is set automatically by Node.js fetch.
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Goog-Upload-Offset': String(offset),
        'X-Goog-Upload-Command': isLast ? 'upload, finalize' : 'upload',
      },
      body: chunk,
    });

    if (!isLast) {
      if (uploadRes.ok) return res.json({ ok: true });
      const errText = await uploadRes.text().catch(() => '');
      console.error('[upload-chunk] non-final error:', uploadRes.status, errText.slice(0, 500));
      return res.status(500).json({ error: `Gemini chunk upload failed: HTTP ${uploadRes.status}` });
    }

    if (uploadRes.ok) {
      const data = await uploadRes.json().catch(() => ({}));
      const fileUri = data.file?.uri;
      if (!fileUri) return res.status(500).json({ error: 'Gemini did not return a file URI after finalize.' });
      return res.json({ fileUri });
    }

    const errText = await uploadRes.text().catch(() => '');
    console.error('[upload-chunk] final error:', uploadRes.status, errText.slice(0, 500));
    return res.status(500).json({ error: `Gemini chunk upload failed: HTTP ${uploadRes.status}` });
  } catch (err) {
    console.error('[upload-chunk] Error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
