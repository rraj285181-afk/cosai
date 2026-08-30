import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import multer from 'multer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

import { performWebSearch, performImageSearch } from './services/search.js';
import { synthesizeAnswer, simulateStreaming } from './services/synthesizer.js';
import { scrapeUrlContent } from './services/scraper.js';
import { getYouTubeTranscript, extractYouTubeId } from './services/youtube.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
if (!process.env.GEMINI_API_KEY) {
  dotenv.config({ path: path.join(__dirname, '../.env') });
}

const app = express();
const PORT = process.env.PORT || 3001;
// Limit uploads to 15MB to prevent memory leaks and exhaustion attacks
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Serve static assets from frontend build directory
app.use(express.static(path.join(__dirname, '../frontend/dist')));

/**
 * Endpoint to scrape a URL
 * POST /api/scrape-url
 */
app.post('/api/scrape-url', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const scraped = await scrapeUrlContent(url);
    res.json({ success: true, data: scraped });
  } catch (error) {
    console.error('API Scrape URL Error:', error);
    res.status(500).json({ error: 'Failed to scrape webpage' });
  }
});

/**
 * Endpoint to fetch YouTube Transcript
 * POST /api/youtube-transcript
 */
app.post('/api/youtube-transcript', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'YouTube URL or Video ID is required' });
  }

  try {
    const transcriptData = await getYouTubeTranscript(url);
    res.json({ success: true, data: transcriptData });
  } catch (error) {
    console.error('API YouTube Transcript Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch YouTube transcript' });
  }
});

/**
 * Endpoint to run web search
 * GET /api/search?q=query&focus=focus
 */
app.get('/api/search', async (req, res) => {
  const { q, focus, apps } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const connectedAppsList = apps ? (Array.isArray(apps) ? apps : apps.split(',')) : [];
    const results = await performWebSearch(q, focus, connectedAppsList);
    res.json({ sources: results });
  } catch (error) {
    console.error('API Search Error:', error);
    res.status(500).json({ error: 'Failed to complete search query' });
  }
});

/**
 * Endpoint to run image search
 * GET /api/images?q=query
 */
app.get('/api/images', async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const images = await performImageSearch(q);
    res.json({ images });
  } catch (error) {
    console.error('API Image Search Error:', error);
    res.status(500).json({ error: 'Failed to complete image search' });
  }
});


/**
 * Endpoint to upload documents and images
 * POST /api/upload
 */
app.post('/api/upload', upload.array('files', 5), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  try {
    const parsedFiles = [];
    const imageExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();

      if (imageExts.includes(ext)) {
        // Image attachment for Vision AI
        const base64 = file.buffer.toString('base64');
        parsedFiles.push({
          filename: file.originalname,
          isImage: true,
          mimeType: file.mimetype || 'image/png',
          base64: base64
        });
      } else if (['.pdf', '.txt', '.md', '.json'].includes(ext)) {
        // Document attachment for RAG
        let text = '';
        if (ext === '.pdf' || file.mimetype === 'application/pdf') {
          try {
            const parsed = await pdfParse(file.buffer);
            text = parsed.text || '';
          } catch (pdfErr) {
            console.warn(`PDF parse notice for ${file.originalname}:`, pdfErr.message || pdfErr);
            text = `[Could not extract text from PDF: ${file.originalname}]`;
          }
        } else {
          text = file.buffer.toString('utf-8');
        }
        parsedFiles.push({ filename: file.originalname, isImage: false, text });
      } else if (['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext)) {
        // Video file attachment
        const base64 = file.buffer.toString('base64');
        parsedFiles.push({
          filename: file.originalname,
          isVideo: true,
          mimeType: file.mimetype || 'video/mp4',
          base64: base64,
          text: `[Video File Attachment: ${file.originalname} (${(file.size / (1024 * 1024)).toFixed(2)} MB)]`
        });
      } else if (['.mp3', '.wav', '.aac', '.ogg', '.m4a', '.flac'].includes(ext)) {
        // Audio file attachment
        const base64 = file.buffer.toString('base64');
        parsedFiles.push({
          filename: file.originalname,
          isAudio: true,
          mimeType: file.mimetype || 'audio/mp3',
          base64: base64,
          text: `[Audio File Attachment: ${file.originalname} (${(file.size / (1024 * 1024)).toFixed(2)} MB)]`
        });
      } else {
        return res.status(400).json({
          error: `Unsupported file type: ${file.originalname}. Supported formats: PDF, TXT, MD, JSON, PNG, JPG, WEBP, MP4, WEBM, MOV, AVI, MKV, MP3, WAV, AAC, OGG, M4A, FLAC.`
        });
      }
    }
    res.json({ files: parsedFiles });
  } catch (error) {
    console.error('Files Parsing Error:', error);
    res.status(500).json({ error: 'Failed to parse uploaded files' });
  }
});

