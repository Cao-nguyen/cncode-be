/**
 * Tìm kiếm web đơn giản qua DuckDuckGo HTML (không cần API key)
 */

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'text/html',
};

function decodeDdgUrl(href) {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  try {
    const match = href.match(/uddg=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch {
    // ignore
  }
  return href;
}

function stripHtml(text) {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDdgHtml(html) {
  const results = [];

  const blockRegex = /class="result__body"[\s\S]*?(?=class="result__body"|class="nav-link"|$)/g;
  const blocks = html.match(blockRegex) || [];

  for (const block of blocks) {
    const titleMatch = block.match(/class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)
      || block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/div>/);

    if (!titleMatch) continue;

    const title = stripHtml(titleMatch[2]);
    const url = decodeDdgUrl(titleMatch[1]);
    const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : '';

    if (title && url) {
      results.push({ title, url, snippet });
    }
  }

  return results;
}

async function searchWeb(query, limit = 5) {
  if (!query?.trim()) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query.trim())}`,
      { headers: FETCH_HEADERS, signal: controller.signal },
    );

    if (!response.ok) return [];

    const html = await response.text();
    return parseDdgHtml(html).slice(0, limit);
  } catch (error) {
    console.error('[web-search] DuckDuckGo search failed:', error?.message || error);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function searchMultipleQueries(queries, limitPerQuery = 4) {
  const uniqueQueries = [...new Set(queries.map((q) => q.trim()).filter(Boolean))].slice(0, 4);
  const allResults = [];
  const seenUrls = new Set();

  for (const query of uniqueQueries) {
    const results = await searchWeb(query, limitPerQuery);
    for (const item of results) {
      if (seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      allResults.push({ ...item, query });
    }
  }

  return allResults.slice(0, 12);
}

function formatSearchResultsForPrompt(results) {
  if (!results.length) {
    return 'Không tìm thấy kết quả tìm kiếm web phù hợp.';
  }

  return results
    .map((item, index) => {
      const parts = [`${index + 1}. **${item.title}**`, `   URL: ${item.url}`];
      if (item.query) parts.push(`   Từ khóa: ${item.query}`);
      if (item.snippet) parts.push(`   Mô tả: ${item.snippet}`);
      return parts.join('\n');
    })
    .join('\n\n');
}

module.exports = {
  searchWeb,
  searchMultipleQueries,
  formatSearchResultsForPrompt,
};
