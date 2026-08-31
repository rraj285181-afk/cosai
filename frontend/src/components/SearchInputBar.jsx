import React, { useState, useRef, useEffect } from 'react';
import {
  Globe, PenTool, Cpu, User, FileText, BookOpen,
  Lightbulb, Mic, X, ArrowRight, AudioLines, Sparkles, Plus, ToggleLeft, ToggleRight, Layers, Plug,
  Monitor, AppWindow, Paperclip, Camera, Link as LinkIcon, Image as ImageIcon, Music, Video
} from 'lucide-react';
import { startSpeechRecognition, stopSpeechRecognition } from '../utils/speech';
import { fetchYouTubeTranscript, scrapeUrl, API_BASE } from '../utils/api';
import { getConnectedApps } from '../utils/storage';
import { captureDisplayOrWindow, grabFreshScreenshotFromLiveStream, getLiveStreamStatus, stopLiveScreenStream, isAppTrulyConnected, isMobileDevice } from '../utils/helpers';
import PromptTemplates from './PromptTemplates';
import ConnectedModal from './ConnectedModal';

export default function SearchInputBar({
  onSearchSubmit,
  isLoading = false,
  attachedFiles = [],
  setAttachedFiles,
  proMode = false,
  setProMode,
  selectedModel = 'gemini',
  setSelectedModel,
  selectedPersona = 'general',
  setSelectedPersona,
  voiceAssistantActive = false,
  setVoiceAssistantActive,
  placeholder = "Ask anything, paste YouTube URL, upload documents, or use voice...",
  externalQuery = '',
  currentFocus = 'web'
}) {
  const [query, setQuery] = useState(externalQuery || '');
  const [focus, setFocus] = useState(currentFocus || 'web');
  const [selectedModeId, setSelectedModeId] = useState(() => {
    if (currentFocus === 'web') return 'web';
    if (currentFocus === 'pro') return 'pro';
    if (currentFocus === 'deep') return 'deep-reasoning';
    if (currentFocus === 'fast') return 'fast';
    if (currentFocus === 'image-studio') return 'image-studio';
    return 'web';
  });
  const [isListening, setIsListening] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [attachDropdownOpen, setAttachDropdownOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [connectedModalOpen, setConnectedModalOpen] = useState(false);
  const [connectedApps, setConnectedApps] = useState(() => getConnectedApps());
  // Bug Fix: Poll live stream status to keep trulyActiveCount up-to-date
  // liveStreamTick is intentionally read here so each poll tick triggers re-evaluation of isAppTrulyConnected
  const [liveStreamTick, setLiveStreamTick] = useState(0);
  // eslint-disable-next-line no-unused-expressions
  void liveStreamTick;
  const trulyActiveCount = (connectedApps || []).filter(isAppTrulyConnected).length;
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [showPdfOcrModal, setShowPdfOcrModal] = useState(false);
  const [urlToScrape, setUrlToScrape] = useState('');
  const isMobile = isMobileDevice();

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const attachDropdownRef = useRef(null);
  const dropdownRef = useRef(null);
  const modelDropdownRef = useRef(null);
  const ytDebounceTimerRef = useRef(null);
  const speechTimeoutRef = useRef(null);
  const baseTextRef = useRef('');

  useEffect(() => {
    if (currentFocus) {
      setFocus(currentFocus);
      if (currentFocus === 'web') setSelectedModeId('web');
      else if (currentFocus === 'pro') setSelectedModeId('pro');
      else if (currentFocus === 'deep') setSelectedModeId('deep-reasoning');
      else if (currentFocus === 'fast') setSelectedModeId('fast');
      else if (currentFocus === 'image-studio') setSelectedModeId('image-studio');
      else setSelectedModeId('web');
    }
  }, [currentFocus]); // proMode ko dependency se hataya — warna mode switch par focus reset ho jaata tha

  useEffect(() => {
    if (externalQuery) {
      setQuery(externalQuery);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [externalQuery]);

  // Handle outside click for dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (attachDropdownRef.current && !attachDropdownRef.current.contains(e.target)) {
        setAttachDropdownOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Bug Fix: Poll live stream status every second to keep trulyActiveCount badge up-to-date
  // This is needed because screen stream can end from the browser's native stop button
  // which doesn't trigger any React state update
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveStreamTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleScrapeUrlSubmit = async (urlInput) => {
    const targetUrl = urlInput || urlToScrape;
    if (!targetUrl || !targetUrl.trim()) return;

    setIsUploading(true);
    try {
      const scraped = await scrapeUrl(targetUrl.trim());
      const newAttachment = {
        name: `🌐 ${scraped.title || targetUrl}`,
        filename: `Scraped_Page_${Date.now()}.txt`,
        text: `URL: ${targetUrl}\nTitle: ${scraped.title || 'Webpage'}\n\n${scraped.content || scraped.text || ''}`,
        isWebScrape: true
      };
      setAttachedFiles(prev => [...(prev || []), newAttachment].slice(0, 5));
      setShowUrlModal(false);
      setUrlToScrape('');
    } catch (err) {
      console.error('URL Scrape error:', err);
      alert('Failed to scrape webpage content. Please check the URL.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDetectYouTube = (inputUrl) => {
    if (!inputUrl) return;
    const ytMatch = inputUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (!ytMatch || !ytMatch[1]) return;

    if (ytDebounceTimerRef.current) clearTimeout(ytDebounceTimerRef.current);

    ytDebounceTimerRef.current = setTimeout(async () => {
      setIsUploading(true);
      try {
        const data = await fetchYouTubeTranscript(inputUrl);
        const newAttachment = {
          name: `📺 ${data.title}`,
          text: data.transcriptText,
          isYouTube: true
        };
        setAttachedFiles(prev => {
          const current = prev || [];
          if (current.some(f => f.name === newAttachment.name)) return current;
          return [...current, newAttachment].slice(0, 5);
        });
      } catch (err) {
        console.error('YouTube Transcript error:', err);
      } finally {
        setIsUploading(false);
      }
    }, 600);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    let activeFiles = attachedFiles ? [...attachedFiles] : [];

    // Automatically grab fresh real-time screenshot at the moment of sending if stream is connected
    const liveStatus = getLiveStreamStatus();
    if (liveStatus.active) {
      const freshFrame = grabFreshScreenshotFromLiveStream();
      if (freshFrame) {
        activeFiles.push(freshFrame);
      }
    }

    if ((!query || !query.trim()) && activeFiles.length === 0) return;
    onSearchSubmit(query.trim(), focus, proMode, activeFiles, selectedPersona);
    setQuery('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      const newAttachments = data.files.map(f => ({
        name: f.filename,
        filename: f.filename,
        text: f.text,
        isImage: f.isImage,
        mimeType: f.mimeType,
        base64: f.base64
      }));
      setAttachedFiles(prev => [...(prev || []), ...newAttachments].slice(0, 5));
    } catch (err) {
      console.error(err);
      alert('Failed to upload file.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveFile = (indexToRemove) => {
    setAttachedFiles(prev => (prev || []).filter((_, idx) => idx !== indexToRemove));
  };

  const handleScreenCapture = async (surfaceType = 'monitor') => {
    setIsUploading(true);
    try {
      const captureData = await captureDisplayOrWindow(surfaceType);
      setAttachedFiles(prev => [...(prev || []), captureData].slice(0, 5));
    } catch (err) {
      if (!err.message?.includes('cancelled')) {
        alert(err.message || 'Failed to capture screen/window.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleVoiceInput = () => {
    if (isListening) {
      stopSpeechRecognition();
      setIsListening(false);
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
      return;
    }

    // Request browser mic permission explicitly if needed
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
        baseTextRef.current = query || '';
        startSpeechRecognition(
          (final, interim) => {
            const speechText = (final + interim).trim();
            const updatedQuery = baseTextRef.current
              ? `${baseTextRef.current.trim()} ${speechText}`
              : speechText;
            setQuery(updatedQuery);
          },
          (err) => {
            setIsListening(false);
            if (setVoiceAssistantActive) setVoiceAssistantActive(false);
            if (err && err.message && err.message.includes('not allowed')) {
              alert('Microphone access is blocked in your browser. Please click the Lock/Mic icon in your browser address bar and select "Allow Microphone".');
            }
          },
          () => setIsListening(false)
        );
        setIsListening(true);
      }).catch((micErr) => {
        console.warn('Microphone permission denied by user or browser setting:', micErr);
        setIsListening(false);
        if (setVoiceAssistantActive) setVoiceAssistantActive(false);
        alert('Microphone access is blocked in your browser. Please click the Lock/Mic icon in your browser address bar to allow microphone access.');
      });
    } else {
      baseTextRef.current = query || '';
      startSpeechRecognition(
        (final, interim) => {
          const speechText = (final + interim).trim();
          const updatedQuery = baseTextRef.current
            ? `${baseTextRef.current.trim()} ${speechText}`
            : speechText;
          setQuery(updatedQuery);
        },
        (err) => {
          setIsListening(false);
          if (setVoiceAssistantActive) setVoiceAssistantActive(false);
        },
        () => setIsListening(false)
      );
      setIsListening(true);
    }
  };

  const [activeMenuTab, setActiveMenuTab] = useState('modes'); // 'modes' | 'workflows'

  const searchModes = [
    { id: 'web', name: 'Web Search', focus: 'web', persona: 'general', setPro: false, icon: <Globe size={14} style={{ color: '#10b981' }} />, desc: 'Pure web search engine results without AI API' },
    { id: 'fast', name: 'Fast Search', focus: 'fast', persona: 'general', setPro: false, icon: <Sparkles size={14} style={{ color: '#eab308' }} />, desc: 'Instant single-pass web answer' },
    { id: 'pro', name: 'Pro Search', focus: 'pro', persona: 'general', setPro: true, icon: <Sparkles size={14} style={{ color: '#10b981' }} />, desc: 'Comprehensive multi-query expanded web search' },
    { id: 'deep-reasoning', name: 'Deep Reasoning', focus: 'deep', persona: 'scientist', setPro: false, icon: <Cpu size={14} style={{ color: '#06b6d4' }} />, desc: 'Step-by-step logic & Chain-of-Thought thinking' },
    { id: 'image-studio', name: 'AI Image Studio', focus: 'image-studio', persona: 'writer', setPro: false, icon: <ImageIcon size={14} style={{ color: '#ec4899' }} />, desc: 'Generate 4K AI visual artwork & concept images from prompt' },
    { id: 'video-studio', name: 'AI Video Studio', focus: 'video-studio', persona: 'writer', setPro: false, icon: <Video size={14} style={{ color: '#ef4444' }} />, desc: 'Generate & stream HD video clips, animations & MP4 previews' },
    { id: 'music-studio', name: 'AI Music & Song Studio', focus: 'music-studio', persona: 'writer', setPro: false, icon: <Music size={14} style={{ color: '#a855f7' }} />, desc: 'Compose, generate & stream custom AI music beats, songs & MP3 tracks' }
  ];

  const workflowItems = [
    {
      id: 'coder-audit',
      title: 'Coding & Code Audit',
      icon: <Cpu size={14} style={{ color: '#10b981' }} />,
      desc: 'Clean code architecture, bug audit & GitHub search',
      persona: 'coder',
      focus: 'all',
      prompt: 'Review the following code for performance bottlenecks, security vulnerabilities, edge cases, and provide an optimized refactored version with unit tests:'
    },
    {
      id: 'music-studio',
      title: 'AI Song & Music Studio (5)',
      icon: <Music size={14} style={{ color: '#f59e0b' }} />,
      desc: 'Compose song lyrics, genre production tags & audio prompts',
      persona: 'writer',
      focus: 'all',
      prompt: 'Compose a complete song with Intro, Verse 1, Chorus, Verse 2, Bridge, and Outro, along with musical genre style tags (e.g. Synthwave 120bpm, Lo-Fi Chill, Acoustic Pop, Bollywood Melodic):'
    },
    {
      id: 'academic-paper',
      title: 'Academic Paper Research',
      icon: <BookOpen size={14} style={{ color: '#3b82f6' }} />,
      desc: 'Scholarly paper breakdown, formulas & methodology',
      persona: 'scientist',
      focus: 'academic',
      prompt: 'Analyze this research paper/topic and provide a structured breakdown covering: 1. Main Thesis, 2. Key Methodology, 3. Critical Data Findings, 4. Limitations:'
    },
    {
      id: 'seo-writing',
      title: 'Writing & SEO Strategy',
      icon: <PenTool size={14} style={{ color: '#ec4899' }} />,
      desc: 'Target keywords, H2/H3 article outline & FAQs',
      persona: 'writer',
      focus: 'all',
      prompt: 'Generate an exhaustive SEO content strategy and article outline for this topic, including target keywords, H2/H3 structure, key takeaways, and FAQs:'
    },
    {
      id: 'concept-tutor',
      title: 'Study & Concept Tutor',
      icon: <Lightbulb size={14} style={{ color: '#8b5cf6' }} />,
      desc: 'Step-by-step analogies, logic breakdown & quiz',
      persona: 'tutor',
      focus: 'all',
      prompt: 'Explain the following concept step-by-step using beginner-friendly analogies, real-world examples, core formulas, and conclude with a 3-question quiz:'
    },
    {
      id: 'ats-resume',
      title: 'ATS Resume & Cover Letter',
      icon: <FileText size={14} style={{ color: '#f59e0b' }} />,
      desc: 'High-impact action verbs, metrics & ATS keywords',
      persona: 'writer',
      focus: 'writing',
      prompt: 'Analyze and optimize this resume experience section for ATS screening by adding high-impact action verbs, quantifiable metrics, and keyword alignment:'
    },
    {
      id: 'market-analysis',
      title: 'Market Research & SWOT Strategy',
      icon: <Sparkles size={14} style={{ color: '#06b6d4' }} />,
      desc: 'Industry trends, competitor analysis & growth plan',
      persona: 'general',
      focus: 'all',
      prompt: 'Perform a comprehensive market research and competitor breakdown for this industry/product, including market size, key target demographics, SWOT analysis, and growth strategies:'
    }
  ];

  const liveStatus = getLiveStreamStatus();

  const getDynamicPlaceholder = () => {
    const activeMode = selectedModeId || currentFocus || 'web';
    switch (activeMode) {
      case 'fast':
        return "Ask any question for instant fast web answer...";
      case 'pro':
        return "Enter detailed research topic for multi-query Pro analysis...";
      case 'deep-reasoning':
      case 'deep':
        return "Enter complex problem, formula, or logic for step-by-step deep reasoning...";
      case 'image-studio':
        return "Describe the AI visual artwork or 4K concept image you want to generate...";
      case 'video-studio':
        return "Describe the HD video scene, animation, or video loop you want to generate...";
      case 'music-studio':
        return "Describe the music beat, song lyrics, or audio style you want to compose...";
      case 'web':
      default:
        return placeholder && placeholder !== "Ask anything, paste YouTube URL, upload documents, or use voice..."
          ? placeholder
          : "Ask anything, search the web, paste YouTube URL, or upload documents...";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="search-box-wrapper">
      {/* Live Stream Active Indicator Pill */}
      {liveStatus.active && (
        <div className="attachment-container">
          <div className="attachment-pill capture-pill" style={{ borderColor: '#10b981', color: '#10b981', background: 'rgba(16, 185, 129, 0.12)' }}>
            <span className="obs-live-dot" />
            <span>{liveStatus.label} Active — Grabs instant snapshot when you click Send</span>
            <button
              type="button"
              className="attachment-remove-btn"
              onClick={() => {
                stopLiveScreenStream();
                setTick(t => t + 1);
              }}
              title="Disconnect Stream"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Uploaded File & Screen Capture Pills */}
      {attachedFiles && attachedFiles.length > 0 && (
        <div className="attachment-container">
          {attachedFiles.map((file, idx) => (
            <div key={idx} className={`attachment-pill ${file.isCapture ? 'capture-pill' : ''}`}>
              {file.dataUrl ? (
                <img src={file.dataUrl} alt="" className="attachment-thumb" />
              ) : file.isCapture ? (
                <Monitor size={13} style={{ color: '#06b6d4' }} />
              ) : file.isVideo ? (
                <Video size={13} style={{ color: '#ef4444' }} />
              ) : file.isAudio ? (
                <Music size={13} style={{ color: '#a855f7' }} />
              ) : (
                <FileText size={13} style={{ color: '#10b981' }} />
              )}
              <span className="attachment-name">{file.name || file.filename}</span>
              <button
                type="button"
                className="attachment-remove-btn"
                onClick={() => handleRemoveFile(idx)}
                title="Remove attachment"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={query}
        onChange={(e) => {
          const val = e.target.value;
          setQuery(val);
          if (val.includes('youtube.com/') || val.includes('youtu.be/')) {
            handleDetectYouTube(val);
          }
        }}
        placeholder={getDynamicPlaceholder()}
        className="search-textarea"
        onKeyDown={handleKeyDown}
        rows={1}
        disabled={isLoading || isUploading}
      />

      <div className="search-controls">
        <div className="search-options" style={{ gap: '8px' }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".pdf,.txt,.md,.json,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov,.mkv,.mp3,.wav,.aac,.ogg,.m4a,.flac"
            multiple
            onChange={handleFileChange}
          />
          <input
            type="file"
            ref={cameraInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
          />

          {/* Unified Attach & Connections Dropdown Button */}
          <div className="focus-dropdown-wrapper" ref={attachDropdownRef}>
            <button
              type="button"
              className={`control-btn ${(attachedFiles && attachedFiles.length > 0) || trulyActiveCount > 0 ? 'active' : ''}`}
              onClick={() => setAttachDropdownOpen(!attachDropdownOpen)}
              disabled={isLoading || isUploading}
              title="Attach Document, Image, Screen Capture, or Connected Apps"
            >
              <Plus size={15} />
              {trulyActiveCount > 0 && (
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', marginLeft: '2px' }}>
                  ({trulyActiveCount})
                </span>
              )}
            </button>

            {attachDropdownOpen && (
              <div className="focus-dropdown-menu" style={{ minWidth: '230px' }}>
                <button
                  type="button"
                  className="focus-dropdown-item"
                  onClick={() => {
                    setAttachDropdownOpen(false);
                    fileInputRef.current?.click();
                  }}
                  disabled={isLoading || isUploading}
                >
                  <div className="focus-item-icon">
                    <Paperclip size={15} style={{ color: '#10b981' }} />
                  </div>
                  <div className="focus-item-content">
                    <div className="focus-item-name">Upload File / Image</div>
                    <div className="focus-item-desc">PDF, TXT, MD, JSON, PNG, JPG</div>
                  </div>
                </button>

                <button
                  type="button"
                  className="focus-dropdown-item"
                  onClick={() => {
                    setAttachDropdownOpen(false);
                    cameraInputRef.current?.click();
                  }}
                  disabled={isLoading || isUploading}
                >
                  <div className="focus-item-icon">
                    <Camera size={15} style={{ color: '#ec4899' }} />
                  </div>
                  <div className="focus-item-content">
                    <div className="focus-item-name">Take Photo (Camera)</div>
                    <div className="focus-item-desc">Capture photo directly using device camera</div>
                  </div>
                </button>

                <button
                  type="button"
                  className="focus-dropdown-item"
                  onClick={() => {
                    setAttachDropdownOpen(false);
                    setShowUrlModal(true);
                  }}
                  disabled={isLoading || isUploading}
                >
                  <div className="focus-item-icon">
                    <Globe size={15} style={{ color: '#8b5cf6' }} />
                  </div>
                  <div className="focus-item-content">
                    <div className="focus-item-name">Summarize Web URL</div>
                    <div className="focus-item-desc">Scrape & summarize any web page link</div>
                  </div>
                </button>

                <button
                  type="button"
                  className="focus-dropdown-item"
                  onClick={() => {
                    setAttachDropdownOpen(false);
                    setShowPdfOcrModal(true);
                  }}
                  disabled={isLoading || isUploading}
                >
                  <div className="focus-item-icon">
                    <FileText size={15} style={{ color: '#06b6d4' }} />
                  </div>
                  <div className="focus-item-content">
                    <div className="focus-item-name">PDF OCR & Document Scanner</div>
                    <div className="focus-item-desc">Extract text & analyze multi-page PDF files</div>
                  </div>
                </button>

                <button
                  type="button"
                  className="focus-dropdown-item"
                  onClick={() => {
                    if (isMobile) return;
                    setAttachDropdownOpen(false);
                    handleScreenCapture('monitor');
                  }}
                  disabled={isLoading || isUploading || isMobile}
                  title={isMobile ? 'Screen Capture is only available on desktop browsers' : 'Take an instant screenshot'}
                  style={isMobile ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
                >
                  <div className="focus-item-icon">
                    <Monitor size={15} style={{ color: '#06b6d4' }} />
                  </div>
                  <div className="focus-item-content">
                    <div className="focus-item-name">Capture Screen / Window</div>
                    <div className="focus-item-desc">
                      {isMobile ? '🖥️ Desktop browsers only' : 'Instant live screenshot snapshot'}
                    </div>
                  </div>
                </button>

                <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />

                <button
                  type="button"
                  className={`focus-dropdown-item ${trulyActiveCount > 0 ? 'active' : ''}`}
                  onClick={() => {
                    setAttachDropdownOpen(false);
                    setConnectedModalOpen(true);
                  }}
                  disabled={isLoading || isUploading}
                >
                  <div className="focus-item-icon">
                    <Plug size={15} style={{ color: '#10b981' }} />
                  </div>
                  <div className="focus-item-content">
                    <div className="focus-item-name">Connected Apps & Sources</div>
                    <div className="focus-item-desc">
                      {trulyActiveCount > 0 ? `${trulyActiveCount} active integrations` : 'Google Drive, GitHub, Notion, OBS'}
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Unified Search Mode Selector Dropdown */}
          <div className="focus-dropdown-wrapper" ref={dropdownRef}>
            <button
              type="button"
              className={`control-btn ${(focus !== 'all' || selectedPersona !== 'general' || proMode) ? 'active' : ''}`}
              onClick={() => setDropdownOpen(!dropdownOpen)}
              disabled={isLoading || isUploading}
              title="Select Search Mode & Workflows"
            >
              {(searchModes.find(m => m.id === selectedModeId) || searchModes[0]).icon}
              <span>
                {(searchModes.find(m => m.id === selectedModeId) || searchModes[0]).name}
              </span>
            </button>

            {dropdownOpen && (
              <div className="unified-search-menu">
                <div className="unified-menu-header">
                  <div className="unified-menu-tabs">
                    <button
                      type="button"
                      className={`unified-tab ${activeMenuTab === 'modes' ? 'active' : ''}`}
                      onClick={() => setActiveMenuTab('modes')}
                    >
                      <Globe size={13} />
                      <span>Modes</span>
                    </button>
                    <button
                      type="button"
                      className={`unified-tab ${activeMenuTab === 'workflows' ? 'active' : ''}`}
                      onClick={() => setActiveMenuTab('workflows')}
                    >
                      <Layers size={13} style={{ color: '#10b981' }} />
                      <span>Workflows</span>
                    </button>
                  </div>
                </div>

                <div className="unified-tab-content">
                  {activeMenuTab === 'modes' ? (
                    <>
                      {searchModes.map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          className={`focus-dropdown-item ${selectedModeId === mode.id ? 'active' : ''}`}
                          onClick={() => {
                            setFocus(mode.focus);
                            if (setSelectedPersona) setSelectedPersona(mode.persona);
                            if (mode.setPro !== undefined && setProMode) setProMode(mode.setPro);
                            setSelectedModeId(mode.id);
                            setDropdownOpen(false);
                          }}
                          disabled={isLoading || isUploading}
                        >
                          <div className="focus-item-icon">{mode.icon}</div>
                          <div className="focus-item-content">
                            <div className="focus-item-name">{mode.name}</div>
                            <div className="focus-item-desc">{mode.desc}</div>
                          </div>
                        </button>
                      ))}
                    </>
                  ) : (
                    <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {workflowItems.map((wf) => (
                        <button
                          key={wf.id}
                          type="button"
                          className="focus-dropdown-item"
                          onClick={() => {
                            if (wf.prompt) setQuery(wf.prompt + ' ');
                            setFocus(wf.focus);
                            if (setSelectedPersona) setSelectedPersona(wf.persona);
                            if (wf.setPro !== undefined && setProMode) setProMode(wf.setPro);
                            setDropdownOpen(false);
                            textareaRef.current?.focus();
                          }}
                          disabled={isLoading || isUploading}
                        >
                          <div className="focus-item-icon">{wf.icon}</div>
                          <div className="focus-item-content">
                            <div className="focus-item-name">{wf.title}</div>
                            <div className="focus-item-desc">{wf.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="search-controls-right">
          {/* Model dropdown */}
          <div className="focus-dropdown-wrapper" ref={modelDropdownRef}>
            <button
              type="button"
              className={`control-btn ${selectedModel !== 'gemini' ? 'active' : ''}`}
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              disabled={isLoading || isUploading}
              title="Change AI model"
            >
              <Cpu size={14} />
              <span>Model: {selectedModel === 'gemini' ? 'Gemini' : 'GPT-4o'}</span>
            </button>

            {modelDropdownOpen && (
              <div className="focus-dropdown-menu" style={{ width: 'max-content', left: '0', right: 0 }}>
                <button
                  type="button"
                  className={`focus-dropdown-item ${selectedModel === 'gemini' ? 'active' : ''}`}
                  onClick={() => {
                    if (setSelectedModel) setSelectedModel('gemini');
                    setModelDropdownOpen(false);
                  }}
                  disabled={isLoading || isUploading}
                >
                  <div className="focus-item-content">
                    <div className="focus-item-name">Gemini 3.6 Flash</div>
                    <div className="focus-item-desc">Fast, default search assistant</div>
                  </div>
                </button>
                <button
                  type="button"
                  className={`focus-dropdown-item ${selectedModel === 'openai' ? 'active' : ''}`}
                  onClick={() => {
                    if (setSelectedModel) setSelectedModel('openai');
                    setModelDropdownOpen(false);
                  }}
                  disabled={isLoading || isUploading}
                >
                  <div className="focus-item-content">
                    <div className="focus-item-name">GPT-4o Mini</div>
                    <div className="focus-item-desc">OpenAI intelligence backup</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Speech to Text dictation button */}
          <button
            type="button"
            className={`control-btn ${isListening ? 'active' : ''}`}
            onClick={handleVoiceInput}
            title={isListening ? 'Listening... Click to stop' : 'Speech to Text (Voice Input)'}
            disabled={isLoading || isUploading}
          >
            <Mic size={14} className={isListening ? 'recording' : ''} style={{ color: isListening ? '#ef4444' : '' }} />
          </button>

          {/* Dynamic Switch: Send Query Button (if query/files exist) vs Voice Assistant Mode Button (if empty) */}
          {query.trim() || (attachedFiles && attachedFiles.length > 0) ? (
            <button
              type="submit"
              className="send-query-btn"
              disabled={isLoading || isUploading}
              style={{ width: '32px', height: '32px' }}
              title="Send Query"
            >
              <ArrowRight size={18} />
            </button>
          ) : (
            <button
              type="button"
              className={`send-query-btn voice-chat-btn ${voiceAssistantActive ? 'active' : ''}`}
              disabled={isLoading || isUploading}
              style={{ width: '32px', height: '32px' }}
              onClick={() => {
                const nextState = !voiceAssistantActive;
                if (setVoiceAssistantActive) setVoiceAssistantActive(nextState);
                if (nextState) {
                  setTimeout(() => handleVoiceInput(), 100);
                } else {
                  stopSpeechRecognition();
                  setIsListening(false);
                }
              }}
              title={voiceAssistantActive ? 'Voice Assistant Mode: ON (Click to disable)' : 'Turn on Voice Assistant Mode'}
            >
              <AudioLines size={18} className={voiceAssistantActive ? 'recording' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Voice Assistant Live Indicator Bar */}
      {voiceAssistantActive && (
        <div className="voice-assistant-bar">
          <AudioLines size={14} className="pulse-icon" />
          <span>Voice Assistant Active — Listening & Auto-sending on pause</span>
          <button
            type="button"
            onClick={() => {
              if (setVoiceAssistantActive) setVoiceAssistantActive(false);
              stopSpeechRecognition();
              setIsListening(false);
            }}
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', marginLeft: 'auto' }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Workflows Modal */}
      <PromptTemplates
        isOpen={templatesModalOpen}
        onClose={() => setTemplatesModalOpen(false)}
        onSelectTemplate={(promptText, tplFocus, tplPersona) => {
          setQuery(promptText + ' ');
          if (tplFocus) setFocus(tplFocus);
          if (tplPersona && setSelectedPersona) setSelectedPersona(tplPersona);
          textareaRef.current?.focus();
        }}
      />

      {/* Connected Modal */}
      <ConnectedModal
        isOpen={connectedModalOpen}
        onClose={() => {
          setConnectedModalOpen(false);
          // Bug Fix: Re-sync connectedApps from localStorage when modal closes
          // so trulyActiveCount updates immediately after changes
          setConnectedApps(getConnectedApps());
        }}
        onUpdateConnections={(updatedApps) => setConnectedApps(updatedApps)}
        onAttachFile={(captureData) => setAttachedFiles(prev => [...(prev || []), captureData].slice(0, 5))}
      />

      {/* Web Page Summarizer URL Modal */}
      {showUrlModal && (
        <div className="image-lightbox-overlay" onClick={() => setShowUrlModal(false)}>
          <div className="connected-modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="connected-modal-header">
              <div className="connected-modal-title-group">
                <div className="connected-icon-badge" style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
                  <Globe size={20} />
                </div>
                <div>
                  <h3 className="connected-modal-title">Summarize Web Page</h3>
                  <p className="connected-modal-subtitle">Paste any article or website link to scrape & attach</p>
                </div>
              </div>
              <button className="connected-modal-close" onClick={() => setShowUrlModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="url"
                className="connected-config-input"
                placeholder="https://example.com/article"
                value={urlToScrape}
                onChange={(e) => setUrlToScrape(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleScrapeUrlSubmit();
                  }
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="connected-cancel-btn"
                  onClick={() => setShowUrlModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="connected-save-btn"
                  onClick={() => handleScrapeUrlSubmit()}
                  disabled={!urlToScrape.trim() || isUploading}
                >
                  {isUploading ? 'Scraping...' : 'Fetch & Attach'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF OCR & Document Scanner Modal */}
      {showPdfOcrModal && (
        <div className="image-lightbox-overlay" onClick={() => setShowPdfOcrModal(false)}>
          <div className="connected-modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="connected-modal-header">
              <div className="connected-modal-title-group">
                <div className="connected-icon-badge" style={{ backgroundColor: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="connected-modal-title">PDF OCR & Document Scanner</h3>
                  <p className="connected-modal-subtitle">Extract text, tables & data from multi-page PDFs</p>
                </div>
              </div>
              <button className="connected-modal-close" onClick={() => setShowPdfOcrModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              <div
                style={{
                  border: '2px dashed var(--border-color-glow)',
                  borderRadius: '12px',
                  padding: '24px 16px',
                  width: '100%',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: 'rgba(6, 182, 212, 0.05)'
                }}
                onClick={() => {
                  setShowPdfOcrModal(false);
                  fileInputRef.current?.click();
                }}
              >
                <FileText size={32} style={{ color: '#06b6d4', marginBottom: '8px' }} />
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Click to Select & Scan PDF Document</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Supports PDF, TXT, MD & DOC files up to 25MB</div>
              </div>

              <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="connected-cancel-btn"
                  onClick={() => setShowPdfOcrModal(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="connected-save-btn"
                  onClick={() => {
                    setShowPdfOcrModal(false);
                    fileInputRef.current?.click();
                  }}
                >
                  Select PDF File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
