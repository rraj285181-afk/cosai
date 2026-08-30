// Determine backend API base URL based on running environment
export const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');


/**
 * Searches the web using the backend proxy scraper.
 * @param {string} query The search query.
 * @param {string} focus The focus area (all, academic, news).
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>}
 */
export async function searchWeb(query, focus = 'all', connectedApps = []) {
  const appIds = Array.isArray(connectedApps) ? connectedApps.join(',') : (connectedApps || '');
  const appsParam = appIds ? `&apps=${encodeURIComponent(appIds)}` : '';
  const url = `${API_BASE}/api/search?q=${encodeURIComponent(query)}&focus=${focus}${appsParam}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Search failed with status: ${response.status}`);
      }
      const data = await response.json();
      return data.sources || [];
    } catch (error) {
      if (attempt === 2) {
        console.error('Error in searchWeb:', error);
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return [];
}

export async function searchImages(query) {
  try {
    const response = await fetch(`${API_BASE}/api/images?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`Image search failed with status: ${response.status}`);
    }
    const data = await response.json();
    return data.images || [];
  } catch (error) {
    console.error('Error in searchImages:', error);
    return [];
  }
}

export async function scrapeUrl(url) {
  try {
    const response = await fetch(`${API_BASE}/api/scrape-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!response.ok) {
      throw new Error(`Scrape failed with status: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error in scrapeUrl:', error);
    throw error;
  }
}

export async function fetchYouTubeTranscript(url) {
  try {
    const response = await fetch(`${API_BASE}/api/youtube-transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || `YouTube transcript failed with status: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error in fetchYouTubeTranscript:', error);
    throw error;
  }
}

/**
 * Streams the AI response from the backend server.
 * @param {Array<{role: string, content: string}>} messages Chat message history.
 * @param {Array<{title: string, url: string, snippet: string}>} sources Retrieved search sources.
 * @param {string} focus Current focus mode.
 * @param {Function} onChunk Callback called with each text chunk.
 * @param {Function} onDone Callback called when stream ends.
 * @param {Function} onError Callback called on network or server error.
 * @param {Array} attachedFiles List of attached documents/images.
 * @param {string} model Current AI model.
 * @param {string} persona Current AI persona.
 */
export async function streamAnswer(
  messages,
  sources,
  focus,
  onChunk,
  onDone,
  onError,
  attachedFiles = [],
  model = 'gemini',
  persona = 'general'
) {
  try {
    const headers = {
      'Content-Type': 'application/json'
    };

    const savedGeminiKey = localStorage.getItem('gemini_api_key') || localStorage.getItem('x-gemini-key');
    const savedOpenAIKey = localStorage.getItem('openai_api_key') || localStorage.getItem('x-openai-key');
    if (savedGeminiKey) headers['x-gemini-key'] = savedGeminiKey;
    if (savedOpenAIKey) headers['x-openai-key'] = savedOpenAIKey;

    const response = await fetch(`${API_BASE}/api/answer`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        messages,
        sources,
        focus,
        attachedFiles,
        model,
        persona
      })
    });

    if (!response.ok) {
      throw new Error(`Answer request failed with status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('ReadableStream is not supported by the response.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      onChunk(chunk);
    }

    onDone();
  } catch (error) {
    console.error('Error in streamAnswer:', error);
    onError(error);
  }
}
