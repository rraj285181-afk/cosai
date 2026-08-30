/**
 * Scrapes text content and metadata from a given URL.
 * @param {string} url 
 * @returns {Promise<{title: string, content: string, url: string}>}
 */
export async function scrapeUrlContent(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL. Status: ${response.status}`);
    }

    const html = await response.text();

    // Extract Title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Webpage Content';

    // Strip scripts, styles, and tags for clean text content
    let cleanText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Cap text to 10,000 characters to fit in context window
    if (cleanText.length > 10000) {
      cleanText = cleanText.substring(0, 10000) + '... [Content truncated]';
    }

    return {
      title,
      content: cleanText,
      url
    };
  } catch (error) {
    console.error('URL Scrape Error:', error);
    throw error;
  }
}
