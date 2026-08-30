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
      <div className="search-center-wrapper">
        <div className="search-title-box">
          <div className="search-subtitle">Search</div>
          <h1 className="search-title">What do you want to know?</h1>
        </div>
        <div className="home-search-bar-inner">
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
