import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Globe, BookOpen, Newspaper, Plus, Check, Copy, Share2,
  ArrowUp, Sparkles, MessageSquare, ListCollapse, ArrowRight, CornerDownLeft,
  Volume2, VolumeX, Palette, Image as ImageIcon, Paperclip, Mic, X, Pencil,
  Download, Printer, Cpu, AudioLines, PenTool, ToggleLeft, ToggleRight, Plug, Lightbulb,
  MoreHorizontal, MoreVertical
} from 'lucide-react';
import { speakText, stopSpeaking, startSpeechRecognition, stopSpeechRecognition } from '../utils/speech';
import { fetchYouTubeTranscript, searchImages, API_BASE } from '../utils/api';
import { getConnectedApps } from '../utils/storage';
import Mermaid from './Mermaid';
import CodeRunner from './CodeRunner';
import SourceCard from './SourceCard';
import ConnectedModal from './ConnectedModal';
import SearchInputBar from './SearchInputBar';

// Helper to parse <think>...</think> blocks from response text
function parseThinkingContent(text) {
  if (!text) return { thinkText: null, answerText: '' };

  const thinkStart = text.indexOf('<think>');
  if (thinkStart === -1) {
    return { thinkText: null, answerText: text };
  }

  const thinkEnd = text.indexOf('</think>');
  if (thinkEnd !== -1) {
    const thinkText = text.substring(thinkStart + 7, thinkEnd).trim();
    const answerText = text.substring(thinkEnd + 8).trim();
    return { thinkText, answerText, isThinking: false };
  } else {
    // Currently streaming inside <think> block
    const thinkText = text.substring(thinkStart + 7).trim();
    return { thinkText, answerText: '', isThinking: true };
  }
}

