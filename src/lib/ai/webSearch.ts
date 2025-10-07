const SEARCH_TAG_REGEX = /\[\[(?:search|web):([^\]]+)\]\]/gi;
const INLINE_SEARCH_REGEX = /^(?:search|web)\s*:(.*)$/i;

export function parseSearchDirectives(input: string) {
  const queries: string[] = [];
  let sanitized = input.replace(SEARCH_TAG_REGEX, (_, raw) => {
    const query = String(raw).trim();
    if (query) {
      queries.push(query);
    }
    return ' ';
  }).replace(/\s{2,}/g, ' ').trim();

  if (queries.length === 0) {
    const inlineMatch = input.match(INLINE_SEARCH_REGEX);
    if (inlineMatch) {
      const inlineQuery = inlineMatch[1]?.trim();
      if (inlineQuery) {
        queries.push(inlineQuery);
        sanitized = '';
      }
    }
  }

  return {
    sanitized,
    queries,
  };
}

type GoogleCseResponse = {
  items?: Array<{
    title?: string;
    link?: string;
    snippet?: string;
  }>;
};

type WebPageSummary = {
  title: string;
  url: string;
  snippet?: string;
  content: string;
};

async function fetchPageContent(url: string): Promise<string> {
  if (__DEV__) {
    console.log('[WebSearch] Fetching page', url);
  }
  try {
    const response = await fetch(url, { headers: { Accept: 'text/html,application/xhtml+xml,application/xml' } });
    if (__DEV__) {
      console.log('[WebSearch] Page response', { url, status: response.status, ok: response.ok });
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const html = await response.text();
    return sanitizeHtml(html);
  } catch (err: any) {
    console.warn('[WebSearch] Failed to fetch page', url, err);
    throw err;
  }
}

function sanitizeHtml(html: string): string {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  const text = withoutScripts
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return text.length > 4000 ? `${text.slice(0, 4000)}…` : text;
}

export async function searchGoogleCustom(query: string, config: { apiKey: string; cx: string; fetchPages?: boolean; maxPages?: number }): Promise<{ summary: string; pages: WebPageSummary[] }> {
  const { apiKey, cx } = config;
  if (!apiKey || !cx) {
    throw new Error('Google Custom Search API key or CX is missing.');
  }

  const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}`;
  const requestInit: RequestInit = { headers: { Accept: 'application/json' } };
  if (__DEV__) {
    console.log('[WebSearch] Request', { url, ...requestInit });
  }

  const response = await fetch(url, requestInit);
  if (__DEV__) {
    console.log('[WebSearch] Response', { url, status: response.status, ok: response.ok });
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Custom Search failed with status ${response.status}: ${text}`);
  }

  const data = (await response.json()) as GoogleCseResponse;
  const items = data.items ?? [];

  const lines = items.slice(0, 5).map((item, index) => {
    const title = item.title?.trim() ?? 'Untitled result';
    const snippet = item.snippet?.trim() ?? '';
    const urlText = item.link ? ` — ${item.link}` : '';
    const detail = snippet ? `\n   ${snippet}` : '';
    return `${index + 1}. ${title}${urlText}${detail}`;
  });

  if (lines.length === 0) {
    lines.push('No relevant results found.');
  }

  let pages: WebPageSummary[] = [];
  if (config.fetchPages) {
    const maxPages = Math.max(1, config.maxPages ?? 3);
    const topItems = items.slice(0, maxPages).filter((item) => !!item.link);
    if (__DEV__) {
      console.log('[WebSearch] Fetching page content', { count: topItems.length });
    }
    pages = await Promise.all(
      topItems.map(async (item) => {
        const url = String(item.link);
        try {
          const content = await fetchPageContent(url);
          return {
            title: item.title?.trim() ?? url,
            url,
            snippet: item.snippet,
            content,
          } satisfies WebPageSummary;
        } catch (err) {
          return {
            title: item.title?.trim() ?? url,
            url,
            snippet: item.snippet,
            content: `Failed to retrieve content: ${err instanceof Error ? err.message : String(err)}`,
          } satisfies WebPageSummary;
        }
      })
    );
  }

  return {
    summary: `Web search results for "${query}":\n${lines.join('\n')}`.trim(),
    pages,
  };
}
