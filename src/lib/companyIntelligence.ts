import type { CompanyDef } from '../data/companies';
import type { CompanyEvent, StoredCompanyIntelligence } from './db';

const GENERATE_ENDPOINT = '/api/generate';

async function callProxy(prompt: string): Promise<string> {
  const response = await fetch(GENERATE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parts: [{ text: prompt }] }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText })) as { error: string };
    throw new Error(err.error || `Generation failed (HTTP ${response.status})`);
  }
  const data = await response.json() as { text: string };
  if (!data.text) throw new Error('Empty response from proxy.');
  return data.text;
}

function parseJSON(raw: string): unknown {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fence) text = fence[1].trim();
  else {
    const start = text.search(/[{[]/);
    if (start > 0) text = text.slice(start);
  }
  // LLM output sometimes contains raw backslashes (markdown/LaTeX syntax)
  // that aren't valid JSON escape sequences and crash JSON.parse.
  text = text.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
  return JSON.parse(text);
}

export async function generateCompanyIntelligence(
  company: CompanyDef,
  allConceptIds: string[],
): Promise<StoredCompanyIntelligence> {
  const conceptList = allConceptIds.join(', ');

  const prompt = `You are a business intelligence analyst creating educational content for a Global Business Studies platform.

Company: ${company.name} (${company.industry}, ${company.hq})
Description: ${company.description}
Known concept links: ${company.conceptIds.join(', ')}
Available concept IDs in our system: ${conceptList}

Task 1 — Current Events: Generate exactly 5 realistic, plausible recent news events for ${company.name} (set in 2024–2025). Each event should be educationally valuable, linking to business concepts a student would study.

Task 2 — Learning Links: Identify up to 4 additional concept IDs from the available list that are highly relevant to ${company.name} but NOT already in the known concept links.

Return ONLY valid JSON — no markdown, no commentary:
{
  "events": [
    {
      "headline": "Short news headline (max 12 words)",
      "date": "Month Year (e.g. March 2025)",
      "summary": "2-3 sentence educational summary explaining the business significance.",
      "linkedConceptIds": ["concept-id-1", "concept-id-2"],
      "impact": "positive"
    }
  ],
  "learningLinks": ["concept-id-1", "concept-id-2"]
}

Rules:
- Events must be plausible and grounded in the company's real industry/strategy
- linkedConceptIds must ONLY use IDs from the available concept IDs list
- impact must be exactly "positive", "negative", or "neutral"
- Each event should link 2-3 different concept IDs
- Cover a range of topics: strategy, finance, supply chain, marketing, international
- learningLinks must ONLY use IDs from the available concept IDs list and must NOT duplicate the known concept links`;

  const raw = await callProxy(prompt);
  const parsed = parseJSON(raw) as {
    events: Array<{
      headline: string;
      date: string;
      summary: string;
      linkedConceptIds: string[];
      impact: string;
    }>;
    learningLinks: string[];
  };

  const validConceptSet = new Set(allConceptIds);

  const events: CompanyEvent[] = (parsed.events ?? []).map(e => ({
    headline: String(e.headline ?? ''),
    date: String(e.date ?? ''),
    summary: String(e.summary ?? ''),
    linkedConceptIds: (e.linkedConceptIds ?? []).filter(id => validConceptSet.has(id)),
    impact: (['positive', 'negative', 'neutral'].includes(e.impact) ? e.impact : 'neutral') as CompanyEvent['impact'],
  }));

  const learningLinks = (parsed.learningLinks ?? [])
    .filter(id => validConceptSet.has(id))
    .filter(id => !company.conceptIds.includes(id))
    .slice(0, 4);

  return {
    id: company.id,
    generatedAt: Date.now(),
    events,
    learningLinks,
  };
}
