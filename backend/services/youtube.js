import { YoutubeTranscript } from 'youtube-transcript';

/**
 * Extracts YouTube Video ID from various URL formats.
 * @param {string} url 
 * @returns {string|null}
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

/**
 * Direct YouTube player response parser to extract caption tracks.
 * @param {string} videoId 
 * @returns {Promise<{videoTitle: string, items: Array}>}
 */
async function fetchDirectYouTubeCaptions(videoId) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(watchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load YouTube watch page: ${response.status}`);
  }

  const html = await response.text();

  // Extract video title
  let videoTitle = `YouTube Video (${videoId})`;
  const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    videoTitle = titleMatch[1].replace(/ - YouTube$/, '').trim();
  }

  // Find captionTracks array directly in html string
  const captionTracksMatch = html.match(/"captionTracks":\s*(\[\s*{[\s\S]*?}\s*\])/);
  if (!captionTracksMatch) {
    throw new Error('No caption tracks found for this video. Subtitles/captions might be disabled by the uploader.');
  }

  let captionTracks = [];
  try {
    captionTracks = JSON.parse(captionTracksMatch[1]);
  } catch (e) {
    throw new Error('Failed to parse caption tracks JSON');
  }

  if (!captionTracks || captionTracks.length === 0) {
    throw new Error('No caption tracks available.');
  }

  // Select preferred track (Hindi or English or first)
  const track = captionTracks.find(t => t.languageCode === 'hi' || t.languageCode === 'en' || t.languageCode?.startsWith('en') || t.languageCode?.startsWith('hi')) || captionTracks[0];
  const baseUrl = track.baseUrl.replace(/\\u0026/g, '&');

  const xmlRes = await fetch(baseUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  if (!xmlRes.ok) {
    throw new Error('Failed to fetch caption XML.');
  }

  const xmlText = await xmlRes.text();

  // Parse <text start="1.23" dur="4.56">spoken word</text>
  const items = [];
  const textRegex = /<text\s+start="([\d\.]+)"(?:\s+dur="([\d\.]+)")?[^>]*>([\s\S]*?)<\/text>/gi;
  let match;

  while ((match = textRegex.exec(xmlText)) !== null) {
    const startSec = parseFloat(match[1]);
    const durationSec = match[2] ? parseFloat(match[2]) : 0;
    let cleanText = match[3]
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/<[^>]+>/g, '') // remove inner HTML tags
      .trim();

    if (cleanText) {
      items.push({
        text: cleanText,
        offset: startSec,
        duration: durationSec
      });
    }
  }

  return { videoTitle, items };
}

/**
 * Formats seconds to [MM:SS] timestamp string
 * @param {number} rawSecs 
 * @returns {string}
 */
function formatMMSS(rawSecs) {
  let secs = typeof rawSecs === 'number' ? rawSecs : parseFloat(rawSecs || 0);
  if (secs > 100000) {
    secs = secs / 1000;
  }
  const hrs = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const remSecs = Math.floor(secs % 60);
  if (hrs > 0) {
    return `[${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}]`;
  }
  return `[${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}]`;
}

/**
 * Fetches transcript for a YouTube URL or Video ID with multi-layer fallback.
 * @param {string} urlOrId 
 * @returns {Promise<{videoId: string, title: string, transcriptText: string, items: Array}>}
 */
export async function getYouTubeTranscript(urlOrId) {
  const videoId = extractYouTubeId(urlOrId) || urlOrId.trim();

  if (!videoId || videoId.length !== 11) {
    throw new Error('Invalid YouTube video URL or Video ID.');
  }

  let transcriptItems = null;
  let videoTitle = `YouTube Video (${videoId})`;
  let lastErr = null;

  // Layer 1: Direct YouTube timedtext XML parser with User-Agent
  try {
    const directData = await fetchDirectYouTubeCaptions(videoId);
    transcriptItems = directData.items;
    if (directData.videoTitle) videoTitle = directData.videoTitle;
  } catch (e1) {
    lastErr = e1;
  }

  // Layer 2: Fallback to YoutubeTranscript package
  if (!transcriptItems || transcriptItems.length === 0) {
    try {
      transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
    } catch (e2) {
      lastErr = e2;
    }
  }

  if (!transcriptItems || transcriptItems.length === 0) {
    throw new Error(`Could not fetch spoken captions for this YouTube video. Subtitles/captions might be turned off for this video. (${lastErr?.message || ''})`);
  }

  // Filter out noise tags like [Music], [Applause]
  const filteredItems = transcriptItems.filter(item => {
    const txt = item.text.trim().toLowerCase();
    if (txt === '[music]' || txt === '[applause]' || txt === '[laughter]' || txt.length === 0) {
      return false;
    }
    return true;
  });

  const finalItems = filteredItems.length > 0 ? filteredItems : transcriptItems;

  // Format line-by-line timestamped captions
  const timestampedLines = finalItems.map(item => {
    const timeStr = formatMMSS(item.offset);
    return `${timeStr} ${item.text}`;
  });

  const fullTranscript = timestampedLines.join('\n');

  return {
    videoId,
    title: videoTitle,
    transcriptText: fullTranscript.length > 20000 ? fullTranscript.substring(0, 20000) + '\n... [Captions Truncated]' : fullTranscript,
    items: finalItems
  };
}
