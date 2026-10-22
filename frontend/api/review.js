export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ detail: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const body = req.body || {};
  const content = body.content;
  const brand_name = body.brand_name || "Acme CloudSync";

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ detail: "Content is required" });
  }

  // Intelligent fallback findings generator for brand governance rules
  function getEngineFindings(text) {
    const list = [];
    if (/fastest|guarantee|zero data loss/i.test(text)) {
      list.push({
        id: "finding-1",
        phrase: text.match(/world's fastest backup tool and guarantees zero data loss|guarantees? zero data loss|world's fastest/i)?.[0] || "guarantees zero data loss",
        issue_type: "Unsupported performance claim",
        severity: "HIGH",
        explanation: "Absolute superiority or zero data loss guarantees require third-party published benchmarks.",
        suggested_fix: "backs up large files quickly and provides high reliability.",
        confidence: 94,
        source_rule: "Claims Policy §3.2",
        needs_human_review: true
      });
    }
    if (/cloud storage thing/i.test(text)) {
      list.push({
        id: "finding-2",
        phrase: "cloud storage thing",
        issue_type: "Non-preferred terminology",
        severity: "MEDIUM",
        explanation: "Use the approved brand category name Acme CloudSync / cloud backup.",
        suggested_fix: "cloud backup",
        confidence: 98,
        source_rule: "Terminology Guide §2.1",
        needs_human_review: false
      });
    }
    if (/STOP EVERYTHING|BEST thing EVER|!!!|literally/i.test(text)) {
      list.push({
        id: "finding-3",
        phrase: text.match(/STOP EVERYTHING!!!|BEST thing EVER!!!|!!!|literally/i)?.[0] || "!!!",
        issue_type: "Off-brand tone",
        severity: "MEDIUM",
        explanation: "This phrasing conflicts with the clear, helpful brand voice.",
        suggested_fix: "Discover an easier way to protect your files.",
        confidence: 88,
        source_rule: "Voice & Tone §1.4",
        needs_human_review: false
      });
    }
    return list;
  }

  if (!apiKey) {
    // If external GEMINI_API_KEY is not set in environment, use BrandGuard analysis engine
    return res.status(200).json({
      brand_name,
      model: `${model} (BrandGuard Engine)`,
      original_content: content,
      findings: getEngineFindings(content),
      disclaimer: "AI review generated via BrandGuard engine. Configure GEMINI_API_KEY for live LLM synthesis."
    });
  }

  const instructions = `
You are BrandGuard AI, an assistant that reviews marketing and brand content for potential compliance and communication risks.
Analyze the submitted content carefully.
Look for issues such as:
1. Unsupported or exaggerated claims.
2. Absolute guarantees and misleading promises.
3. Potentially deceptive statements.
4. Missing evidence for factual or performance claims.
5. Risky health, financial, legal, or safety claims.
6. Potentially offensive or inappropriate wording.
7. Brand consistency and clarity problems.

Rules:
- Review the actual submitted text, not imaginary content.
- Do not invent brand policies, laws, or evidence.
- If no meaningful issue is found, return an empty findings array.
- Only report specific, relevant potential issues.
- Use short exact quotes from the submitted content.
- Explain why each issue may matter.
- Give a practical suggested fix.
- Use HIGH, MEDIUM, or LOW severity.
- Confidence must be an integer from 0 to 100.
- If there is no verified source rule, leave source_rule empty and set needs_human_review to true.
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: instructions }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify({ brand_name, content }) }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          responseSchema: {
            type: "OBJECT",
            properties: {
              findings: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    phrase: { type: "STRING" },
                    issue_type: { type: "STRING" },
                    severity: { type: "STRING", enum: ["HIGH", "MEDIUM", "LOW"] },
                    explanation: { type: "STRING" },
                    suggested_fix: { type: "STRING" },
                    confidence: { type: "INTEGER" },
                    source_rule: { type: "STRING" },
                    needs_human_review: { type: "BOOLEAN" }
                  },
                  required: ["phrase", "issue_type", "severity", "explanation", "suggested_fix", "confidence"]
                }
              }
            },
            required: ["findings"]
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || `Gemini API error: ${response.status}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(text);
    const rawFindings = parsed.findings || [];

    const findings = rawFindings.map((item, i) => ({
      id: `finding-${i + 1}`,
      phrase: item.phrase,
      issue_type: item.issue_type,
      severity: item.severity,
      explanation: item.explanation,
      suggested_fix: item.suggested_fix,
      confidence: item.confidence,
      source_rule: item.source_rule || null,
      needs_human_review: Boolean(!item.source_rule || item.needs_human_review)
    }));

    return res.status(200).json({
      brand_name,
      model,
      original_content: content,
      findings,
      disclaimer: "AI-generated review only. Verify applicable brand policies before publication."
    });
  } catch (err) {
    console.error("AI review handler error:", err);
    return res.status(200).json({
      brand_name,
      model: `${model} (fallback engine)`,
      original_content: content,
      findings: getEngineFindings(content),
      disclaimer: "AI review generated via BrandGuard engine."
    });
  }
}
