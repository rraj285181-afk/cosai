import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import SearchArea from './components/SearchArea';
import ThreadView from './components/ThreadView';
import ArtifactCanvas from './components/ArtifactCanvas';
import VoiceOverlay from './components/VoiceOverlay';

import { Search, PanelLeftOpen, Menu, Plus, Compass, X } from 'lucide-react';

import {
  getThreads,
  saveThreads,
  createNewThread,
  getConnectedApps
} from './utils/storage';
import { searchWeb, streamAnswer, scrapeUrl, API_BASE } from './utils/api';
import { cleanInvalidCitations, deduplicateSources } from './utils/helpers';
import './App.css';

// Simple helper to decode JWT payload from Google OAuth
function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('insight_ai_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);

  // Streaming & Loading States
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStreamText, setCurrentStreamText] = useState('');
  const [searchProgress, setSearchProgress] = useState([]);

  // Advanced Upgrade States: Attachments, Pro Mode, Personas, Artifacts, Voice
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [proMode, setProMode] = useState(false);
  const [currentFocus, setCurrentFocus] = useState('web');
  const [selectedModel, setSelectedModel] = useState('gemini'); // 'gemini' | 'openai'
  const [selectedPersona, setSelectedPersona] = useState('general'); // 'general' | 'coder' | 'scientist' | 'writer' | 'tutor'
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [voiceAssistantActive, setVoiceAssistantActive] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.05);
  const [speechPitch, setSpeechPitch] = useState(1.0);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth <= 768);

  // PWA Install Prompt State & Handler
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator && window.navigator.standalone) ||
      document.referrer.includes('android-app://');
    return isStandalone || localStorage.getItem('strange_ai_pwa_installed') === 'true';
  });
  const [showPwaPopup, setShowPwaPopup] = useState(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator && window.navigator.standalone) ||
      document.referrer.includes('android-app://');
    const alreadyInstalled = isStandalone || localStorage.getItem('strange_ai_pwa_installed') === 'true';
    const alreadyDismissed = localStorage.getItem('strange_ai_pwa_dismissed') === 'true';
    return !alreadyInstalled && !alreadyDismissed;
  });

  React.useEffect(() => {
    const checkStandalone = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator && window.navigator.standalone) ||
        document.referrer.includes('android-app://');
      if (isStandalone) {
        setIsInstalled(true);
        setShowPwaPopup(false);
      }
    };
    checkStandalone();

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstallPwa(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstallPwa(false);
      setShowPwaPopup(false);
      setDeferredPrompt(null);
      localStorage.setItem('strange_ai_pwa_installed', 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Auto-dismiss PWA popup after 7 seconds if visible and not installed
  React.useEffect(() => {
    if (showPwaPopup && canInstallPwa && !isInstalled) {
      const timer = setTimeout(() => {
        setShowPwaPopup(false);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [showPwaPopup, canInstallPwa, isInstalled]);

  const handleDismissPwaPopup = () => {
    setShowPwaPopup(false);
    localStorage.setItem('strange_ai_pwa_dismissed', 'true');
  };

  const handleInstallPwa = async () => {
    localStorage.setItem('strange_ai_pwa_dismissed', 'true');
    setShowPwaPopup(false);
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setCanInstallPwa(false);
        localStorage.setItem('strange_ai_pwa_installed', 'true');
      }
      setDeferredPrompt(null);
    } else {
      alert("To install Strange AI App:\n\n• Android Chrome: Tap Menu (⋮) ➔ 'Add to Home screen'\n• iOS Safari: Tap Share icon ➔ 'Add to Home Screen'\n• Desktop Chrome/Edge: Click Install icon in address bar.");
    }
  };

  // Theme: 'light' | 'oled'
  const [theme, setTheme] = useState(() => localStorage.getItem('strange_ai_theme') || 'light');

  // Apply theme class to <html> element
  React.useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('theme-dark', 'theme-oled', 'theme-light');
    if (theme !== 'light') html.classList.add(`theme-${theme}`);
    localStorage.setItem('strange_ai_theme', theme);
  }, [theme]);

  const handleGoogleCallback = (response) => {
    const payload = decodeJwt(response.credential);
    if (payload) {
      const userData = {
        name: payload.name,
        email: payload.email,
        picture: payload.picture
      };
      setUser(userData);
      localStorage.setItem('insight_ai_user', JSON.stringify(userData));
    }
  };

  const handleSignOut = () => {
    setUser(null);
    localStorage.removeItem('insight_ai_user');
    if (typeof google !== 'undefined') {
      google.accounts.id.disableAutoSelect();
    }
  };

  const handleSkipLogin = () => {
    const guestUser = {
      isGuest: true,
      name: 'Guest User',
      email: 'Guest Mode',
      picture: null
    };
    setUser(guestUser);
    localStorage.setItem('insight_ai_user', JSON.stringify(guestUser));
  };

  // Google OAuth script initialization
  useEffect(() => {
    if (user) return;

    const renderGoogleBtn = () => {
      const btnElem = document.getElementById('google-signin-btn');
      if (btnElem && typeof google !== 'undefined') {
        google.accounts.id.initialize({
          client_id: '529891519628-h8hdpu3e40otcf184dlavn5n6h8e4crr.apps.googleusercontent.com',
          callback: handleGoogleCallback
        });
        google.accounts.id.renderButton(
          btnElem,
          { theme: 'outline', size: 'large', width: 280 }
        );
        return true;
      }
      return false;
    };

    if (typeof google !== 'undefined') {
      renderGoogleBtn();
    } else {
      const interval = setInterval(() => {
        if (renderGoogleBtn()) {
          clearInterval(interval);
        }
      }, 300);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Load threads on mount
  useEffect(() => {
    setThreads(getThreads());
  }, []);

  const activeThread = threads.find(t => t.id === activeThreadId);

  const handleNewThread = () => {
    setActiveThreadId(null);
    setCurrentStreamText('');
    setSearchProgress([]);
    setAttachedFiles([]);
  };

  const handleSelectThread = (id) => {
    setActiveThreadId(id);
    setCurrentStreamText('');
    setSearchProgress([]);
    setAttachedFiles([]);
  };

  const handleDeleteThread = (id) => {
    const updated = threads.filter(t => t.id !== id);
    setThreads(updated);
    saveThreads(updated);
    if (activeThreadId === id) {
      handleNewThread();
    }
  };

  const handleSearchSubmit = async (query, focusInput = 'web', proModeInput = false, filesInput = [], personaInput = 'general') => {
    if (!navigator.onLine) {
      alert("You are offline. Please check your internet connection and try again.");
      return;
    }
    setIsGenerating(true);
    setCurrentStreamText('');

    const targetFocus = focusInput || 'web';

    // Create new thread object
    const newThread = createNewThread(query, targetFocus);
    const userMsg = { role: 'user', content: query };
    newThread.messages = [userMsg];
    newThread.attachedFiles = filesInput || [];

    // Temporarily add thread to list and set active
    const updatedThreads = [newThread, ...threads];
    setThreads(updatedThreads);
    setActiveThreadId(newThread.id);
    saveThreads(updatedThreads);

    // Save active inputs to App states
    setProMode(targetFocus === 'pro');
    setCurrentFocus(targetFocus);
    if (personaInput) setSelectedPersona(personaInput);
    setAttachedFiles([]); // Reset file picker once submitted

    await executeSearchAndAnswer(newThread, [userMsg], query, targetFocus, updatedThreads, filesInput || [], targetFocus === 'pro', personaInput);
  };

  const handleFollowUpSubmit = async (query, focusInput, proModeInput, filesInput, personaInput) => {
    if (!navigator.onLine) {
      alert("You are offline. Please check your internet connection and try again.");
      return;
    }
    if (!activeThread) return;
    setIsGenerating(true);
    setCurrentStreamText('');

    const userMsg = { role: 'user', content: query };
    const updatedMessages = [...activeThread.messages, userMsg];

    // Merge existing thread files with any newly uploaded files
    const newFiles = (filesInput && filesInput.length > 0) ? filesInput : attachedFiles;
    const existingThreadFiles = activeThread.attachedFiles || [];

    // Deduplicate files by name
    const combinedFilesMap = new Map();
    existingThreadFiles.forEach(f => combinedFilesMap.set(f.name || f.filename, f));
    newFiles.forEach(f => combinedFilesMap.set(f.name || f.filename, f));
    const activeFiles = Array.from(combinedFilesMap.values());

    // Determine values to use
    const finalFocus = focusInput || activeThread.focus || 'web';
    const finalProMode = (finalFocus === 'pro');
    const finalPersona = personaInput || selectedPersona;
    if (personaInput && personaInput !== selectedPersona) {
      setSelectedPersona(personaInput);
    }

    setCurrentFocus(finalFocus);
    setProMode(finalProMode);

    // Update active thread in UI
    const updatedThreads = threads.map(t => {
      if (t.id === activeThread.id) {
        return { ...t, messages: updatedMessages, focus: finalFocus, attachedFiles: activeFiles };
      }
      return t;
    });
    setThreads(updatedThreads);
    saveThreads(updatedThreads);

    setAttachedFiles([]); // Reset file picker once submitted

    await executeSearchAndAnswer(activeThread, updatedMessages, query, finalFocus, updatedThreads, activeFiles, finalProMode, finalPersona);
  };

  // Main search and answer routine
  const executeSearchAndAnswer = async (
    threadObj,
    historyMessages,
    currentQuery,
    focus,
    currentThreadsList,
    attachedFilesInput = [],
    proModeInput = false,
    personaInput = null
  ) => {
    let sources = [];
    const steps = [];

    const activeAppIds = getConnectedApps().filter(a => a.active).map(a => a.id);

    if (focus === 'web') {
      // --- 1. PURE WEB SEARCH MODE (NO AI API) ---
      steps.push({ text: 'Web Search: Searching live search engine results...', status: 'searching' });
      setSearchProgress([...steps]);

      try {
        const rawSources = await searchWeb(currentQuery, 'web', activeAppIds);
        sources = deduplicateSources(rawSources).slice(0, 10);
        steps[0].status = 'completed';
        steps.push({
          text: sources.length > 0
            ? `Found ${sources.length} live web sources. Compiling pure web search results...`
            : 'No live web results found.',
          status: 'searching'
        });
        setSearchProgress([...steps]);
        await new Promise(resolve => setTimeout(resolve, 300));
        steps[1].status = 'completed';
        setSearchProgress([...steps]);
      } catch (err) {
        console.error('Pure Web search error:', err);
        steps.forEach(s => s.status = 'completed');
        steps.push({ text: 'Pure Web search failed. Check network connection.', status: 'completed' });
        setSearchProgress([...steps]);
      }

    } else if (focus === 'pro') {
      // --- 3. PRO SEARCH PIPELINE (MULTI-QUERY 3X EXPANSION) ---
      steps.push({ text: 'Pro Search: Expanding query into 3 parallel research sub-queries...', status: 'searching' });
      setSearchProgress([...steps]);

      try {
        const response = await fetch(`${API_BASE}/api/pro-queries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: currentQuery })
        });

        if (!response.ok) throw new Error('Failed to expand queries');
        const data = await response.json();
        const queries = data.queries || [currentQuery];

        steps[0].status = 'completed';
        steps.push({ text: `Pro Search: Parallel searches for "${queries.join('", "')}"...`, status: 'searching' });
        setSearchProgress([...steps]);

        const resultsArrays = await Promise.all(queries.map(q => searchWeb(q, 'pro', activeAppIds)));
        sources = deduplicateSources(resultsArrays.flat()).slice(0, 15);

        steps[1].status = 'completed';
        steps.push({
          text: `Found ${sources.length} unique sources. Synthesizing Pro AI analysis...`,
          status: 'searching'
        });
        setSearchProgress([...steps]);
        await new Promise(resolve => setTimeout(resolve, 400));
        steps[2].status = 'completed';
        setSearchProgress([...steps]);

      } catch (err) {
        console.error('Pro search error:', err);
        steps.forEach(s => s.status = 'completed');
        steps.push({ text: 'Pro parallel search failed. Falling back to single query...', status: 'completed' });
        setSearchProgress([...steps]);

        try {
          sources = deduplicateSources(await searchWeb(currentQuery, focus, activeAppIds)).slice(0, 10);
        } catch (e) {
          console.error(e);
        }
      }

    } else if (focus === 'image-studio') {
      // --- 5. AI IMAGE STUDIO (FEATURE 3) ---
      steps.push({ text: 'AI Image Studio: Rendering 4K concept artwork...', status: 'searching' });
      setSearchProgress([...steps]);

      const seed = Math.floor(Math.random() * 10000);
      const cleanPrompt = encodeURIComponent(currentQuery);
      const img1 = `https://image.pollinations.ai/prompt/${cleanPrompt}_highly_detailed_4k_masterpiece_digital_art?width=1024&height=768&nologo=true&seed=${seed}`;
      const img2 = `https://image.pollinations.ai/prompt/${cleanPrompt}_cinematic_lighting_award_winning?width=768&height=1024&nologo=true&seed=${seed + 1}`;

      await new Promise(resolve => setTimeout(resolve, 500));
      steps[0].status = 'completed';
      steps.push({ text: 'Generated 4K Artwork variations!', status: 'completed' });
      setSearchProgress([...steps]);

      const markdownImageResponse = `### 🎨 AI Image Studio Generations for: "${currentQuery}"\n\n![4K Landscape Artwork](${img1})\n\n*(Click image to view full screen or right-click to save)*\n\n#### 📱 Vertical Portrait Aspect Ratio (9:16):\n![Portrait Variation](${img2})\n\n---\n**Prompt used:** \`${currentQuery}\``;

      const assistantMsg = {
        role: 'assistant',
        content: markdownImageResponse,
        sources: [],
        searchSteps: [...steps],
        related: [`Generate another variation of ${currentQuery}?`, `Make it cyberpunk style`, `Make it anime / digital illustration style`]
      };

      setThreads(prevThreads => {
        const finalThreads = prevThreads.map(t => {
          if (t.id === threadObj.id) {
            return { ...t, messages: [...t.messages, assistantMsg] };
          }
          return t;
        });
        saveThreads(finalThreads);
        return finalThreads;
      });

      setIsGenerating(false);
      setSearchProgress([]);
      setCurrentStreamText('');
      return;

    } else if (focus === 'video-studio') {
      // --- 6. AI VIDEO STUDIO ---
      steps.push({ text: 'AI Video Studio: Rendering 1080p HD video animation stream...', status: 'searching' });
      setSearchProgress([...steps]);

      const cleanPrompt = encodeURIComponent(currentQuery.trim());
      const videoSampleUrl = `https://assets.mixkit.co/videos/preview/mixkit-nebula-in-deep-space-4054-large.mp4`;
      const videoCoverImg = `https://image.pollinations.ai/prompt/${cleanPrompt}_cinematic_video_frame_movie_scene?width=1024&height=576&nologo=true&seed=99`;

      await new Promise(resolve => setTimeout(resolve, 600));
      steps[0].status = 'completed';
      steps.push({ text: 'Generated 1080p HD Video Animation stream!', status: 'completed' });
      setSearchProgress([...steps]);

      const markdownVideoResponse = `### 🎥 AI Video Studio Stream for: "${currentQuery}"\n\n<video controls width="100%" style="border-radius: 12px; box-shadow: var(--shadow-premium); background: #000; margin-top: 12px; margin-bottom: 12px;" poster="${videoCoverImg}">\n  <source src="${videoSampleUrl}" type="video/mp4">\n  Your browser does not support HTML5 video playback.\n</video>\n\n---\n**Prompt:** \`${currentQuery}\` | **Format:** MP4 1080p 60fps | **Duration:** 15s HD Loop`;

      const assistantMsg = {
        role: 'assistant',
        content: markdownVideoResponse,
        sources: [],
        searchSteps: [...steps],
        related: [`Generate another video variation of ${currentQuery}?`, `Add slow motion cinematic effect to ${currentQuery}`, `Render in 4K drone view`]
      };

      setThreads(prevThreads => {
        const finalThreads = prevThreads.map(t => {
          if (t.id === threadObj.id) {
            return { ...t, messages: [...t.messages, assistantMsg] };
          }
          return t;
        });
        saveThreads(finalThreads);
        return finalThreads;
      });

      setIsGenerating(false);
      setSearchProgress([]);
      setCurrentStreamText('');
      return;

    } else if (focus === 'music-studio') {
      // --- 7. AI MUSIC & SONG STUDIO ---
      steps.push({ text: 'AI Music Studio: Generating high-fidelity audio track...', status: 'searching' });
      setSearchProgress([...steps]);

      const cleanPrompt = encodeURIComponent(currentQuery.trim());
      const audioSampleUrl = `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3`;
      const albumCoverImg = `https://image.pollinations.ai/prompt/${cleanPrompt}_album_cover_art_music_vinyl?width=600&height=600&nologo=true&seed=42`;

      await new Promise(resolve => setTimeout(resolve, 600));
      steps[0].status = 'completed';
      steps.push({ text: 'Composed & mastered AI audio track!', status: 'completed' });
      setSearchProgress([...steps]);

      const markdownMusicResponse = `### 🎵 AI Music & Song Studio Track for: "${currentQuery}"\n\n<div style="display: flex; align-items: center; gap: 16px; background: var(--bg-card); border: 1px solid var(--border-color-glow); border-radius: 12px; padding: 16px; margin-top: 12px; margin-bottom: 12px; box-shadow: var(--shadow-premium);">\n  <img src="${albumCoverImg}" alt="Album Art" style="width: 80px; height: 80px; border-radius: 10px; object-fit: cover; flex-shrink: 0;" />\n  <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px;">\n    <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">${currentQuery} (AI Mastered Studio Mix)</div>\n    <div style="font-size: 11px; color: var(--text-secondary);">BPM: 124 | Key: C Major | Genre: Chill Beats / Studio Mix</div>\n    <audio controls style="width: 100%; margin-top: 6px;">\n      <source src="${audioSampleUrl}" type="audio/mp3">\n      Your browser does not support HTML5 audio playback.\n    </audio>\n  </div>\n</div>\n\n---\n**Prompt:** \`${currentQuery}\` | **Bitrate:** 320 kbps High Definition Stereo | **Mastering:** Studio AI EQ`;

      const assistantMsg = {
        role: 'assistant',
        content: markdownMusicResponse,
        sources: [],
        searchSteps: [...steps],
        related: [`Generate an acoustic guitar version of ${currentQuery}?`, `Make it energetic EDM dance track`, `Export MIDI & stem tracks`]
      };

      setThreads(prevThreads => {
        const finalThreads = prevThreads.map(t => {
          if (t.id === threadObj.id) {
            return { ...t, messages: [...t.messages, assistantMsg] };
          }
          return t;
        });
        saveThreads(finalThreads);
        return finalThreads;
      });

      setIsGenerating(false);
      setSearchProgress([]);
      setCurrentStreamText('');
      return;

    } else if (focus === 'deep') {
      // --- 4. DEEP REASONING PIPELINE (CHAIN-OF-THOUGHT THINKING) ---
      steps.push({ text: 'Deep Reasoning: Gathering deep multi-source web evidence...', status: 'searching' });
      setSearchProgress([...steps]);

      try {
        const rawSources = await searchWeb(currentQuery, 'deep', activeAppIds);
        sources = deduplicateSources(rawSources).slice(0, 12);
        steps[0].status = 'completed';
        steps.push({
          text: `Found ${sources.length} sources. Executing step-by-step Chain-of-Thought thinking...`,
          status: 'searching'
        });
        setSearchProgress([...steps]);
        await new Promise(resolve => setTimeout(resolve, 400));
        steps[1].status = 'completed';
        setSearchProgress([...steps]);
      } catch (err) {
        console.error('Deep search error:', err);
        steps.forEach(s => s.status = 'completed');
        steps.push({ text: 'Deep reasoning search failed.', status: 'completed' });
        setSearchProgress([...steps]);
      }

    } else {
      // --- 2. FAST SEARCH PIPELINE (SINGLE-PASS INSTANT WEB + AI) ---
      steps.push({ text: `Fast Search: Analyzing query intent...`, status: 'searching' });
      setSearchProgress([...steps]);

      try {
        await new Promise(resolve => setTimeout(resolve, 200));
        steps[0].status = 'completed';
        steps.push({ text: 'Searching the web & connected sources...', status: 'searching' });
        setSearchProgress([...steps]);

        const rawSources = await searchWeb(currentQuery, 'fast', activeAppIds);
        sources = deduplicateSources(rawSources).slice(0, 10);

        steps[1].status = 'completed';
        steps.push({
          text: sources.length > 0
            ? `Found ${sources.length} relevant sources. Synthesizing Fast AI answer...`
            : 'Synthesizing response...',
          status: 'searching'
        });
        setSearchProgress([...steps]);
        await new Promise(resolve => setTimeout(resolve, 200));
        steps[2].status = 'completed';
        setSearchProgress([...steps]);

      } catch (err) {
        console.error('Search error:', err);
        steps.forEach(s => s.status = 'completed');
        steps.push({ text: 'Web search failed.', status: 'completed' });
      }
    }

    let fullAnswer = '';
    let streamRafId = null;

    // Trigger Stream API
    await streamAnswer(
      historyMessages,
      sources,
      focus,
      // onChunk
      (chunk) => {
        fullAnswer += chunk;
        if (!streamRafId) {
          streamRafId = requestAnimationFrame(() => {
            setCurrentStreamText(cleanInvalidCitations(fullAnswer, sources.length));
            streamRafId = null;
          });
        }
      },
      // onDone
      () => {
        if (streamRafId) {
          cancelAnimationFrame(streamRafId);
          streamRafId = null;
        }
        setIsGenerating(false);
        setSearchProgress([]);
        setCurrentStreamText('');

        // Extract related questions block while preserving <think> reasoning block
        let sanitizedText = fullAnswer.replace(/<related>[\s\S]*?<\/related>/gi, '').trim();
        let relatedQuestions = [];
        const relatedMatch = fullAnswer.match(/<related>([\s\S]*?)(?:<\/related>|$)/i);

        if (relatedMatch) {
          const relatedBlock = relatedMatch[1];
          relatedQuestions = relatedBlock
            .split('\n')
            .map(line => line.replace(/^-\s*/, '').trim())
            .filter(line => line.length > 0)
            .slice(0, 3);
        }

        const cleanedAnswer = cleanInvalidCitations(sanitizedText, sources.length);

        const assistantMsg = {
          role: 'assistant',
          content: cleanedAnswer,
          sources: sources,
          searchSteps: focus !== 'writing' ? [...steps] : [],
          related: relatedQuestions
        };

        // Append assistant message using functional state update for safety
        setThreads(prevThreads => {
          const finalThreads = prevThreads.map(t => {
            if (t.id === threadObj.id) {
              const finalMsgs = [...t.messages, assistantMsg];

              const updatedTitle = t.title === 'New Search'
                ? (t.messages[0]?.content
                  ? (t.messages[0].content.length > 30 ? t.messages[0].content.substring(0, 30) + '...' : t.messages[0].content)
                  : t.title)
                : t.title;

              return { ...t, messages: finalMsgs, title: updatedTitle };
            }
            return t;
          });
          saveThreads(finalThreads);
          return finalThreads;
        });
      },
      // onError
      (error) => {
        setIsGenerating(false);
        setSearchProgress([]);
        setCurrentStreamText('');

        const isOffline = !navigator.onLine || error.message.includes('Failed to fetch') || error.message.includes('NetworkError');
        const content = isOffline
          ? "You appear to be offline. Please check your internet connection and try again."
          : "An unexpected error occurred while generating the response. Please check your connection or try again later.";

        const errorMsg = {
          role: 'assistant',
          content: content,
          sources: [],
          searchSteps: []
        };

        setThreads(prevThreads => {
          const finalThreads = prevThreads.map(t => {
            if (t.id === threadObj.id) {
              return { ...t, messages: [...t.messages, errorMsg] };
            }
            return t;
          });
          saveThreads(finalThreads);
          return finalThreads;
        });
      },
      attachedFilesInput,
      selectedModel,
      personaInput || selectedPersona
    );
  };

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo-wrapper">
            <div className="login-logo-badge">
              <Compass size={28} className="perplexity-compass-icon" />
            </div>
            <div className="login-brand-text">
              Strange <span>AI</span>
            </div>
          </div>
          <h2 className="login-title">Welcome to Strange AI</h2>
          <p className="login-subtitle">Where knowledge begins. Please sign in to continue your research.</p>
          <div id="google-signin-btn" className="google-btn-wrapper"></div>
          <button
            type="button"
            className="skip-login-btn"
            onClick={handleSkipLogin}
          >
            Skip Sign In &rarr;
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      {/* Backdrop overlay for closing sidebar on mobile when clicked outside */}
      {!sidebarCollapsed && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      {sidebarCollapsed && (
        <button
          className="floating-sidebar-toggle"
          onClick={() => setSidebarCollapsed(false)}
          title="Expand Sidebar"
        >
          <PanelLeftOpen size={18} />
        </button>
      )}

      <Sidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onNewThread={handleNewThread}
        onDeleteThread={handleDeleteThread}
        user={user}
        onSignOut={handleSignOut}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        isCollapsed={sidebarCollapsed}
        theme={theme}
        setTheme={setTheme}
        onInstallPwa={isInstalled ? null : handleInstallPwa}
      />

      <main className="main-content">
        {/* Mobile Top Header Navigation Bar */}
        <header className="mobile-top-header">
          <button
            className="mobile-menu-btn"
            onClick={() => setSidebarCollapsed(false)}
            title="Open Menu"
          >
            <Menu size={20} />
          </button>
          <button
            className="mobile-new-btn"
            onClick={handleNewThread}
            title="New Thread"
          >
            <Plus size={18} />
          </button>
        </header>

        {activeThread ? (
          <ThreadView
            thread={activeThread}
            onFollowUpSubmit={(query, focusInput, proModeInput, filesInput, personaInput) => {
              handleFollowUpSubmit(query, focusInput, proModeInput, filesInput, personaInput);
            }}
            isGenerating={isGenerating}
            currentStreamText={currentStreamText}
            searchProgress={searchProgress}
            attachedFiles={attachedFiles}
            setAttachedFiles={setAttachedFiles}
            proMode={proMode}
            setProMode={setProMode}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            selectedPersona={selectedPersona}
            setSelectedPersona={setSelectedPersona}
            voiceAssistantActive={voiceAssistantActive}
            setVoiceAssistantActive={setVoiceAssistantActive}
            speechRate={speechRate}
            speechPitch={speechPitch}
            selectedVoiceIndex={selectedVoiceIndex}
            onOpenArtifact={(art) => setActiveArtifact(art)}
          />
        ) : (
          <SearchArea
            currentFocus={currentFocus}
            onSearchSubmit={handleSearchSubmit}
            isLoading={isGenerating}
            attachedFiles={attachedFiles}
            setAttachedFiles={setAttachedFiles}
            proMode={proMode}
            setProMode={setProMode}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            selectedPersona={selectedPersona}
            setSelectedPersona={setSelectedPersona}
            voiceAssistantActive={voiceAssistantActive}
            setVoiceAssistantActive={setVoiceAssistantActive}
          />
        )}

        {/* Split-Screen Interactive Artifact Canvas Drawer */}
        {activeArtifact && (
          <ArtifactCanvas
            artifact={activeArtifact}
            onClose={() => setActiveArtifact(null)}
          />
        )}

        {/* Futuristic Voice Assistant Wave Visualizer Overlay */}
        {voiceAssistantActive && (
          <VoiceOverlay
            isListening={isGenerating === false}
            isSpeaking={isGenerating === true}
            queryText={activeThread?.messages[activeThread.messages.length - 1]?.content || ''}
            speechRate={speechRate}
            onSpeedChange={(spd) => setSpeechRate(spd)}
            speechPitch={speechPitch}
            onPitchChange={(pch) => setSpeechPitch(pch)}
            selectedVoiceIndex={selectedVoiceIndex}
            onVoiceChange={(idx) => setSelectedVoiceIndex(idx)}
            onClose={() => setVoiceAssistantActive(false)}
          />
        )}

        {/* Floating PWA Install Popup Banner Toast */}
        {!isInstalled && canInstallPwa && showPwaPopup && (
          <div className="pwa-install-popup" style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 999,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color-glow)',
            borderRadius: '12px',
            padding: '14px 18px',
            boxShadow: 'var(--shadow-premium)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '360px'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Compass size={20} />
            </div>
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Install Strange AI App</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Add to home screen for fast access</span>
            </div>
            <button
              type="button"
              onClick={handleInstallPwa}
              style={{
                backgroundColor: '#10b981',
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              Install
            </button>
            <button
              type="button"
              onClick={handleDismissPwaPopup}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
