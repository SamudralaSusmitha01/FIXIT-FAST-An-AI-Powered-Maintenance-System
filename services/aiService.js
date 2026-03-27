const OpenAI = require('openai');

// Lazy initialize — only create client when actually needed
// This prevents crash on startup if key is missing/test value
let openaiClient = null;

function getClient() {
  if (!openaiClient) {
    const key = process.env.OPENAI_API_KEY;
    if (!key || key === 'test') {
      return null; // return null when no real key
    }
    openaiClient = new OpenAI({ apiKey: key });
  }
  return openaiClient;
}

/**
 * Analyze a maintenance request using GPT-4o
 * Returns structured diagnosis: severity, cost estimate, recommendation
 */
async function diagnoseMaintenance({ title, description, category, location, mediaUrls = [] }) {
  const client = getClient();

  // If no real OpenAI key, return a mock diagnosis for testing
  if (!client) {
    return getMockDiagnosis(category);
  }

  const imageContent = mediaUrls.slice(0, 3).map(url => ({
    type: 'image_url',
    image_url: { url, detail: 'auto' },
  }));

  const userContent = [
    {
      type: 'text',
      text: `You are an expert property maintenance diagnostician. Analyze this maintenance request and return a structured JSON diagnosis.

MAINTENANCE REQUEST:
- Title: ${title}
- Category: ${category}
- Location in unit: ${location}
- Description: ${description}

${mediaUrls.length > 0 ? `${mediaUrls.length} photo(s) attached for visual analysis.` : 'No photos provided.'}

Return ONLY valid JSON in this exact format:
{
  "severity": "low" | "medium" | "high" | "critical",
  "summary": "1-2 sentence plain-English summary of the issue",
  "recommendation": "Specific action the landlord should take",
  "estimatedCost": { "min": number, "max": number, "currency": "USD" },
  "estimatedTime": "e.g. 1-2 hours or 3-5 days",
  "confidence": number between 0-100,
  "suggestedCategory": "most accurate category",
  "safetyRisk": true | false,
  "reasoning": "Brief internal reasoning (1-2 sentences)"
}

Severity guide:
- critical: Immediate danger (gas leak, flooding, electrical fire risk)
- high: Significant damage if untreated within 24-48h
- medium: Should be addressed within 1-2 weeks
- low: Cosmetic or minor — within 30 days is fine`
    },
    ...imageContent,
  ];

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: userContent }],
    max_tokens: 600,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0].message.content;
  const parsed = JSON.parse(raw);

  return {
    severity:          ['low','medium','high','critical'].includes(parsed.severity) ? parsed.severity : 'medium',
    summary:           parsed.summary || 'Issue requires attention.',
    recommendation:    parsed.recommendation || 'Schedule a professional inspection.',
    estimatedCost: {
      min:      Number(parsed.estimatedCost?.min) || 0,
      max:      Number(parsed.estimatedCost?.max) || 500,
      currency: 'USD',
    },
    estimatedTime:     parsed.estimatedTime || 'To be assessed',
    confidence:        Math.min(100, Math.max(0, Number(parsed.confidence) || 75)),
    suggestedCategory: parsed.suggestedCategory || category,
    safetyRisk:        Boolean(parsed.safetyRisk),
    analyzedAt:        new Date(),
  };
}

/**
 * Generate predictive maintenance insights for a landlord
 */
async function generateInsights(requestHistory) {
  const client = getClient();

  if (!client) {
    return getMockInsights();
  }

  const summary = requestHistory.map(r =>
    `${r.category}: ${r.title} (${r.status}, ${r.priority} priority, cost: $${r.actualCost || 'N/A'})`
  ).join('\n');

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: `You are a property maintenance AI advisor. Based on this request history, identify patterns and provide 3 actionable insights in JSON format.

History:
${summary}

Return JSON:
{
  "insights": [
    { "type": "warning|saving|optimization", "title": "short title", "description": "2-3 sentences", "estimatedSaving": number or null }
  ]
}`
    }],
    max_tokens: 500,
    temperature: 0.4,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0].message.content;
  return JSON.parse(raw).insights || [];
}

// ── Mock responses for testing without OpenAI key ──────────────────────
function getMockDiagnosis(category) {
  const mocks = {
    plumbing:   { severity: 'high',   summary: 'Active plumbing leak detected. Immediate attention required to prevent water damage.', recommendation: 'Dispatch licensed plumber within 24 hours.', estimatedCost: { min: 150, max: 400, currency: 'USD' }, estimatedTime: '2-3 hours' },
    electrical: { severity: 'high',   summary: 'Electrical fault detected. Safety risk if left unaddressed.', recommendation: 'Schedule licensed electrician immediately.', estimatedCost: { min: 100, max: 350, currency: 'USD' }, estimatedTime: '1-2 hours' },
    hvac:       { severity: 'medium', summary: 'HVAC system showing reduced efficiency. Service recommended soon.', recommendation: 'Schedule HVAC technician within 1 week.', estimatedCost: { min: 200, max: 500, currency: 'USD' }, estimatedTime: '2-4 hours' },
    structural: { severity: 'medium', summary: 'Structural issue detected. Monitor and assess soon.', recommendation: 'Schedule structural inspection within 2 weeks.', estimatedCost: { min: 300, max: 1000, currency: 'USD' }, estimatedTime: '1-2 days' },
    appliance:  { severity: 'low',    summary: 'Appliance malfunction reported. Non-urgent repair needed.', recommendation: 'Schedule appliance repair within 2 weeks.', estimatedCost: { min: 80, max: 250, currency: 'USD' }, estimatedTime: '1-2 hours' },
    other:      { severity: 'low',    summary: 'General maintenance issue reported.', recommendation: 'Schedule inspection within 30 days.', estimatedCost: { min: 50, max: 200, currency: 'USD' }, estimatedTime: '1-3 hours' },
  };

  const base = mocks[category] || mocks.other;
  return { ...base, confidence: 72, suggestedCategory: category, safetyRisk: base.severity === 'high', analyzedAt: new Date() };
}

function getMockInsights() {
  return [
    { type: 'warning',      title: 'Recurring Plumbing Issues', description: 'Plumbing issues are recurring frequently. Consider a full pipe inspection to identify root causes.', estimatedSaving: 960 },
    { type: 'saving',       title: 'Preventive HVAC Maintenance', description: 'Scheduling preventive HVAC service can avoid costly emergency repairs.', estimatedSaving: 600 },
    { type: 'optimization', title: 'Top Vendor Performing Well', description: 'Your top vendor has a 96% satisfaction rate. Prioritize them for urgent repairs.', estimatedSaving: null },
  ];
}

module.exports = { diagnoseMaintenance, generateInsights };