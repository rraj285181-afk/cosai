import React, { useState, useEffect } from 'react';
import { Mic, X, Volume2, AudioLines, Settings2, Gauge, UserCheck } from 'lucide-react';
import { getAvailableVoices } from '../utils/speech';

export default function VoiceOverlay({
  isListening,
  isSpeaking,
  queryText,
  onClose,
  speechRate = 1.05,
  onSpeedChange,
  speechPitch = 1.0,
  onPitchChange,
  selectedVoiceIndex = 0,
  onVoiceChange
}) {
  const [currentSpeed, setCurrentSpeed] = useState(speechRate);
  const [currentPitch, setCurrentPitch] = useState(speechPitch);
  const [availableVoices, setAvailableVoices] = useState([]);

  useEffect(() => {
    const updateVoices = () => {
      const vList = getAvailableVoices();
      setAvailableVoices(vList);
    };
    updateVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const speeds = [0.9, 1.0, 1.25, 1.5];

  const pitchPresets = [
    { label: 'Normal Voice', value: 1.0 },
    { label: 'Cinematic Deep', value: 0.6 },
    { label: 'Robot Synth', value: 0.3 },
    { label: 'Fast Scholar', value: 1.3 },
    { label: 'Gentle Soft', value: 0.8 }
  ];

  const handleSpeedSelect = (spd) => {
    setCurrentSpeed(spd);
    if (onSpeedChange) onSpeedChange(spd);
  };

  const handlePitchSelect = (pch) => {
    setCurrentPitch(pch);
    if (onPitchChange) onPitchChange(pch);
  };

  return (
    <div className="voice-overlay-backdrop">
      <div className="voice-overlay-card">
        <button className="voice-overlay-close" onClick={onClose} title="Close Voice Mode">
          <X size={18} />
        </button>

        <div className="voice-visualizer-container">
          <div className={`voice-glow-ring ${isListening ? 'listening' : isSpeaking ? 'speaking' : ''}`} />
          <div className="voice-icon-box">
            {isSpeaking ? (
              <Volume2 size={36} className="voice-icon speaking" />
            ) : (
              <AudioLines size={36} className="voice-icon listening" />
            )}
          </div>
        </div>

        <div className="voice-status-wrapper">
          <span className="voice-status-badge">
            {isListening ? 'Listening...' : isSpeaking ? 'Strange AI Speaking...' : 'Voice Assistant Active'}
          </span>
          <p className="voice-transcript">
            {queryText ? `"${queryText}"` : 'Speak naturally... Strange AI is listening.'}
          </p>
        </div>

        {/* Voice Selector, Pitch FX & Speed Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginBottom: '12px' }}>
          {availableVoices.length > 0 && (
            <div className="voice-speed-controls" style={{ justifyContent: 'space-between' }}>
              <span className="voice-speed-label">
                <UserCheck size={13} style={{ color: '#06b6d4' }} />
                <span>Voice Persona:</span>
              </span>
              <select
                className="connected-config-input"
                style={{ fontSize: '11px', padding: '3px 6px', height: '26px', maxWidth: '160px' }}
                value={selectedVoiceIndex || 0}
                onChange={(e) => onVoiceChange && onVoiceChange(parseInt(e.target.value, 10))}
              >
                {availableVoices.map((v, idx) => (
                  <option key={idx} value={idx}>
                    {v.name.length > 22 ? v.name.substring(0, 22) + '...' : v.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Voice Pitch FX Selector */}
          <div className="voice-speed-controls" style={{ justifyContent: 'space-between' }}>
            <span className="voice-speed-label">
              <Settings2 size={13} style={{ color: '#a855f7' }} />
              <span>Voice Pitch FX:</span>
            </span>
            <select
              className="connected-config-input"
              style={{ fontSize: '11px', padding: '3px 6px', height: '26px', maxWidth: '160px' }}
              value={currentPitch}
              onChange={(e) => handlePitchSelect(parseFloat(e.target.value))}
            >
              {pitchPresets.map((p, idx) => (
                <option key={idx} value={p.value}>
                  {p.label} ({p.value}x)
                </option>
              ))}
            </select>
          </div>

          <div className="voice-speed-controls">
            <span className="voice-speed-label">
              <Gauge size={13} style={{ color: '#10b981' }} />
              <span>Speed:</span>
            </span>
            <div className="voice-speed-btns">
              {speeds.map((s) => (
                <button
                  key={s}
                  className={`speed-btn ${currentSpeed === s ? 'active' : ''}`}
                  onClick={() => handleSpeedSelect(s)}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Animated Wave Bars */}
        <div className="audio-wave-bars">
          <div className="bar b1" />
          <div className="bar b2" />
          <div className="bar b3" />
          <div className="bar b4" />
          <div className="bar b5" />
          <div className="bar b4" />
          <div className="bar b3" />
          <div className="bar b2" />
          <div className="bar b1" />
        </div>
      </div>
    </div>
  );
}