/**
 * Endpoint to expand a query into sub-queries for Pro Mode
 * POST /api/pro-queries
 */
app.post('/api/pro-queries', async (req, res) => {
  const { q } = req.body;
  const clientGeminiKey = req.headers['x-gemini-key'];
  const geminiKey = clientGeminiKey || process.env.GEMINI_API_KEY;

  if (!q) {
    return res.status(400).json({ error: 'Query is required' });
  }

  const proSearchPrompt = `Given the user search query: "${q}", generate exactly 3 distinct, optimized, and concise search queries to run in parallel to gather comprehensive information.
Output them strictly as a plain text list, with one query per line. Do not include query numbers, bullets, headers, or quotes. Just the plain queries.`;

  if (geminiKey) {
    const proCandidateModels = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
    const genAI = new GoogleGenerativeAI(geminiKey);

    for (const modelName of proCandidateModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(proSearchPrompt);
        const text = result.response.text();
        const queries = text.split('\n')
          .map(l => l.trim().replace(/^[\d\.\-\*\s"']+|["']+$|^query\s*\d*:\s*/gi, '').trim())
          .filter(l => l.length > 0)
          .slice(0, 3);
        if (queries.length > 0) {
          return res.json({ queries });
        }
      } catch (e) {
        // Quietly failover to programatic split or next candidate model
      }
    }
  }

  // Fallback: Programmatic split
  const queries = [
    q,
    `${q} detailed explanation`,
    `${q} overview latest news`
  ];
  res.json({ queries });
});


// Helper to retrieve the most relevant chunks from files using a simple TF-IDF keyword scorer
function performLocalRag(query, files, topK = 6) {
  const chunks = [];
  const chunkSize = 1200;
  const chunkOverlap = 200;

  files.forEach(file => {
    const text = file.text || '';
    const name = file.filename || file.name || 'document';

    if (text.length <= chunkSize) {
      chunks.push({ name, text });
    } else {
      let i = 0;
      while (i < text.length) {
        const chunkText = text.substring(i, i + chunkSize);
        chunks.push({ name, text: chunkText });
        i += (chunkSize - chunkOverlap);
      }
    }
  });

  if (chunks.length <= topK) {
    return chunks;
  }

  const queryTerms = query.toLowerCase()
    .split(/\s+/)
    .map(t => t.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(t => t.length >= 2);
  if (queryTerms.length === 0) {
    return chunks.slice(0, topK);
  }

  // Pre-compile regexes once for performance
  const compiledRegexes = queryTerms.map(term => ({
    regex: new RegExp(term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'),
    weight: 1.0 / term.length
  }));

  const scoredChunks = chunks.map(chunk => {
    const textLower = chunk.text.toLowerCase();
    let score = 0;
    compiledRegexes.forEach(({ regex, weight }) => {
      const matches = textLower.match(regex);
      if (matches) {
        score += matches.length * weight;
      }
    });
    return { chunk, score };
  });

  scoredChunks.sort((a, b) => b.score - a.score);
  return scoredChunks.slice(0, topK).map(sc => sc.chunk);
}

/**
 * Endpoint to stream the AI answer
 * POST /api/answer
 */
app.post('/api/answer', async (req, res) => {
  const { messages, sources, focus, attachedFileText, attachedFileName, attachedFiles, model, persona = 'general' } = req.body;

  // Retrieve API keys from headers or environment
  const clientGeminiKey = req.headers['x-gemini-key'];
  const clientOpenAIKey = req.headers['x-openai-key'];

  const geminiKey = (clientGeminiKey && clientGeminiKey !== 'null' && clientGeminiKey !== 'undefined' && clientGeminiKey.trim() !== '')
    ? clientGeminiKey
    : process.env.GEMINI_API_KEY;

  const openaiKey = (clientOpenAIKey && clientOpenAIKey !== 'null' && clientOpenAIKey !== 'undefined' && clientOpenAIKey.trim() !== '')
    ? clientOpenAIKey
    : process.env.OPENAI_API_KEY;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages history is required' });
  }

  // Setup streaming response headers
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const userQuery = messages[messages.length - 1].content;

  // 1. PURE WEB SEARCH MODE (focus === 'web'): Zero AI API call! Direct pure web search engine response.
  // Bug Fix: If attached files (images/docs from connected apps like screen capture) are present,
  // skip the pure web synthesizer and fall through to the AI pipeline so files are actually processed.
  const hasAttachedFiles = (attachedFiles && attachedFiles.length > 0) ||
    Boolean(attachedFileText && attachedFileText.trim() !== '');

  if (focus === 'web' && !hasAttachedFiles) {
    try {
      const pureWebAnswer = synthesizeAnswer(userQuery, sources, { pureWeb: true });
      await simulateStreaming(pureWebAnswer, (chunk) => {
        if (!res.writableEnded && chunk) {
          res.write(chunk);
        }
      });
      if (!res.writableEnded) {
        res.end();
      }
      return;
    } catch (pureErr) {
      console.error('Pure Web Synthesizer Error:', pureErr);
      if (!res.writableEnded) {
        res.write('\n\n*[Failed to compile pure web search results.]*\n\n');
        res.end();
      }
      return;
    }
  }

  // Custom Personas & Modes System Instructions
  let personaInstruction = '';
  if (persona === 'coder') {
    personaInstruction = `\n[SPECIAL PERSONA MODE: CODING EXPERT]\nYou are an elite software architect and lead engineer. Provide production-grade code, clean architecture, detailed comments, unit tests, and performance considerations. Highlight HTML/CSS/JS code in runnable markdown blocks (\`\`\`javascript ... \`\`\`).`;
  } else if (persona === 'scientist') {
    personaInstruction = `\n[SPECIAL PERSONA MODE: DEEP SCIENTIST]\nYou are a senior research scientist. Provide rigorous academic explanations, mathematical formulations, hypotheses, mechanisms, and cite sources precisely. Use clear section headers and LaTeX formulas.`;
  } else if (persona === 'writer') {
    personaInstruction = `\n[SPECIAL PERSONA MODE: CONTENT CREATOR & WRITER]\nYou are a creative director and SEO copywriter. Write engaging, captivating, beautifully formatted articles, blogs, and posts with punchy hooks and clear takeaways.`;
  } else if (persona === 'tutor') {
    personaInstruction = `\n[SPECIAL PERSONA MODE: STUDY TUTOR]\nYou are a patient, encouraging master educator. Explain complex topics using simple analogies, real-world examples, step-by-step breakdowns, and quizzes.`;
  }

  let systemContext = '';
  if (focus === 'deep') {
    // Mode 4: DEEP REASONING (Most Advanced Mode with <think> thinking process + Deep AI reasoning)
    let webContext = '';
    if (sources && sources.length > 0) {
      webContext = `\nBelow are live web search results retrieved for the query:\n${sources.map((src, index) => `Source [${index + 1}]:\nTitle: ${src.title}\nURL: ${src.url}\nContent Snippet: ${src.snippet}`).join('\n\n')}`;
    }

    systemContext = `You are Insight AI operating in DEEP REASONING mode — the most advanced analytical AI mode.${personaInstruction}
${webContext}

Instructions for Deep Reasoning Mode:
1. ALWAYS start your response with a step-by-step reasoning thought process wrapped inside a \`<think>\` ... \`</think>\` block:
   <think>
   - Step 1: Deconstruct core problem & user intent for "${userQuery}"...
   - Step 2: Evaluate multi-source web search findings & scientific principles...
   - Step 3: Synthesize a rigorous, multi-perspective masterclass explanation...
   </think>
2. After the </think> block, provide an ultra-exhaustive, masterclass 360-degree answer covering at least 6 to 8 numbered sub-topics (\`### 1. ...\`, \`### 2. ...\`, etc.), with mathematical formulations/LaTeX where applicable, bold terms, and thorough bullet points.
3. Match the exact language of the user query (e.g. Hindi, Hinglish, English, etc.).
4. Cite sources as [1], [2] at the end of factual statements if search sources are available.
5. At the very end, generate 3 follow-up questions inside a <related> block:
<related>
- Relevant follow-up question 1?
- Relevant follow-up question 2?
- Relevant follow-up question 3?
</related>`;

  } else if (focus === 'pro') {
    // Mode 3: PRO SEARCH (Advanced Multi-Query Web + Deep Synthesis)
    let webContext = '';
    if (sources && sources.length > 0) {
      webContext = `\nBelow are expanded multi-query search results:\n${sources.map((src, index) => `Source [${index + 1}]:\nTitle: ${src.title}\nURL: ${src.url}\nContent Snippet: ${src.snippet}`).join('\n\n')}`;
    }

    systemContext = `You are Insight AI operating in PRO SEARCH mode — an advanced research synthesis engine.${personaInstruction}
${webContext}

Instructions for Pro Search Mode:
1. Match the exact language of the user query (e.g. Hindi, Hinglish, English, etc.).
2. Provide an advanced, comprehensive 360-degree analysis. Break down the query into at least 6 to 8 exhaustive sub-topics using clear subheaders (\`### 1. ...\`, \`### 2. ...\`, etc.).
3. Under every subheading, provide rich explanations, comparison tables or code snippets where appropriate, and cite sources as [1], [2].
4. At the very end, generate 3 follow-up questions inside a <related> block:
<related>
- Relevant follow-up question 1?
- Relevant follow-up question 2?
- Relevant follow-up question 3?
</related>`;

  } else {
    // Mode 2: FAST SEARCH (Fast Web + AI)
    let webContext = '';
    if (sources && sources.length > 0) {
      webContext = `\nBelow are the search results retrieved for the user's query:\n${sources.map((src, index) => `Source [${index + 1}]:\nTitle: ${src.title}\nURL: ${src.url}\nContent Snippet: ${src.snippet}`).join('\n\n')}`;
    }

    systemContext = `You are Insight AI operating in FAST SEARCH mode.${personaInstruction}
${webContext}

Instructions for Fast Search Mode:
1. Match the exact language of the user query (Hindi, Hinglish, English, etc.).
2. Provide a clear, fast, well-structured answer with numbered subheaders and bullet points.
3. Cite sources as [1], [2] at the end of factual statements.
4. At the very end, generate 3 follow-up questions inside a <related> block:
<related>
- Relevant follow-up question 1?
- Relevant follow-up question 2?
- Relevant follow-up question 3?
</related>`;
  }



  // Process attached documents and images
  const filesList = attachedFiles ? [...attachedFiles] : [];
  if (attachedFileText && filesList.length === 0) {
    filesList.push({ filename: attachedFileName || 'document', text: attachedFileText });
  }

  const docFiles = filesList.filter(f => !f.isImage && f.text);
  const imageFiles = filesList.filter(f => f.isImage && f.base64);

  if (docFiles.length > 0) {
    const relevantChunks = performLocalRag(userQuery, docFiles, 6);
    systemContext += `\n\n[USER ATTACHED DOCUMENTS CONTEXT - RAG RETRIEVED CHUNKS]`;
    relevantChunks.forEach((chunk, idx) => {
      systemContext += `\n\nChunk [${idx + 1}] (File: ${chunk.name}):\n${chunk.text}`;
    });
    systemContext += `\n\n[END OF ATTACHED DOCUMENTS CONTEXT]\nUse the content of these attached documents to help answer the user query, cross-referencing them with any web search results. Cite web search sources as [1], [2] as usual. If using information from an attached document, specify the filename in your text.`;
  }

  let bytesWritten = false;
  const writeChunk = (chunk) => {
    if (!res.writableEnded && chunk) {
      res.write(chunk);
      bytesWritten = true;
    }
  };
  const closeStream = () => {
    if (!res.writableEnded) {
      res.end();
    }
  };

  // Helper for Gemini stream with Smart Multi-Model Router & Failover
  async function runGeminiStream() {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const candidateModels = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];

    const cleanHistory = [];
    let lastRole = null;
    messages.slice(0, -1).forEach(msg => {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      if (role !== lastRole && msg.content && msg.content.trim()) {
        cleanHistory.push({
          role: role,
          parts: [{ text: msg.content }]
        });
        lastRole = role;
      }
    });

    // History must start with 'user'
    while (cleanHistory.length > 0 && cleanHistory[0].role !== 'user') {
      cleanHistory.shift();
    }

    // History must end with 'model' before sending new user message in chat session
    while (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role !== 'model') {
      cleanHistory.pop();
    }

    // Construct prompt payload with text + attached images for Vision AI
    const userParts = [{ text: userQuery }];
    imageFiles.forEach(img => {
      userParts.push({
        inlineData: {
          data: img.base64,
          mimeType: img.mimeType || 'image/png'
        }
      });
    });

    let lastModelError = null;

    for (const modelName of candidateModels) {
      if (bytesWritten) break; // Don't try next model if streaming already started
      try {
        const geminiModel = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemContext,
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.7
          }
        });

        try {
          const chat = geminiModel.startChat({ history: cleanHistory });
          const responseStream = await chat.sendMessageStream(userParts.length === 1 ? userQuery : userParts);

          for await (const chunk of responseStream.stream) {
            const text = chunk.text();
            if (text) writeChunk(text);
          }
          closeStream();
          return; // Successfully completed stream
        } catch (chatError) {
          if (bytesWritten) {
            console.warn(`[Model Router] ${modelName} stream interrupted mid-generation (${chatError.message || chatError}).`);
            writeChunk('\n\n*[Response stream interrupted]*\n\n');
            closeStream();
            return;
          }

          const errStr = chatError.message || String(chatError);
          const isQuotaOrNotFound = errStr.includes('429') || errStr.includes('404') || errStr.includes('Quota exceeded') || errStr.includes('QuotaFailure');

          if (!isQuotaOrNotFound) {
            console.warn(`[Model Router] ${modelName} chat stream notice (${errStr}). Trying direct generation...`);
            try {
              const directParts = imageFiles.length > 0 ? userParts : userQuery;
              const responseStream = await geminiModel.generateContentStream(directParts);

              for await (const chunk of responseStream.stream) {
                const text = chunk.text();
                if (text) writeChunk(text);
              }
              closeStream();
              return; // Successfully completed stream
            } catch (directErr) {
              if (bytesWritten) {
                writeChunk('\n\n*[Response stream interrupted]*\n\n');
                closeStream();
                return;
              }
              throw directErr; // Rethrow to trigger candidate model loop catch block
            }
          } else {
            throw chatError;
          }
        }
      } catch (err) {
        lastModelError = err;
        if (!bytesWritten) {
          const firstLine = (err.message || String(err)).split('\n')[0];
          console.warn(`[Model Router] ${modelName} unavailable (${firstLine}). Trying next candidate model...`);
        }
      }
    }

    if (!bytesWritten && lastModelError) throw lastModelError;
  }

  // Helper for OpenAI stream
  async function runOpenAIStream() {
    const openai = new OpenAI({ apiKey: openaiKey });

    const apiMessages = [
      { role: 'system', content: systemContext },
      ...messages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }))
    ];

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: apiMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) writeChunk(content);
    }
    closeStream();
  }

  let answered = false;

  // Attempt 1: Priority Model
  if (model === 'openai' && openaiKey) {
    try {
      await runOpenAIStream();
      answered = bytesWritten;
    } catch (e) {
      console.warn('OpenAI stream notice:', e.message || e);
    }
  } else if (geminiKey) {
    try {
      await runGeminiStream();
      answered = bytesWritten;
    } catch (e) {
      if (e.status === 429 || (e.message && e.message.includes('429'))) {
        console.warn('[Notice] Gemini API Free Tier Limit hit (429 Rate Limit). Switching to Smart RAG Synthesis Fallback for instant response...');
      } else {
        console.warn('Gemini stream notice:', e.message || e);
      }
    }
  }

  // Attempt 2: Fallback Model if not answered yet
  if (!answered && !bytesWritten) {
    if (model === 'openai' && geminiKey) {
      try {
        await runGeminiStream();
        answered = bytesWritten;
      } catch (e) {
        if (e.status === 429 || (e.message && e.message.includes('429'))) {
          console.warn('[Notice] Gemini API Free Tier Limit hit (429 Rate Limit). Switching to Smart RAG Synthesis Fallback for instant response...');
        } else {
          console.warn('Gemini fallback notice:', e.message || e);
        }
      }
    } else if (openaiKey) {
      try {
        await runOpenAIStream();
        answered = bytesWritten;
      } catch (e) {
        console.warn('OpenAI fallback notice:', e.message || e);
      }
    }
  }

  // Attempt 3: Synthetic Fallback if both APIs failed and no bytes written
  if (!answered && !bytesWritten) {
    try {
      const syntheticText = synthesizeAnswer(userQuery, sources, { rateLimited: true });
      await simulateStreaming(syntheticText, (chunk) => {
        writeChunk(chunk);
      });
      closeStream();
    } catch (error) {
      console.error('Synthesizer Error:', error);
      writeChunk('\n\n*[An internal error occurred while generating the fallback summary.]*\n\n');
      closeStream();
    }
  }
});

// Fallback for SPA routing: serve index.html for all non-api routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`Strange AI Server running on http://localhost:${PORT}`);
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} in use, retrying in 1s...`);
    setTimeout(() => {
      server.close();
      server.listen(PORT);
    }, 1000);
  }
});
