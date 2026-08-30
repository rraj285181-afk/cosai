import React, { useState } from 'react';
import {
  X, Check, Plug, Globe, FileText, FolderGit2,
  BookOpen, Sparkles, Key, Link as LinkIcon, AlertCircle, Monitor, AppWindow, Camera, Video, VideoOff,
  CloudSun, Newspaper
} from 'lucide-react';
import { getConnectedApps, saveConnectedApps } from '../utils/storage';
import { captureDisplayOrWindow, connectLiveScreenStream, stopLiveScreenStream, getLiveStreamStatus, isAppTrulyConnected, isMobileDevice } from '../utils/helpers';

export default function ConnectedModal({ isOpen, onClose, onUpdateConnections, onAttachFile }) {
  const [apps, setApps] = useState(getConnectedApps);
  const [configuringId, setConfiguringId] = useState(null);
  const [tempInputValue, setTempInputValue] = useState('');
  const [capturingId, setCapturingId] = useState(null);
  const [tick, setTick] = useState(0);

  // Bug Fix #1: Re-read fresh data from localStorage every time modal opens
  // This prevents stale state when multiple components manage ConnectedModal
  React.useEffect(() => {
    if (isOpen) {
      setApps(getConnectedApps());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMobile = isMobileDevice();
  const liveStatus = getLiveStreamStatus();
  const trulyConnectedCount = apps.filter(isAppTrulyConnected).length;

  const handleToggle = (id) => {
    // Bug Fix #2: isCapture apps (screen_capture) cannot be toggled manually.
    // Their active state is controlled exclusively by the live stream connect/disconnect.
    const app = apps.find(a => a.id === id);
    if (app && app.isCapture) return;

    const updated = apps.map(a => {
      if (a.id === id) {
        return { ...a, active: !a.active };
      }
      return a;
    });
    setApps(updated);
    saveConnectedApps(updated);
    if (onUpdateConnections) onUpdateConnections(updated);
  };

  const handleSaveConfig = (id) => {
    const updated = apps.map(app => {
      if (app.id === id) {
        return { ...app, configValue: tempInputValue, active: Boolean(tempInputValue && tempInputValue.trim() !== '') };
      }
      return app;
    });
    setApps(updated);
    saveConnectedApps(updated);
    setConfiguringId(null);
    if (onUpdateConnections) onUpdateConnections(updated);
  };

  const handleConnectLiveStream = async (app) => {
    if (liveStatus.active) {
      // Bug Fix #3: When stopping stream, also set isCapture app active=false in storage
      stopLiveScreenStream();
      const updated = apps.map(a => a.id === app.id ? { ...a, active: false } : a);
      setApps(updated);
      saveConnectedApps(updated);
      if (onUpdateConnections) onUpdateConnections(updated);
      setTick(t => t + 1);
      return;
    }

    try {
      setCapturingId(app.id);
      await connectLiveScreenStream('monitor', () => {
        // When user stops stream via browser bar, update storage too
        const stoppedUpdate = getConnectedApps().map(a => a.id === app.id ? { ...a, active: false } : a);
        saveConnectedApps(stoppedUpdate);
        if (onUpdateConnections) onUpdateConnections(stoppedUpdate);
        setTick(t => t + 1);
      });
      const updated = apps.map(a => a.id === app.id ? { ...a, active: true } : a);
      setApps(updated);
      saveConnectedApps(updated);
      if (onUpdateConnections) onUpdateConnections(updated);
    } catch (err) {
      console.warn('Live stream connection failed:', err);
    } finally {
      setCapturingId(null);
      setTick(t => t + 1);
    }
  };

  const appIcons = {
    screen_capture: <Monitor size={18} style={{ color: '#10b981' }} />,
    gdrive: <FileText size={18} style={{ color: '#06b6d4' }} />,
    github: <FolderGit2 size={18} style={{ color: '#8b5cf6' }} />,
    notion: <BookOpen size={18} style={{ color: '#ec4899' }} />
  };

  return (
    <div className="connected-modal-overlay" onClick={onClose}>
      <div className="connected-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="connected-modal-header">
          <div className="connected-modal-title-group">
            <div className="connected-icon-badge">
              <Plug size={20} />
            </div>
            <div>
              <h3 className="connected-modal-title">Connected Apps & Live Sources</h3>
              <p className="connected-modal-subtitle">Connect live screen stream or external accounts for AI search</p>
            </div>
          </div>
          <button className="connected-modal-close" onClick={onClose} title="Close Modal">
            <X size={18} />
          </button>
        </div>

        {/* Apps List */}
        <div className="connected-apps-list">
          {apps.map(app => (
            <div key={app.id} className={`connected-app-item ${
              isAppTrulyConnected(app) ? 'active' : ''
            } ${app.isCapture && isMobile ? 'disabled' : ''}`}
              style={app.isCapture && isMobile ? { opacity: 0.55, pointerEvents: 'none' } : {}}
            >
              <div className="connected-app-main">
                <div className="connected-app-icon">
                  {appIcons[app.id] || <Plug size={18} />}
                </div>
                <div className="connected-app-info">
                  <div className="connected-app-name-row">
                    <span className="connected-app-name">{app.name}</span>
                    {app.isCapture ? (
                      liveStatus.active ? (
                        <span className="connected-badge active" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', borderColor: '#10b981' }}>
                          🟢 Stream Connected
                        </span>
                      ) : (
                        <span className="connected-badge inactive">Disconnected</span>
                      )
                    ) : app.requiresConfig ? (
                      app.active && app.configValue ? (
                        <span className="connected-badge active">
                          <Check size={10} /> Connected
                        </span>
                      ) : (
                        <span className="connected-badge inactive">Not Connected</span>
                      )
                    ) : app.active ? (
                      <span className="connected-badge active">
                        <Check size={10} /> Active Source
                      </span>
                    ) : (
                      <span className="connected-badge inactive">Disabled</span>
                    )}
                  </div>
                  <span className="connected-app-desc">{app.description}</span>
                  {app.configValue && (
                    <div className="connected-app-config-tag">
                      <LinkIcon size={11} />
                      <span>{app.configValue}</span>
                    </div>
                  )}
                </div>

                <div className="connected-app-actions">
                  {app.isCapture ? (
                    isMobile ? (
                      // Mobile: Screen Capture API not supported — show info badge
                      <span
                        className="connected-badge inactive"
                        style={{ fontSize: '11px', padding: '3px 8px', opacity: 0.7 }}
                        title="Screen & Window Capture requires a desktop browser"
                      >
                        🖥️ Desktop Only
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="connected-config-btn"
                        onClick={() => handleConnectLiveStream(app)}
                        disabled={capturingId === app.id}
                        style={liveStatus.active ? { borderColor: '#ef4444', color: '#ef4444' } : {}}
                        title="Connect live screen/window stream for real-time snapshots on query send"
                      >
                        {liveStatus.active ? 'Disconnect' : 'Connect'}
                      </button>
                    )
                  ) : app.requiresConfig ? (
                    <button
                      type="button"
                      className="connected-config-btn"
                      onClick={() => {
                        setConfiguringId(app.id);
                        setTempInputValue(app.configValue || '');
                      }}
                    >
                      {app.configValue ? 'Edit Key/URL' : 'Connect'}
                    </button>
                  ) : null}

                  {/* Bug Fix #2: Hide toggle switch for isCapture apps — only controlled by stream */}
                  {!app.isCapture && (
                    <button
                      type="button"
                      className={`connected-toggle-switch ${app.active ? 'on' : 'off'}`}
                      onClick={() => handleToggle(app.id)}
                      title={app.active ? 'Disable this source' : 'Enable this source'}
                    >
                      <div className="switch-handle" />
                    </button>
                  )}
                </div>
              </div>

              {/* Inline Configuration Inputs */}
              {configuringId === app.id && (
                <div className="connected-config-form">
                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#9ca3af', marginBottom: '4px' }}>
                    {app.id === 'github' ? 'GitHub Repo URL / Access Token:' : app.id === 'gdrive' ? 'Google Drive Folder ID / Link:' : 'API Key / Integration Secret:'}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="connected-config-input"
                      placeholder={app.id === 'github' ? 'e.g. username/repository' : app.id === 'gdrive' ? 'e.g. folder_id_or_link' : 'e.g. secret_key'}
                      value={tempInputValue}
                      onChange={(e) => setTempInputValue(e.target.value)}
                      style={{ flex: 1 }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="connected-save-btn"
                      onClick={() => handleSaveConfig(app.id)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="connected-cancel-btn"
                      onClick={() => setConfiguringId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="connected-modal-footer">
          <div className="connected-status-summary">
            <Plug size={14} style={{ color: '#10b981' }} />
            <span>{trulyConnectedCount} of {apps.length} sources active for RAG search</span>
          </div>
          <button type="button" className="connected-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
