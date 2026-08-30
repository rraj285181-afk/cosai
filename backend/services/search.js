import * as cheerio from 'cheerio';

function cleanBingUrl(url) {
  if (!url) return '';
  if (url.includes('&u=')) {
    try {
      let rawU = url.split('&u=')[1].split('&')[0];
      try { rawU = decodeURIComponent(rawU); } catch (e) {}
      let encoded = rawU;
      if (encoded.startsWith('a1')) encoded = encoded.substring(2);
      // Fix: Bing uses base64url encoding — replace base64url chars before decoding
      const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
        return decoded;
      }
    } catch (e) {}
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return '';
}

/**
 * Decodes DuckDuckGo redirect URL to extract the direct destination URL.
 */
function cleanDdgUrl(url) {
  if (!url) return '';
  let cleanUrl = url.trim();

  if (cleanUrl.startsWith('//')) {
    cleanUrl = 'https:' + cleanUrl;
  } else if (cleanUrl.startsWith('/')) {
    cleanUrl = 'https://duckduckgo.com' + cleanUrl;
  }

  if (cleanUrl.includes('uddg=')) {
    try {
      const parts = cleanUrl.split('?');
      if (parts.length > 1) {
        const params = new URLSearchParams(parts[1]);
        const uddg = params.get('uddg');
        if (uddg) return decodeURIComponent(uddg);
      }
    } catch (e) {
      console.error('Error parsing DDG redirect URL:', cleanUrl, e);
    }
  }

  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    return '';
  }

  return cleanUrl;
}

/**
 * High-reliability Bing Web Scraper for live accurate web search results
 */
async function scrapeBingWeb(query) {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en-US`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8'
      }
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const $ = cheerio.load(html);
    const results = [];

    $('#b_results > li.b_algo').each((i, el) => {
      const aNode = $(el).find('h2 a').first();
      const snippetNode = $(el).find('.b_caption p, .b_algoSlug, p').first();
      const title = aNode.text().trim();
      const rawUrl = aNode.attr('href');
      const snippet = snippetNode.text().trim();

      if (title && rawUrl) {
        const cleaned = cleanBingUrl(rawUrl);
        if (cleaned && !cleaned.includes('bing.com/')) {
          results.push({
            title: title,
            url: cleaned,
            snippet: snippet || 'No snippet available.'
          });
        }
      }
    });

    return results;
  } catch (e) {
    console.warn('Bing Web search notice:', e.message || e);
    return [];
  }
}

async function scrapeDdgLite(searchTerms) {
  try {
    const response = await fetch('https://lite.duckduckgo.com/lite/', {
      method: 'POST',
      signal: AbortSignal.timeout(6000),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8'
      },
      body: `q=${encodeURIComponent(searchTerms)}`
    });

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    $('a.result-link').each((i, el) => {
      if (results.length >= 10) return false;
      const title = $(el).text().trim();
      const rawUrl = $(el).attr('href');
      const parentTr = $(el).closest('tr');
      const snippetTr = parentTr.next('tr');
      // DDG Lite puts snippet text directly in the td, not in a .result-snippet child
      const snippet = snippetTr.find('td').text().trim();

      if (title && rawUrl) {
        const cleanedUrl = cleanDdgUrl(rawUrl);
        if (cleanedUrl && !cleanedUrl.includes('duckduckgo.com/')) {
          results.push({
            title: title,
            url: cleanedUrl,
            snippet: snippet || 'No description available.'
          });
        }
      }
    });

    return results;
  } catch (e) {
    return [];
  }
}

async function scrapeGoogleFallback(searchTerms) {
  try {
    // &num=10 requests 10 results; gbv=1 no longer works, use hl=en for English
    const url = `https://www.google.com/search?q=${encodeURIComponent(searchTerms)}&num=10&hl=en`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8'
      }
    });

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    // Modern Google result containers: div.g, div.MjjYud, div.Gx5Zad
    $('div.g, div.MjjYud, div.Gx5Zad, div.tF2Cxc').each((i, el) => {
      if (results.length >= 10) return false;
      const aNode = $(el).find('a[href]').first();
      const titleNode = $(el).find('h3').first();
      // Try multiple known snippet selectors across Google's changing markup
      const snippetNode = $(el).find('div.VwiC3b, div.BNeawe, span.st, div.s, div[data-sncf]').first();

      const title = titleNode.text().trim() || aNode.text().trim();
      let rawUrl = aNode.attr('href') || '';

      if (rawUrl.startsWith('/url?q=')) {
        rawUrl = rawUrl.replace('/url?q=', '').split('&')[0];
        try { rawUrl = decodeURIComponent(rawUrl); } catch (e) { }
      }

      const snippet = snippetNode.text().trim();

      if (title && rawUrl && rawUrl.startsWith('http') && !rawUrl.includes('google.com/')) {
        results.push({
          title: title,
          url: rawUrl,
          snippet: snippet || 'No description available.'
        });
      }
    });

    return results;
  } catch (e) {
    return [];
  }
}

