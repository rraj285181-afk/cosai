const THREADS_KEY = 'insight_ai_threads';
const SPACES_KEY = 'insight_ai_spaces';

export function getThreads() {
  try {
    const saved = localStorage.getItem(THREADS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Error loading threads:', e);
    return [];
  }
}

export function saveThreads(threads) {
  try {
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
  } catch (e) {
    console.warn('LocalStorage save failed, attempting to trim heavy image attachments...', e);
    try {
      // Strip large base64 image strings from attachedFiles in older threads
      const sanitizedThreads = threads.map((t, idx) => {
        if (idx === 0) return t; // keep active thread intact if possible
        if (!t.attachedFiles || t.attachedFiles.length === 0) return t;
        const cleanFiles = t.attachedFiles.map(f => ({
          name: f.name || f.filename,
          filename: f.filename || f.name,
          text: f.text ? f.text.substring(0, 2000) : ''
        }));
        return { ...t, attachedFiles: cleanFiles };
      });
      localStorage.setItem(THREADS_KEY, JSON.stringify(sanitizedThreads));
    } catch (retryErr) {
      console.error('Failed to save threads even after trimming heavy attachments:', retryErr);
    }
  }
}

export function getSpaces() {
  try {
    const saved = localStorage.getItem(SPACES_KEY);
    if (saved) return JSON.parse(saved);
    const defaultSpaces = [
      { id: 'space_tech', name: 'Tech & Coding', emoji: '💻', color: '#10b981' },
      { id: 'space_research', name: 'Deep Research', emoji: '🔬', color: '#06b6d4' },
      { id: 'space_ideas', name: 'Ideas & Drafts', emoji: '💡', color: '#f59e0b' }
    ];
    localStorage.setItem(SPACES_KEY, JSON.stringify(defaultSpaces));
    return defaultSpaces;
  } catch (e) {
    console.error('Error loading spaces:', e);
    return [];
  }
}

export function saveSpaces(spaces) {
  try {
    localStorage.setItem(SPACES_KEY, JSON.stringify(spaces));
  } catch (e) {
    console.error('Error saving spaces:', e);
  }
}

const CONNECTED_APPS_KEY = 'insight_ai_connected_apps';

export function getConnectedApps() {
  try {
    const defaultApps = [
      { id: 'screen_capture', name: 'Display Capture', description: 'Real-time Full Screen & Window Vision Stream for AI Search', active: false, isCapture: true },
      { id: 'gdrive', name: 'Google Drive & Docs', description: 'Search personal Google Drive folders & docs', active: false, requiresConfig: true, configValue: '' },
      { id: 'github', name: 'GitHub Repositories', description: 'Search codebases, repos & issue threads', active: false, requiresConfig: true, configValue: '' },
      { id: 'notion', name: 'Notion Knowledge Base', description: 'Personal notes & project workspace RAG', active: false, requiresConfig: true, configValue: '' }
    ];

    const savedStr = localStorage.getItem(CONNECTED_APPS_KEY);
    if (!savedStr) {
      localStorage.setItem(CONNECTED_APPS_KEY, JSON.stringify(defaultApps));
      return defaultApps;
    }

    // Filter out obsolete IDs (display_capture, window_capture, web, local, wikipedia, weather, news) & sanitize active status
    let savedApps = JSON.parse(savedStr)
      .filter(a => a.id !== 'display_capture' && a.id !== 'window_capture' && a.id !== 'web' && a.id !== 'local' && a.id !== 'wikipedia' && a.id !== 'weather' && a.id !== 'news')
      .map(a => {
        const isCap = a.id === 'screen_capture';
        const hasConfig = !a.requiresConfig || Boolean(a.configValue && String(a.configValue).trim() !== '');
        return {
          ...a,
          name: isCap ? 'Display Capture' : a.name,
          active: isCap ? false : Boolean(a.active && hasConfig)
        };
      });

    const existingIds = new Set(savedApps.map(a => a.id));

    defaultApps.forEach(defApp => {
      if (!existingIds.has(defApp.id)) {
        savedApps.push(defApp);
      }
    });

    // Sort to place Display Capture at the very top (#1)
    savedApps.sort((a, b) => {
      if (a.id === 'screen_capture') return -1;
      if (b.id === 'screen_capture') return 1;
      return 0;
    });

    localStorage.setItem(CONNECTED_APPS_KEY, JSON.stringify(savedApps));
    return savedApps;
  } catch (e) {
    console.error('Error loading connected apps:', e);
    return [];
  }
}

export function saveConnectedApps(apps) {
  try {
    localStorage.setItem(CONNECTED_APPS_KEY, JSON.stringify(apps));
  } catch (e) {
    console.error('Error saving connected apps:', e);
  }
}

export function createNewThread(initialQuery = '', focus = 'all', spaceId = null) {
  const newThread = {
    id: 'thread_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    title: initialQuery ? (initialQuery.length > 30 ? initialQuery.substring(0, 30) + '...' : initialQuery) : 'New Search',
    focus: focus,
    spaceId: spaceId,
    messages: [],
    sources: [],
    createdAt: new Date().toISOString()
  };
  return newThread;
}
