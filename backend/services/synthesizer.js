/**
 * Synthesizes a structured answer from search snippets when no LLM API key is available.
 * It identifies matching keywords and constructs paragraphs with inline citations.
 * @param {string} query The user query.
 * @param {Array<{title: string, url: string, snippet: string}>} sources Search results.
 * @returns {string} The markdown formatted answer.
 */
export function synthesizeAnswer(query, sources, options = {}) {
  if (!sources || sources.length === 0) {
    return `I searched the web for "${query}" but couldn't find any relevant results. 

Please make sure your device is connected to the internet, or try refining your search terms.`;
  }

  const cleanQuery = query.toLowerCase().trim();

  // Build a nice introductory sentence
  let intro = `Based on search results for **"${query}"**, here is a compiled summary of findings:`;

  // Group key facts from snippets
  const findings = [];
  sources.forEach((source, index) => {
    const citation = `[${index + 1}]`;
    const snippetText = source.snippet;

    // Clean snippet text slightly
    let cleanSnippet = snippetText
      .replace(/\s+/g, ' ')
      .replace(/(\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})|(\w+\s+\d{1,2},\s+\d{4})/gi, '') // Remove dates
      .trim();

    if (cleanSnippet.length > 15) {
      let domain = 'web source';
      try {
        if (source.url) domain = new URL(source.url).hostname.replace(/^www\./, '');
      } catch (e) { }

      findings.push({
        title: source.title,
        text: cleanSnippet,
        citation: citation,
        domain: domain
      });
    }
  });

  // Construct structured Markdown answer
  let answerMarkdown = `${intro}\n\n`;

  if (findings.length > 0) {
    // Section 1: Overview
    answerMarkdown += `### Overview & Key Findings\n`;
    const overviewItems = findings.slice(0, 3).map(f => {
      return `${f.text} (sourced from *${f.domain}* ${f.citation}).`;
    });
    answerMarkdown += `${overviewItems.join(' ')}\n\n`;

    // Section 2: Detailed Points
    answerMarkdown += `### Detailed Details\n`;
    findings.forEach((f, i) => {
      answerMarkdown += `- **${f.title}**: ${f.text} ${f.citation}\n`;
    });
    answerMarkdown += `\n`;

    // Section 3: Note
    answerMarkdown += `### Note\n`;
    answerMarkdown += `> [!NOTE]\n`;
    if (options.rateLimited) {
      answerMarkdown += `> Gemini API quota/rate limit reached. This summary was synthesized directly from real-time search results.\n`;
    } else {
      answerMarkdown += `> This summary was synthesized directly from search result snippets. Please verify your network connection to receive the full detailed AI search report.\n`;
    }

    // Add structured related questions block customized to the query
    const qSubject = query.trim().replace(/\?$/, '');
    answerMarkdown += `\n<related>\n`;
    answerMarkdown += `- What are the latest updates and future outlook for ${qSubject}?\n`;
    answerMarkdown += `- Can you explain the key concepts and mechanisms of ${qSubject} in detail?\n`;
    answerMarkdown += `- What are the practical applications and real-world examples of ${qSubject}?\n`;
    answerMarkdown += `</related>\n`;
  } else {
    const qSubject = query.trim().replace(/\?$/, '');
    answerMarkdown += `I found some sources related to your query, but could not extract enough clean text to summarize them. Please check the source links above or enter an API key in **Settings** for a full AI response.\n`;
    answerMarkdown += `\n<related>\n`;
    answerMarkdown += `- Search again with more specific terms about ${qSubject}\n`;
    answerMarkdown += `- Tell me how to configure API keys for deeper research\n`;
    answerMarkdown += `</related>\n`;
  }

  return answerMarkdown;
}

/**
 * Simulates text streaming for the synthetic response.
 * @param {string} text The full text to stream.
 * @param {Function} onChunk Callback invoked with each text chunk.
 * @returns {Promise<void>} Resolves when streaming is complete.
 */
export async function simulateStreaming(text, onChunk) {
  const words = text.split(' ');
  // Group words into chunks of 3-5 words
  let i = 0;
  while (i < words.length) {
    const chunkSize = Math.floor(Math.random() * 3) + 2; // 2 to 4 words
    const chunk = words.slice(i, i + chunkSize).join(' ') + ' ';
    onChunk(chunk);
    i += chunkSize;
    // Sleep for 50-100ms to simulate typing
    await new Promise(resolve => setTimeout(resolve, 40 + Math.random() * 60));
  }
}
