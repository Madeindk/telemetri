const { Buffer } = require('node:buffer');
const { randomUUID } = require('crypto');

module.exports = async (req, res) => {
  console.log("🔵 Function started");   // Debug start

  if (req.method !== 'POST') {
    console.log("❌ Wrong method:", req.method);
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.error("❌ Missing GITHUB_TOKEN");
      res.status(500).json({ error: 'Server not configured (missing GITHUB_TOKEN)' });
      return;
    }

    const payload = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    console.log("📦 Payload received:", payload);

    if (!payload || !payload.log) {
      console.error("❌ No log field in payload");
      res.status(400).json({ error: 'Missing base64 CSV in payload.log' });
      return;
    }

    const owner = 'Madeindk';
    const repo  = 'Tele';
    const branch = 'main';

    const createdAt = payload.timestamp ? new Date(payload.timestamp) : new Date();
    const yyyy = createdAt.getUTCFullYear();
    const mm   = String(createdAt.getUTCMonth() + 1).padStart(2, '0');
    const dd   = String(createdAt.getUTCDate()).padStart(2, '0');
    const datePath = `${yyyy}-${mm}-${dd}`;

    const uid = randomUUID();
    const csvPath  = `logs/${datePath}/${uid}.csv`;
    const jsonPath = `logs/${datePath}/${uid}.json`;

    const meta = {
      testerTag:  payload.testerTag ?? null,
      timestamp:  payload.timestamp ?? new Date().toISOString(),
      calibration: payload.calibration ?? null,
      device:      payload.device ?? null,
      appVersion:  payload.appVersion ?? null,
      appBuild:    payload.appBuild ?? null,
    };

    const putFile = async (path, base64Content, message) => {
      console.log(`➡️ Uploading ${path}`);
      const resp = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message, content: base64Content, branch })
        }
      );

      const text = await resp.text();
      console.log(`⬅️ GitHub response for ${path}:`, text);

      if (!resp.ok) {
        throw new Error(`GitHub upload failed ${resp.status}: ${text}`);
      }
      return JSON.parse(text);
    };

    await putFile(csvPath, payload.log, `Add CSV log ${uid}`);
    await putFile(
      jsonPath,
      Buffer.from(JSON.stringify(meta, null, 2)).toString('base64'),
      `Add metadata ${uid}`
    );

    console.log("✅ Upload done:", { csvPath, jsonPath });
    res.status(200).json({ ok: true, csv: csvPath, meta: jsonPath });

  } catch (e) {
    console.error("🔥 ERROR in upload.js:", e);
    res.status(500).json({ error: e?.message || 'Upload failed' });
  }
};
