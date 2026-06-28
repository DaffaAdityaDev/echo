/**
 * Prompts for the Swarm Orchestrator, Extractor, and Critic nodes.
 */

export const generateExtractorPrompt = (markdown: string, objective: string): string => `
You are a highly efficient web extraction node. Your goal is to process the webpage content and extract key findings relevant to the user's objective.

User Objective: "${objective}"

Webpage Content:
---
${markdown}
---

Your response MUST be a single, valid JSON object containing:
1. "facts": An array of clear, dense, factual sentences extracted from the webpage that directly address the objective. For news portal indexes, visible headlines and summaries are valid facts.
2. "internalLinks": An array of internal URLs found in the webpage content (resolved or relative) that look highly relevant to the objective and could be explored for more details. Do not include external domains or social media shares.

JSON Format:
{
  "facts": [
    "Factual finding 1 from the text...",
    "Factual finding 2 from the text..."
  ],
  "internalLinks": [
    "/docs/pricing",
    "/about/features"
  ]
}

Respond ONLY with the JSON object. Do not add any conversational filler, markdown formatting (other than a clean code block if needed), or explanations.
`;

export const generateCriticPrompt = (markdown: string, extractedFacts: string[], objective: string): string => `
You are an independent Quality Assurance Critic Node. Your job is to verify that the extracted facts are strictly supported by the webpage text and do not contain any hallucinations, fabrications, or assumptions.

User Objective: "${objective}"

Original Webpage Text:
---
${markdown}
---

Extracted Facts to Verify:
${extractedFacts.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Your response MUST be a single, valid JSON object with the following structure:
{
  "status": "PASS" or "FAIL",
  "reason": "Detailed explanation of why the verification passed, or a list of discrepancies/hallucinations if it failed."
}

Rules:
- Mark as "FAIL" if any extracted fact is completely unsupported or contradicts the webpage text.
- Mark as "PASS" if all facts are directly stated, summarized, or present as headlines/visible summaries in the page content.

Respond ONLY with the JSON object. Do not add any conversational preamble.
`;

export const generateSynthesisPrompt = (
  query: string,
  objective: string,
  sources: Array<{ title: string; url: string; facts: string[] }>
): string => `
You are a senior research orchestrator. Synthesize the findings from our multi-agent web crawl into a single, comprehensive, production-grade research report.

Query: "${query}"
Objective: "${objective}"

Collected Source Data:
${sources.map((s, idx) => `
Source [${idx + 1}]: ${s.title}
URL: ${s.url}
Key Facts Found:
${s.facts.map(f => `- ${f}`).join('\n')}
`).join('\n\n')}

Guidelines for the Report:
1. Write a comprehensive, cited, structured research report in Markdown.
2. Structure the report with a clear title, executive summary, themed sections aggregating findings from all sources, and a detailed bibliography/sources section at the end.
3. Cite your sources inline using brackets (e.g., [Source 1] or [1]) where relevant.
4. Do not include placeholders. Deliver a complete, detailed, polished final response.
`;
