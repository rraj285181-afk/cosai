// Detects if the current device is mobile/tablet where screen capture is unsupported
export function isMobileDevice() {
  // getDisplayMedia is the definitive check — absent on all mobile browsers
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
    return true;
  }
  // Secondary UA check for touch-only mobile devices (iPads with desktop mode enabled still lack getDisplayMedia)
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}


export const cleanInvalidCitations = (text, sourcesCount) => {
  if (!text) return '';
  return text.replace(/\[(\d+)\]/g, (match, numberStr) => {
    const num = parseInt(numberStr, 10);
    if (num > sourcesCount || num <= 0) {
      return '';
    }
    return match;
  });
};

// Helper to deduplicate sources by cleaning URL queries/fragments, protocols, subdomains, and trailing slashes
export const deduplicateSources = (sourcesList) => {
  if (!sourcesList || sourcesList.length === 0) return [];
  const uniqueUrls = new Set();
  const result = [];
  
  for (const src of sourcesList) {
    if (!src || !src.url) continue;
    
    // Normalize URL: strip query parameters, hash fragments, protocols, www. subdomains, and trailing slashes
    let cleanUrl = src.url.split('?')[0].split('#')[0].toLowerCase().trim();
    cleanUrl = cleanUrl.replace(/^https?:\/\/(www\.)?/, 'https://');
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }

    if (!uniqueUrls.has(cleanUrl)) {
      uniqueUrls.add(cleanUrl);
      result.push({
        title: src.title ? src.title.trim() : 'Web Source',
        url: src.url,
        snippet: src.snippet ? src.snippet.trim() : 'No snippet description available.'
      });
    }
  }
  return result;
};

let activeScreenStream = null;
let activeScreenVideo = null;
let activeSurfaceType = 'monitor';

/**
 * Connects and holds an active live Screen/Window MediaStream for real-time snapshots on query send.
 * @param {string} surfaceType 'monitor' | 'window' | 'browser'
 * @param {Function} onEndedCallback Callback when user stops stream via browser bar.
 */
export async function connectLiveScreenStream(surfaceType = 'monitor', onEndedCallback = null) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    throw new Error('Screen stream capture is not supported in this browser.');
  }

  if (activeScreenStream) {
    stopLiveScreenStream();
  }

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always',
        displaySurface: surfaceType
      },
      audio: false
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    
    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });

    activeScreenStream = stream;
    activeScreenVideo = video;
    activeSurfaceType = surfaceType;

    const track = stream.getVideoTracks()[0];
    if (track) {
      track.onended = () => {
        activeScreenStream = null;
        activeScreenVideo = null;
        if (onEndedCallback) onEndedCallback();
      };
    }

    return {
      surfaceType,
      stream,
      video,
      name: surfaceType === 'window' ? '🪟 OBS Window Stream Connected' : '🖥️ OBS Display Stream Connected'
    };
  } catch (err) {
    if (err.name === 'NotAllowedError' || (err.message && err.message.includes('Permission denied'))) {
      throw new Error('Live stream capture was cancelled.');
    }
    throw err;
  }
}

/**
 * Grabs a fresh real-time screenshot frame from the active live video stream at the exact moment of sending query.
 */
export function grabFreshScreenshotFromLiveStream() {
  if (!activeScreenStream || !activeScreenVideo || activeScreenVideo.readyState < 2) {
    return null;
  }

  try {
    const video = activeScreenVideo;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');

    const isWindow = activeSurfaceType === 'window';
    const tag = isWindow ? '🪟 Real-time Window Snapshot' : '🖥️ Real-time Display Snapshot';
    const filename = isWindow ? `Realtime_Window_Capture_${Date.now()}.png` : `Realtime_Display_Capture_${Date.now()}.png`;

    return {
      name: `${tag} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})`,
      filename: filename,
      isImage: true,
      mimeType: 'image/png',
      base64: base64,
      dataUrl: dataUrl,
      isCapture: true,
      captureType: activeSurfaceType
    };
  } catch (e) {
    console.warn('Error capturing frame from live stream:', e);
    return null;
  }
}

/**
 * Stops any active live screen/window stream.
 */
export function stopLiveScreenStream() {
  if (activeScreenStream) {
    try {
      activeScreenStream.getTracks().forEach(track => track.stop());
    } catch (e) {}
    activeScreenStream = null;
    activeScreenVideo = null;
  }
}

/**
 * Checks if a live screen stream is connected and active.
 */
export function getLiveStreamStatus() {
  const isActive = !!(activeScreenStream && activeScreenStream.active && activeScreenVideo && activeScreenVideo.readyState >= 2);
  return {
    active: isActive,
    surfaceType: activeSurfaceType,
    label: '🖥️ Display Capture'
  };
}

/**
 * Helper to check if a connected app is TRULY active and connected.
 * @param {Object} app 
 * @returns {boolean}
 */
export function isAppTrulyConnected(app) {
  if (!app) return false;
  if (app.isCapture) {
    return getLiveStreamStatus().active;
  }
  if (app.requiresConfig) {
    return Boolean(app.active && app.configValue && String(app.configValue).trim() !== '');
  }
  return Boolean(app.active);
}

/**
 * OBS Studio Style Real-time Screen/Window Capture for Vision AI
 * @param {string} surfaceType 'monitor' | 'window' | 'browser'
 * @returns {Promise<{name: string, filename: string, isImage: boolean, mimeType: string, base64: string, dataUrl: string}>}
 */
export async function captureDisplayOrWindow(surfaceType = 'monitor') {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    throw new Error('Screen capture is not supported in this browser.');
  }

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always',
        displaySurface: surfaceType
      },
      audio: false
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    
    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });

    await new Promise(r => setTimeout(r, 150));

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    stream.getTracks().forEach(track => track.stop());

    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');

    const isWindow = surfaceType === 'window';
    const tag = isWindow ? '🪟 OBS Window Capture' : '🖥️ OBS Display Capture';
    const filename = isWindow ? `Window_Capture_${Date.now()}.png` : `Display_Capture_${Date.now()}.png`;

    return {
      name: `${tag} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      filename: filename,
      isImage: true,
      mimeType: 'image/png',
      base64: base64,
      dataUrl: dataUrl,
      isCapture: true,
      captureType: surfaceType
    };
  } catch (err) {
    if (err.name === 'NotAllowedError' || (err.message && err.message.includes('Permission denied'))) {
      throw new Error('Screen capture was cancelled.');
    }
    throw err;
  }
}
