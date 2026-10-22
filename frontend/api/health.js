export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = process.env.GEMINI_API_KEY;
  res.status(200).json({
    status: "ok",
    service: "BrandGuard AI Review API",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    api_key_configured: Boolean(apiKey),
    platform: "Vercel Serverless"
  });
}