async function scrapeSingleQuery(searchTerms) {
  // Primary: Bing Web Search (Highly reliable, unblocked, 10+ detailed results)
  const bingResults = await scrapeBingWeb(searchTerms);
  if (bingResults.length > 0) return bingResults;

  // Fallback 1: DuckDuckGo Lite
  const liteResults = await scrapeDdgLite(searchTerms);
  if (liteResults.length > 0) return liteResults;

  // Fallback 2: Google Search
  const googleResults = await scrapeGoogleFallback(searchTerms);
  if (googleResults.length > 0) return googleResults;

  return [];
}

/**
 * Scrapes live web search results with parallel multi-query expansion.
 * @param {string} query The search query.
 * @param {string} focus The focus area (all, academic, news, etc.).
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>}
 */
export async function performWebSearch(query, focus = 'all', connectedApps = []) {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) return [];

  // Construct parallel search query variants to cover all angles across the web
  const searchQueries = [cleanQuery];

  if (focus === 'academic') {
    searchQueries[0] = `${cleanQuery} (site:arxiv.org OR site:nih.gov OR site:nature.com OR site:science.org OR site:ieee.org OR site:scholar.google.com OR site:wikipedia.org)`;
    searchQueries.push(`${cleanQuery} research paper methodology`);
  } else if (focus === 'news') {
    searchQueries[0] = `${cleanQuery} (site:reuters.com OR site:apnews.com OR site:bbc.co.uk OR site:bbc.com OR site:nytimes.com OR site:bloomberg.com)`;
    searchQueries.push(`${cleanQuery} latest news updates`);
  } else {
    // Standard search: add a secondary query for better coverage and diversity of results
    searchQueries.push(`${cleanQuery} explained overview`);
  }

  try {
    const searchPromises = searchQueries.map(q => scrapeSingleQuery(q));
    const searchSettled = await Promise.allSettled(searchPromises);

    const rawResults = [];
    searchSettled.forEach(res => {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        rawResults.push(...res.value);
      }
    });

    // Deduplicate results by clean URL
    const seenUrls = new Set();
    const uniqueResults = [];

    for (const item of rawResults) {
      if (!item.url) continue;
      let normUrl = item.url.split('?')[0].split('#')[0].toLowerCase().trim().replace(/\/$/, '');
      if (!seenUrls.has(normUrl)) {
        seenUrls.add(normUrl);
        uniqueResults.push(item);
      }
      if (uniqueResults.length >= 15) break;
    }

    return uniqueResults;
  } catch (error) {
    console.warn('Error during web search scrape:', error.message || error);
    return [];
  }
}

/**
 * Perform image search for a given query
 * @param {string} query
 * @returns {Promise<Array<{title: string, image: string, thumbnail: string, url: string}>>}
 */
/**
 * Perform multi-sourced query-accurate image search
 * @param {string} query
 * @returns {Promise<Array<{title: string, image: string, thumbnail: string, url: string}>>}
 */
