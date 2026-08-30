import React, { useState } from 'react';
import {
  Plus, MessageSquare, Trash2, Search, LogOut, User,
  PanelLeftClose, PanelLeftOpen, Compass, Sun, Moon, Zap, Smartphone
} from 'lucide-react';

export default function Sidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  user,
  onSignOut,
  onToggleSidebar,
  isCollapsed = false,
  theme = 'dark',
  setTheme,
  onInstallPwa
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredThreads = threads.filter(t => {
    return t.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-logo">
        <div
          className="perplexity-brand-logo"
          onClick={() => {
            if (onToggleSidebar) onToggleSidebar();
          }}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          style={{ cursor: 'pointer' }}
        >
          <div className="perplexity-icon-wrapper">
            <Compass size={18} className="perplexity-compass-icon" />
          </div>
          <span className="brand-text">Strange <span>AI</span></span>
        </div>
        <button
          className="sidebar-toggle-btn"
          onClick={onToggleSidebar}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>

      {/* New Thread Main Action */}
      <button
        className="new-thread-btn"
        onClick={() => {
          onNewThread();
          if (window.innerWidth <= 768 && onToggleSidebar) onToggleSidebar();
        }}
        title="New Thread"
      >
        <Plus size={16} />
        <span>New Thread</span>
      </button>

      {/* Thread Search Filter */}
      <div className="sidebar-search-box">
        <Search size={14} className="search-box-icon" />
        <input
          type="text"
          placeholder="Search library..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="sidebar-search-input"
        />
      </div>

      {/* History List */}
      <div className="sidebar-nav-title-row">
        <span>HISTORY</span>
      </div>

      <div className="threads-list">
        {filteredThreads.length === 0 ? (
          <div className="empty-history-text">
            {searchQuery ? 'No matching threads' : 'No threads in this space'}
          </div>
        ) : (
          filteredThreads.map((thread) => (
            <div
              key={thread.id}
              className={`thread-item ${thread.id === activeThreadId ? 'active' : ''}`}
              onClick={() => {
                onSelectThread(thread.id);
                if (window.innerWidth <= 768 && onToggleSidebar) onToggleSidebar();
              }}
            >
              <span className="thread-item-initial">{thread.title ? thread.title.charAt(0).toUpperCase() : 'T'}</span>
              <span className="thread-item-title">{thread.title}</span>
              <button
                className="delete-thread-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteThread(thread.id);
                }}
                title="Delete thread"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* User Footer Profile */}
      {user && (
        <div className="sidebar-user-footer">
          {/* PWA Install Button */}
          {onInstallPwa && (
            <button
              className="new-thread-btn pwa-install-sidebar-btn"
              onClick={onInstallPwa}
              style={{
                marginBottom: '10px',
                padding: '8px 12px',
                fontSize: '12px',
                borderRadius: '8px',
                borderColor: 'var(--accent-glow)',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                color: 'var(--accent-color)'
              }}
              title="Install Strange AI App on Phone / Desktop"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={14} />
                <span>Install App (PWA)</span>
              </div>
              <span className="pwa-plus-badge" style={{ fontSize: '10px', fontWeight: '700' }}>⊕</span>
            </button>
          )}

          {/* Theme Toggle: Light vs Dark (OLED Pure Black) */}
          <div className="theme-toggle-row" title="Switch app theme">
            <button
              className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme && setTheme('light')}
              title="Light Mode"
            >
              <Sun size={12} />
              <span className="theme-toggle-label">Light</span>
            </button>
            <button
              className={`theme-toggle-btn ${theme === 'oled' ? 'active' : ''}`}
              onClick={() => setTheme && setTheme('oled')}
              title="Dark Mode"
            >
              <Moon size={12} />
              <span className="theme-toggle-label">Dark</span>
            </button>
          </div>

          {user.isGuest ? (
            <button className="sidebar-guest-signin-btn" onClick={onSignOut} title="Sign In with Google">
              <svg width="15" height="15" viewBox="0 0 24 24" style={{ marginRight: '10px', flexShrink: 0 }}>
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69a5.74 5.74 0 0 1-2.49 3.77v3.12h4.02c2.37-2.17 3.77-5.37 3.77-8.74Z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-4.02-3.12c-1.12.75-2.54 1.19-3.94 1.19-3.04 0-5.62-2.05-6.54-4.81H1.31v3.22A12 12 0 0 0 12 24Z" />
                <path fill="#FBBC05" d="M5.46 14.35a7.16 7.16 0 0 1 0-4.7V6.43H1.31a12 12 0 0 0 0 11.14l4.15-3.22Z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.96 11.96 0 0 0 12 0 12 0 0 0 1.31 6.43l4.15 3.22c.92-2.76 3.5-4.81 6.54-4.81Z" />
              </svg>
              <span>Sign In</span>
            </button>
          ) : (
            <div className="user-profile-wrapper">
              <div className="user-profile">
                {user.picture ? (
                  <img src={user.picture} alt={user.name} className="user-avatar" referrerPolicy="no-referrer" />
                ) : (
                  <div className="guest-avatar-placeholder">
                    <User size={16} />
                  </div>
                )}
                <div className="user-info">
                  <span className="user-name">{user.name}</span>
                  <span className="user-email">{user.email}</span>
                </div>
              </div>
              <button className="sign-out-btn" onClick={onSignOut} title="Sign Out">
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
