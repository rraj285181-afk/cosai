import React from 'react';
import SearchInputBar from './SearchInputBar';

export default function SearchArea({
  onSearchSubmit,
  isLoading,
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
  currentFocus = 'web'
}) {
  return (
    <div className="search-container">
      <div className="search-title-box" style={{ width: '100%', maxWidth: '800px', margin: '0 auto 24px auto', textAlign: 'left' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500', marginBottom: '6px' }}>
          Search
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: '600', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
          What do you want to know?
        </h1>
      </div>
      <div className="home-bottom-chat-bar">
        <div className="bottom-chat-bar-inner">
          <SearchInputBar
            currentFocus={currentFocus}
            onSearchSubmit={onSearchSubmit}
            isLoading={isLoading}
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
        </div>
      </div>
    </div>
  );
}
