import * as cheerio from 'cheerio';

function cleanBingUrl(url) {
  if (!url) return '';
  if (url.includes('&u=')) {
    try {
      const uParam = url.split('&u=')[1].split('&')[0];
      let encoded = uParam;
      if (encoded.startsWith('a1')) encoded = encoded.substring(2);
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
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

async function scrapeBingWeb(query) {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en-US`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
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
    console.error('Bing Web error:', e.message);
    return [];
  }
}

async function test(query) {
  console.log(`\n=== Testing: "${query}" ===`);
  const res = await scrapeBingWeb(query);
  console.log(`Found ${res.length} search results:`);
  res.slice(0, 3).forEach((item, idx) => {
    console.log(` ${idx + 1}. Title: ${item.title}`);
    console.log(`    URL: ${item.url}`);
    console.log(`    Snippet: ${item.snippet.substring(0, 100)}...`);
  });
}

async function run() {
  await test('vhdl kya hai');
  await test('what is quantum computing');
  await test('react js tutorial');
  await test('narendra modi latest news');
}

run();