export async function performImageSearch(query) {
  const images = [];
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) return [];

  // 1. Wikimedia Commons API for real accurate search photos
  try {
    const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanQuery)}&gsrnamespace=6&prop=pageimages|info&piprop=thumbnail|original&pithumbsize=600&inprop=url&format=json`;
    const wikiResp = await fetch(wikiUrl, {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'InsightAI/1.0 (contact@insightai.org)' }
    });
    if (wikiResp.ok) {
      const data = await wikiResp.json();
      if (data.query && data.query.pages) {
        const pages = Object.values(data.query.pages);
        pages.forEach(p => {
          if (p.thumbnail && p.thumbnail.source) {
            const titleClean = p.title.replace(/^File:/, '').replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
            images.push({
              title: titleClean,
              image: (p.original && p.original.source) ? p.original.source : p.thumbnail.source,
              thumbnail: p.thumbnail.source,
              url: p.canonicalurl || p.fullurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`
            });
          }
        });
      }
    }
  } catch (e) {
    console.warn('Wikimedia image search notice:', e.message || e);
  }

  // 2. Unsplash Source API — no auth required, query-driven, always works
  if (images.length < 5) {
    try {
      const unsplashKeywords = cleanQuery.replace(/\s+/g, ',');
      const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
      seeds.forEach((seed, i) => {
        images.push({
          title: `${cleanQuery} (Photo ${i + 1})`,
          image: `https://source.unsplash.com/800x600/?${encodeURIComponent(cleanQuery)}&sig=${seed}`,
          thumbnail: `https://source.unsplash.com/400x300/?${encodeURIComponent(cleanQuery)}&sig=${seed}`,
          url: `https://unsplash.com/s/photos/${encodeURIComponent(unsplashKeywords)}`
        });
      });
    } catch (e) {
      console.warn('Unsplash image search notice:', e.message || e);
    }
  }

  // 3. Fallback: Pollinations.ai AI-generated concept images (correct /prompt/ path)
  if (images.length === 0) {
    images.push(
      {
        title: `${cleanQuery} - Concept Overview`,
        image: `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQuery + ' overview photo')}?width=800&height=600&nologo=true&seed=101`,
        thumbnail: `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQuery + ' overview photo')}?width=400&height=300&nologo=true&seed=101`,
        url: `https://google.com/search?q=${encodeURIComponent(cleanQuery)}&tbm=isch`
      },
      {
        title: `${cleanQuery} - Detailed Visualization`,
        image: `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQuery + ' infographic diagram')}?width=800&height=600&nologo=true&seed=202`,
        thumbnail: `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQuery + ' infographic diagram')}?width=400&height=300&nologo=true&seed=202`,
        url: `https://google.com/search?q=${encodeURIComponent(cleanQuery)}&tbm=isch`
      },
      {
        title: `${cleanQuery} - Structural Diagram`,
        image: `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQuery + ' structure chart')}?width=800&height=600&nologo=true&seed=303`,
        thumbnail: `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQuery + ' structure chart')}?width=400&height=300&nologo=true&seed=303`,
        url: `https://google.com/search?q=${encodeURIComponent(cleanQuery)}&tbm=isch`
      },
      {
        title: `${cleanQuery} - Context View`,
        image: `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQuery + ' application context')}?width=800&height=600&nologo=true&seed=404`,
        thumbnail: `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanQuery + ' application context')}?width=400&height=300&nologo=true&seed=404`,
        url: `https://google.com/search?q=${encodeURIComponent(cleanQuery)}&tbm=isch`
      }
    );
  }

  // Deduplicate by image URL
  const seen = new Set();
  const uniqueImages = [];
  for (const img of images) {
    if (img.image && !seen.has(img.image)) {
      seen.add(img.image);
      uniqueImages.push(img);
    }
    if (uniqueImages.length >= 12) break;
  }

  return uniqueImages;
}


