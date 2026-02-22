export const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
export const DEFAULT_MAX_INPUT_CHARS = 20000;

const DEFAULT_SYSTEM_PROMPT = [
  'You are a technical research summarizer.',
  'Return Markdown only.',
  'Write deep, elaborative notes focused on factual learnings, methods, instructions, and concrete concepts.',
  'Exclude personal details, anecdotes, and opinions unless they are essential facts in the source.',
  'Do not invent information. If content is missing, say so briefly.',
  'Use a wiki-like structure with clear sections chosen from the source itself, not a fixed template.',
  'Use Mermaid flowcharts in fenced ```mermaid blocks for workflows and decision loops.',
  'Never include prose outside the requested Markdown document.'
].join(' ');

function buildUserPrompt(article, promptOverride) {
  if (promptOverride && String(promptOverride).trim()) {
    return `${String(promptOverride).trim()}\n\nSource URL: ${article.url}\nTitle: ${article.title}\nCaptured at: ${article.capturedAt}\n\nContent:\n${article.content}`;
  }

  return [
    `Source URL: ${article.url}`,
    `Title: ${article.title}`,
    `Captured at: ${article.capturedAt}`,
    '',
    'Create a wiki-style Markdown summary whose section headings are inferred from the article’s actual themes and structure.',
    'Do not force predetermined headings.',
    '',
    'Formatting constraints:',
    '- Use Markdown headings, bullets, and horizontal separators where helpful.',
    '- Add Mermaid diagrams only when a process/loop/decision exists in source.',
    '- If the source has multiple distinct workflows, include multiple diagrams; if none exist, do not add diagrams.',
    '- Keep output factual, deep, and non-personal.',
    '- Do not include implementation details that are not in the source.',
    '',
    'Content:',
    article.content
  ].join('\n');
}

function extractMessageContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item.text === 'string') return item.text;
      return '';
    })
    .join('\n')
    .trim();
}

export async function summarizeArticleAsMarkdown({
  apiKey,
  model = DEFAULT_OPENAI_MODEL,
  promptOverride = '',
  article,
  fetchImpl = globalThis.fetch
}) {
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error('OpenAI API key is missing. Set it in Preferences.');
  }

  if (!article || !article.content || !String(article.content).trim()) {
    throw new Error('No article content available for summarization.');
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch API is not available in this environment.');
  }

  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${String(apiKey).trim()}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(article, promptOverride) }
      ]
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || `OpenAI request failed (${response.status}).`;
    throw new Error(message);
  }

  const content = extractMessageContent(data?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error('OpenAI returned an empty summary.');
  }

  return content;
}
