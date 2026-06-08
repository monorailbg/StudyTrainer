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

  const { uploadUrl, chunkBase64, offset, totalSize, isLast } = req.body ?? {};

  if (!uploadUrl || chunkBase64 === undefined || offset === undefined || !totalSize) {
    return res.status(400).json({ error: '"uploadUrl", "chunkBase64", "offset", and "totalSize" are required.' });
  }

  let chunk;
  try {
    chunk = Buffer.from(chunkBase64, 'base64');
  } catch {
    return res.status(400).json({ error: 'Invalid base64 in "chunkBase64".' });
  }

  const end = offset + chunk.length - 1;

  try {
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        // Standard HTTP resumable upload protocol (RFC 9110 / Google standard).
        // 308 Resume Incomplete = non-final chunk accepted.
        // 200/201 = final chunk accepted, file ready.
        'Content-Range': `bytes ${offset}-${end}/${totalSize}`,
      },
      body: chunk,
    });

    // Non-final chunk: Gemini returns 308 Resume Incomplete on success.
    if (!isLast) {
      if (uploadRes.status === 308) return res.json({ ok: true });
      const errText = await uploadRes.text().catch(() => '');
      console.error('[upload-chunk] Non-final chunk error:', uploadRes.status, errText.slice(0, 500));
      return res.status(500).json({ error: `Gemini chunk upload failed: HTTP ${uploadRes.status}` });
    }

    // Final chunk: Gemini returns 200 or 201 with the file object.
    if (uploadRes.ok) {
      const data = await uploadRes.json().catch(() => ({}));
      const fileUri = data.file?.uri;
      if (!fileUri) {
        return res.status(500).json({ error: 'Gemini did not return a file URI after finalize.' });
      }
      return res.json({ fileUri });
    }

    const errText = await uploadRes.text().catch(() => '');
    console.error('[upload-chunk] Final chunk error:', uploadRes.status, errText.slice(0, 500));
    return res.status(500).json({ error: `Gemini chunk upload failed: HTTP ${uploadRes.status}` });
  } catch (err) {
    console.error('[upload-chunk] Error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
