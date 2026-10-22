function getGeminiApiKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEYS) {
    keys.push(...process.env.GEMINI_API_KEYS.split(','));
  }
  if (process.env.GEMINI_API_KEY) {
    keys.push(...process.env.GEMINI_API_KEY.split(','));
  }
  for (let i = 1; i <= 20; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return [...new Set(keys.map(k => k.trim()).filter(Boolean))];
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const keys = getGeminiApiKeys();
  res.status(200).json({
    status: "ok",
    service: "BrandGuard AI Review API",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    api_keys_configured: keys.length,
    api_key_configured: keys.length > 0,
    platform: "Vercel Serverless"
  });
}