// Collapsible Deep Reasoning Component
function DeepReasoningBox({ thinkText, isThinking }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!thinkText) return null;

  return (
    <div className="deep-reasoning-container">
      <button
        type="button"
        className="deep-reasoning-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="deep-reasoning-title">
          <Cpu size={15} className={`deep-reasoning-icon ${isThinking ? 'pulsing' : ''}`} />
          <span>Deep Reasoning Process</span>
          {isThinking && <span className="thinking-badge">Thinking...</span>}
        </div>
        <div className="deep-reasoning-toggle">
          {isOpen ? <ListCollapse size={14} /> : <ArrowRight size={14} />}
        </div>
      </button>

      {isOpen && (
        <div className="deep-reasoning-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {thinkText}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

export default function ThreadView({

  thread,
  onFollowUpSubmit,
  isGenerating,
  currentStreamText,
  searchProgress,
  attachedFiles = [],
  setAttachedFiles,
  proMode,
  setProMode,
  selectedModel = 'gemini',
  setSelectedModel,
  selectedPersona = 'general',
  setSelectedPersona,
  voiceAssistantActive = false,
  setVoiceAssistantActive,
  speechRate = 1.05,
  speechPitch = 1.0,
  selectedVoiceIndex = 0,
  onOpenArtifact
}) {
  const [followUpText, setFollowUpText] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);

  // TTS & Image Gen states
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const [generatedImages, setGeneratedImages] = useState({});
  const [imageLoading, setImageLoading] = useState({});

  // STT state
  const [isListening, setIsListening] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Connected Modal state
  const [connectedModalOpen, setConnectedModalOpen] = useState(false);
  const [connectedApps, setConnectedApps] = useState(() => getConnectedApps());

  // Media Tab & Image Search states
  const [activeMediaTab, setActiveMediaTab] = useState({}); // { [msgIndex]: 'sources' | 'images' }
  const [messageImages, setMessageImages] = useState({});
  const [imagesLoading, setImagesLoading] = useState({});
  const [lightboxImage, setLightboxImage] = useState(null);

  // Citation Tooltip & Highlight states
  const [tooltipSource, setTooltipSource] = useState(null); // { index, title, url, snippet, rect }
  const [activeHighlightSource, setActiveHighlightSource] = useState(null);
  const [activeReenterIndex, setActiveReenterIndex] = useState(null);
  const [printIndex, setPrintIndex] = useState(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [focus, setFocus] = useState(thread?.focus || 'web');
  const [sharedIndex, setSharedIndex] = useState(null);
  const [openActionMenu, setOpenActionMenu] = useState(null);

  const searchModes = [
    { id: 'all', name: 'Web Search', focus: 'all', persona: 'general', icon: <Globe size={14} />, desc: 'Search the entire web & get cited answers' },
    { id: 'coder', name: 'Coding & Dev', focus: 'all', persona: 'coder', icon: <Cpu size={14} style={{ color: '#10b981' }} />, desc: 'Clean code, architecture & GitHub search' },
    { id: 'academic', name: 'Academic Research', focus: 'academic', persona: 'scientist', icon: <BookOpen size={14} style={{ color: '#3b82f6' }} />, desc: 'Scholarly papers, formulas & deep research' },
    { id: 'writing', name: 'Writing & Copy', focus: 'writing', persona: 'writer', icon: <PenTool size={14} style={{ color: '#f59e0b' }} />, desc: 'Creative writing & copy without web search' },
    { id: 'tutor', name: 'Study & Tutor', focus: 'all', persona: 'tutor', icon: <Lightbulb size={14} style={{ color: '#a855f7' }} />, desc: 'Step-by-step learning guide & quizzes' }
  ];

  const handleFetchImagesForMessage = async (msgIndex, userQuery) => {
    setActiveMediaTab(prev => ({ ...prev, [msgIndex]: 'images' }));
    if (messageImages[msgIndex] || imagesLoading[msgIndex]) return;

    setImagesLoading(prev => ({ ...prev, [msgIndex]: true }));
    try {
      const imgs = await searchImages(userQuery || thread.title || 'technology research');
      setMessageImages(prev => ({ ...prev, [msgIndex]: imgs }));
    } catch (err) {
      console.error('Error fetching images:', err);
    } finally {
      setImagesLoading(prev => ({ ...prev, [msgIndex]: false }));
    }
  };

  // Sync focus with thread focus when thread changes
  useEffect(() => {
    setFocus(thread?.focus || 'web');
  }, [thread]);

  const voiceAssistantActiveRef = useRef(voiceAssistantActive);
  useEffect(() => {
    voiceAssistantActiveRef.current = voiceAssistantActive;
  }, [voiceAssistantActive]);

  const handleShare = async (msg, index) => {
    try {
      let sourcesText = '';
      if (msg.sources && msg.sources.length > 0) {
        sourcesText = '\n\nSources:\n' + msg.sources.map((src, i) => `[${i + 1}] ${src.title} - ${src.url}`).join('\n');
      }

      const queryTitle = thread.messages[0]?.content || 'Research Report';
      const formattedText = `=== STRANGE AI RESEARCH REPORT ===\n\nQuery: ${queryTitle}\n\nAnswer:\n${msg.content}${sourcesText}\n\n=================================`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: `Strange AI: ${queryTitle.length > 50 ? queryTitle.substring(0, 50) + '...' : queryTitle}`,
            text: formattedText
          });
          setSharedIndex(index);
          setTimeout(() => setSharedIndex(null), 2000);
          return;
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') return; // User cancelled share sheet
        }
      }

      await navigator.clipboard.writeText(formattedText);
      setSharedIndex(index);
      setTimeout(() => {
        setSharedIndex(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to share report:', err);
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target)) {
        setModelDropdownOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (!event.target.closest('.action-menu-wrapper')) {
        setOpenActionMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleExportMD = (content, index) => {
    try {
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `research_report_${index + 1}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export Markdown:', err);
      alert('Failed to export research report.');
    }
  };

  const handleExportPDF = (index) => {
    setPrintIndex(index);
    setTimeout(() => {
      window.print();
      setPrintIndex(null);
    }, 150);
  };

  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const speechIntervalRef = useRef(null);
  const speechTimeoutRef = useRef(null);
  const baseTextRef = useRef('');

  // Auto-scroll inside chat container when new messages or chunks arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [thread.messages, currentStreamText, searchProgress]);

  // Auto-resize follow-up textarea and reset on clear or submit
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      if (followUpText) {
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
      }
    }
  }, [followUpText, isGenerating]);

  // Stop speaking and close tooltips when user navigates away or thread changes
  useEffect(() => {
    stopSpeaking();
    setSpeakingIndex(null);
    setTooltipSource(null);
    if (speechIntervalRef.current) {
      clearInterval(speechIntervalRef.current);
      speechIntervalRef.current = null;
    }
  }, [thread.id]);

  // Clean up interval, speech, and speech recognition on component unmount
  useEffect(() => {
    return () => {
      if (speechIntervalRef.current) {
        clearInterval(speechIntervalRef.current);
      }
      stopSpeaking();
      stopSpeechRecognition();
    };
  }, []);

  // Close tooltip when clicking anywhere else on the screen
  useEffect(() => {
    const handleGlobalClick = () => {
      setTooltipSource(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleFollowUpSubmit = (e) => {
    if (e) e.preventDefault();
    if (!followUpText.trim() || isGenerating || isUploading) return;
    onFollowUpSubmit(followUpText.trim(), focus, proMode, attachedFiles);
    setFollowUpText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFollowUpSubmit();
    }
  };

  const handleCopyText = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSpeak = (text, idx) => {
    if (speakingIndex === idx) {
      stopSpeaking();
      setSpeakingIndex(null);
      if (speechIntervalRef.current) {
        clearInterval(speechIntervalRef.current);
        speechIntervalRef.current = null;
      }
    } else {
      speakText(text, { rate: speechRate, pitch: speechPitch, voiceIndex: selectedVoiceIndex });
      setSpeakingIndex(idx);

      if (speechIntervalRef.current) {
        clearInterval(speechIntervalRef.current);
      }

      // Auto reset speaking icon when speech ends
      if (window.speechSynthesis) {
        speechIntervalRef.current = setInterval(() => {
          if (!window.speechSynthesis.speaking) {
            setSpeakingIndex(null);
            if (speechIntervalRef.current) {
              clearInterval(speechIntervalRef.current);
              speechIntervalRef.current = null;
            }
          }
        }, 1000);
      }
    }
  };

  const handleGenerateImage = (msgIndex, responseText) => {
    setImageLoading(prev => ({ ...prev, [msgIndex]: true }));

    let userQuestion = thread.messages[msgIndex - 1]?.content || 'scientific discovery concept art';

    let cleanPrompt = userQuestion
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(' ')
      .filter(w => w.length > 2)
      .slice(0, 6)
      .join('_');

    if (!cleanPrompt) {
      cleanPrompt = 'cybernetic_research_dashboard';
    }

    const imageUrl = `https://image.pollinations.ai/p/${cleanPrompt}_highly_detailed_science_visualization_digital_art?width=640&height=480&nologo=true&seed=${Math.floor(Math.random() * 1000)}`;

    setTimeout(() => {
      setGeneratedImages(prev => ({ ...prev, [msgIndex]: imageUrl }));
      setImageLoading(prev => ({ ...prev, [msgIndex]: false }));
    }, 1800);
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setIsUploading(true);

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });


    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
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
      alert(err.message || 'Failed to upload and parse documents. Make sure they are valid PDF, TXT, MD, or JSON files.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const ytDebounceTimerRef = useRef(null);

  const handleDetectYouTube = (inputUrl) => {
    if (!inputUrl) return;

    // Match YouTube 11-character video ID regex
    const ytMatch = inputUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (!ytMatch || !ytMatch[1]) return;

    const videoId = ytMatch[1];

    if (ytDebounceTimerRef.current) {
      clearTimeout(ytDebounceTimerRef.current);
    }

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
        setFollowUpText('Provide the full video script overview, key timestamps breakdown, core takeaways, and main Q&A for this YouTube video:');
      } catch (err) {
        console.error(err);
        alert(err.message || 'Could not fetch YouTube transcript/captions. Make sure captions/subtitles are enabled on this video.');
      } finally {
        setIsUploading(false);
      }
    }, 700);
  };

  const handleVoiceInput = () => {
    if (isListening) {
      stopSpeechRecognition();
      setIsListening(false);
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
      return;
    }

    baseTextRef.current = followUpText || '';

    startSpeechRecognition(
      (final, interim) => {
        const speechText = (final + interim).trim();
        const updatedQuery = baseTextRef.current
          ? `${baseTextRef.current.trim()} ${speechText}`
          : speechText;

        setFollowUpText(updatedQuery);

        if (voiceAssistantActiveRef.current) {
          if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
          speechTimeoutRef.current = setTimeout(() => {
            stopSpeechRecognition();
            setIsListening(false);
            onFollowUpSubmit(updatedQuery.trim(), focus, proMode, attachedFiles);
            setFollowUpText('');
          }, 2000);
        } else {
          if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
          speechTimeoutRef.current = setTimeout(() => {
            stopSpeechRecognition();
            setIsListening(false);
          }, 4000);
        }
      },
      (err) => {
        console.error(err);
        setIsListening(false);
      },
      () => {
        setIsListening(false);
      }
    );
    setIsListening(true);
  };

  // Hands-free Voice Assistant loop: speak AI response → restart mic
  // Triggers whenever isGenerating finishes while voice mode is active
  useEffect(() => {
    if (!voiceAssistantActive || isGenerating) return;
    if (thread.messages.length === 0) return;

    const lastMsg = thread.messages[thread.messages.length - 1];
    if (lastMsg.role !== 'assistant') return;

    // Cancel any lingering mic session before speaking
    stopSpeechRecognition();
    setIsListening(false);
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);

    // Speak response; on TTS end, restart mic with a small delay
    speakText(lastMsg.content, {
      rate: speechRate,
      onEnd: () => {
        setTimeout(() => {
          if (voiceAssistantActiveRef.current) {
            handleVoiceInput();
          }
        }, 600);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating, voiceAssistantActive]);

  // Helper to safely extract domain from URL without throwing exception
  const getDomainFromUrl = (urlStr) => {
    if (!urlStr) return 'website';
    try {
      return new URL(urlStr).hostname.replace(/^www\./, '');
    } catch (e) {
      return 'website';
    }
  };

  // Convert bracket citations like [1] to Markdown link syntax: [1](#source-1)
  const formatCitations = (text) => {
    if (!text) return '';
    return text.replace(/\[(\d+)\]/g, '[$1](#source-$1)');
  };

  // Nested Citation Badge component to trigger tooltips
  const CitationBadge = ({ index, sources }) => {
    const handleBadgeClick = (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent global click handler from closing it instantly

      const sourceIdx = parseInt(index, 10);
      const source = sources && sources[sourceIdx - 1];
      if (!source) return;

      const rect = e.currentTarget.getBoundingClientRect();

      if (tooltipSource && tooltipSource.index === sourceIdx) {
        setTooltipSource(null);
      } else {
        setTooltipSource({
          index: sourceIdx,
          title: source.title,
          url: source.url,
          snippet: source.snippet,
          rect: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
          }
        });
      }
    };

    const sourceIdx = parseInt(index, 10);
    return (
      <a
        className={`citation-link ${activeHighlightSource === sourceIdx ? 'highlighted' : ''}`}
        href={`#source-${index}`}
        onClick={handleBadgeClick}
        onMouseEnter={() => setActiveHighlightSource(sourceIdx)}
        onMouseLeave={() => setActiveHighlightSource(null)}
      >
        {index}
      </a>
    );
  };

  // Helper to construct markdown components with specific sources context
  const getMarkdownComponents = (sources = []) => ({
    a: ({ href, children }) => {
      if (href && href.startsWith('#source-')) {
        const sourceIndex = href.replace('#source-', '');
        return <CitationBadge index={sourceIndex} sources={sources} />;
      }
      return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
    },
    code: ({ node, inline, className, children, ...props }) => {
      const isMermaid = /language-mermaid/.exec(className || '');
      const runMatch = /language-(html|css|javascript|js)/.exec(className || '');

      if (isMermaid) {
        return <Mermaid chart={String(children).replace(/\n$/, '')} />;
      }
      if (runMatch) {
        return <CodeRunner code={String(children).replace(/\n$/, '')} language={runMatch[1]} onOpenArtifact={onOpenArtifact} />;
      }

      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
  });

  return (
    <div className="thread-view-container" ref={containerRef}>
      <div className="thread-messages-wrapper">
      {thread.messages.map((msg, index) => {
        const isUser = msg.role === 'user';
        const markdownComponents = getMarkdownComponents(msg.sources || []);

        return (
          <div
            key={index}
            className={`chat-message ${msg.role} ${printIndex !== null ? (printIndex === index ? 'print-focus' : 'print-hide') : ''}`}
          >
            {isUser ? (
              <div className="user-message-container">
                <h2 className="message-header">{msg.content}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {activeReenterIndex === index ? (
                    <div className="reenter-actions">
                      <span>Re-enter?</span>
                      <button
                        type="button"
                        className="reenter-confirm-btn yes"
                        onClick={() => {
                          setFollowUpText(msg.content);
                          setActiveReenterIndex(null);
                        }}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        className="reenter-confirm-btn no"
                        onClick={() => setActiveReenterIndex(null)}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="reenter-btn"
                      onClick={() => setActiveReenterIndex(index)}
                      title="Edit / re-enter query"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                {/* Perplexity Sources & Images Media Section */}
                <div className="perplexity-sources-section">
                  <div className="perplexity-media-tabs">
                    <button
                      type="button"
                      className={`perplexity-media-tab ${(!activeMediaTab[index] || activeMediaTab[index] === 'sources') ? 'active' : ''}`}
                      onClick={() => setActiveMediaTab(prev => ({ ...prev, [index]: 'sources' }))}
                    >
                      <BookOpen size={14} />
                      <span>Sources ({msg.sources ? msg.sources.length : 0})</span>
                    </button>

                    <button
                      type="button"
                      className={`perplexity-media-tab ${activeMediaTab[index] === 'images' ? 'active' : ''}`}
                      onClick={() => {
                        const userQuery = thread.messages[index - 1]?.content || thread.title;
                        handleFetchImagesForMessage(index, userQuery);
                      }}
                    >
                      <ImageIcon size={14} />
                      <span>Images</span>
                    </button>
                  </div>

                  {(!activeMediaTab[index] || activeMediaTab[index] === 'sources') && msg.sources && msg.sources.length > 0 && (
                    <div className="perplexity-sources-grid">
                      {msg.sources.map((src, sIdx) => (
                        <SourceCard
                          key={sIdx}
                          source={src}
                          index={sIdx + 1}
                          isHighlighted={activeHighlightSource === (sIdx + 1)}
                        />
                      ))}
                    </div>
                  )}

                  {activeMediaTab[index] === 'images' && (
                    <div className="perplexity-images-wrapper">
                      {imagesLoading[index] ? (
                        <div className="perplexity-images-loading">
                          <div className="step-icon-spinner" />
                          <span>Searching relevant images...</span>
                        </div>
                      ) : messageImages[index] && messageImages[index].length > 0 ? (
                        <div className="perplexity-images-grid">
                          {messageImages[index].map((imgItem, imgIdx) => (
                            <div
                              key={imgIdx}
                              className="perplexity-image-card"
                              onClick={() => setLightboxImage(imgItem)}
                              title={imgItem.title}
                            >
                              <img src={imgItem.thumbnail || imgItem.image} alt={imgItem.title} className="perplexity-image-thumb" />
                              <div className="perplexity-image-title-bar">{imgItem.title}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="perplexity-no-images">
                          No images found for this query.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Mode & Answer Markdown Render */}
                {(() => {
                  const contentText = msg.content || '';
                  const thinkMatch = contentText.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
                  const thinkText = thinkMatch ? thinkMatch[1].trim() : null;
                  const displayBody = contentText.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*/gi, '').trim();



                  return (
                    <div className="answer-section">


                      {/* Glowing Deep Reasoning <think> Block Card */}
                      {thinkText && (
                        <div className="deep-reasoning-container" style={{
                          backgroundColor: 'rgba(6, 182, 212, 0.08)',
                          border: '1px solid rgba(6, 182, 212, 0.3)',
                          borderRadius: '12px',
                          padding: '14px 16px',
                          marginBottom: '16px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#06b6d4', fontWeight: '600', fontSize: '13.5px', marginBottom: '8px' }}>
                            <Cpu size={15} />
                            <span>Deep Reasoning Thought Process</span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                            {thinkText}
                          </div>
                        </div>
                      )}

                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                      >
                        {formatCitations(displayBody)}
                      </ReactMarkdown>
                    </div>
                  );
                })()}

                {/* Pollinations AI Generated Image display */}
                {imageLoading[index] && (
                  <div className="generated-image-container">
                    <div className="image-loading-overlay">
                      <div className="paint-spinner" />
                      <span>Painting your research concept...</span>
                    </div>
                    <div style={{ height: '240px' }} />
                  </div>
                )}
                {generatedImages[index] && !imageLoading[index] && (
                  <div className="generated-image-container">
                    <img
                      src={generatedImages[index]}
                      alt="AI Generated Concept Art"
                      className="generated-image"
                    />
                  </div>
                )}

                {/* Answer Actions - Right-aligned Three Dot Dropdown Menu */}
                <div className="answer-actions-row">
                  {sharedIndex === index && (
                    <span className="action-feedback-toast">
                      Report copied!
                    </span>
                  )}
                  {copiedIndex === index && (
                    <span className="action-feedback-toast">
                      Text copied!
                    </span>
                  )}

                  <div className="action-menu-wrapper">
                    <button
                      type="button"
                      className={`action-icon-btn three-dots-btn ${openActionMenu === index ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenActionMenu(openActionMenu === index ? null : index);
                      }}
                      title="More Options"
                    >
                      <MoreVertical size={18} />
                    </button>

                    {openActionMenu === index && (
                      <div className="action-dropdown-menu">
                        <button
                          type="button"
                          className="action-dropdown-item"
                          onClick={() => {
                            handleCopyText(msg.content, index);
                            setOpenActionMenu(null);
                          }}
                        >
                          {copiedIndex === index ? <Check size={15} style={{ color: '#10b981' }} /> : <Copy size={15} />}
                          <span>Copy Answer</span>
                        </button>

                        <button
                          type="button"
                          className="action-dropdown-item"
                          onClick={() => {
                            handleSpeak(msg.content, index);
                            setOpenActionMenu(null);
                          }}
                        >
                          {speakingIndex === index ? <VolumeX size={15} style={{ color: '#ef4444' }} /> : <Volume2 size={15} />}
                          <span>{speakingIndex === index ? "Stop Speaking" : "Read Response Aloud"}</span>
                        </button>



                        <button
                          type="button"
                          className="action-dropdown-item"
                          onClick={() => {
                            handleShare(msg, index);
                            setOpenActionMenu(null);
                          }}
                        >
                          {sharedIndex === index ? <Check size={15} style={{ color: '#10b981' }} /> : <Share2 size={15} />}
                          <span>Share Report</span>
                        </button>

                        <button
                          type="button"
                          className="action-dropdown-item"
                          onClick={() => {
                            handleExportMD(msg.content, index);
                            setOpenActionMenu(null);
                          }}
                        >
                          <Download size={15} />
                          <span>Export Markdown (.md)</span>
                        </button>

                        <button
                          type="button"
                          className="action-dropdown-item"
                          onClick={() => {
                            handleExportPDF(index);
                            setOpenActionMenu(null);
                          }}
                        >
                          <Printer size={15} />
                          <span>Export PDF</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Related Questions */}
                {msg.related && msg.related.length > 0 && (
                  <div className="related-section">
                    <div className="section-label">
                      <ListCollapse size={14} style={{ color: '#10b981' }} />
                      <span>Related Questions</span>
                    </div>
                    <div className="related-list">
                      {msg.related.map((q, qIdx) => (
                        <button
                          key={qIdx}
                          className="related-question"
                          onClick={() => onFollowUpSubmit(q, focus, proMode, [])}
                          disabled={isGenerating}
                        >
                          <span>{q}</span>
                          <ArrowRight size={14} className="related-question-icon" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Streaming Active Assistant Response */}
      {isGenerating && (currentStreamText || (searchProgress && searchProgress.length > 0)) && (
        <div className="chat-message assistant">
          {/* Active Search Steps */}
          {searchProgress && searchProgress.length > 0 && (
            <div className="search-steps">
              {searchProgress.map((step, sIdx) => (
                <div key={sIdx} className="step-item">
                  {step.status === 'searching' && <div className="step-icon-spinner" />}
                  {step.status === 'completed' && <span className="step-icon-check"><Check size={14} /></span>}
                  {step.status === 'pending' && <span className="step-icon-pending">•</span>}
                  <span>{step.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Active Streaming Answer */}
          <div className="answer-section">
            <div className="section-label" style={{ marginBottom: '8px' }}>
              <Sparkles size={14} style={{ color: '#10b981' }} />
              <span>Answer</span>
            </div>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={getMarkdownComponents([])}
            >
              {formatCitations(currentStreamText)}
            </ReactMarkdown>
          </div>
        </div>
      )}



      {/* Floating Citation Tooltip Card (Renders outside main stream boxes using fixed viewport coordinates) */}
      {tooltipSource && (
        <div
          className="citation-tooltip"
          onClick={(e) => e.stopPropagation()} // Stop global click listener from closing tooltip
          style={{
            top: `${tooltipSource.rect.top + tooltipSource.rect.height + 6}px`,
            left: `${Math.max(16, Math.min(window.innerWidth - 320, tooltipSource.rect.left - 150))}px`
          }}
        >
          <div className="citation-tooltip-header">
            <div className="citation-tooltip-domain">
              <img
                src={`https://icons.duckduckgo.com/ip3/${getDomainFromUrl(tooltipSource.url)}.ico`}
                alt=""
                style={{ width: '12px', height: '12px', borderRadius: '2px' }}
                onError={(e) => e.target.style.display = 'none'}
              />
              <span>{getDomainFromUrl(tooltipSource.url)}</span>
            </div>
            <button className="citation-tooltip-close" onClick={() => setTooltipSource(null)}>
              <X size={14} />
            </button>
          </div>
          <div className="citation-tooltip-title">{tooltipSource.title}</div>
          <div className="citation-tooltip-snippet">{tooltipSource.snippet}</div>
          <a
            href={tooltipSource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="citation-tooltip-link"
          >
            <span>Visit Website</span>
            <ArrowRight size={10} />
          </a>
        </div>
      )}

      </div>{/* end thread-messages-wrapper */}

      <div ref={bottomRef} />

      {/* Sticky follow up Chat Bar at bottom */}
      <div className="bottom-chat-bar">
        <div className="bottom-chat-bar-inner">
          <SearchInputBar
            currentFocus={thread.focus || 'web'}
            externalQuery={followUpText}
            onSearchSubmit={(q, foc, pro, files, persona) => {
              onFollowUpSubmit(q, foc, pro, files, persona);
              setFollowUpText('');
            }}
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
            placeholder="Ask follow-up or paste YouTube URL..."
          />
        </div>
      </div>

      {/* Perplexity Image Lightbox Modal */}
      {lightboxImage && (
        <div className="image-lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="image-lightbox-card" onClick={(e) => e.stopPropagation()}>
            <button className="image-lightbox-close" onClick={() => setLightboxImage(null)}>
              <X size={18} />
            </button>
            <img src={lightboxImage.image || lightboxImage.thumbnail} alt={lightboxImage.title} className="image-lightbox-full" />
            <div className="image-lightbox-footer">
              <div className="image-lightbox-title">{lightboxImage.title}</div>
              {lightboxImage.url && (
                <a href={lightboxImage.url} target="_blank" rel="noopener noreferrer" className="image-lightbox-link">
                  <span>Visit Web Source</span>
                  <ArrowRight size={12} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Connected Apps & Knowledge Modal */}
      <ConnectedModal
        isOpen={connectedModalOpen}
        onClose={() => setConnectedModalOpen(false)}
        onUpdateConnections={(updatedApps) => setConnectedApps(updatedApps)}
      />
    </div>
  );
}
