import React, { useState } from 'react';
import { X, Code, Eye, Download, Copy, Check, Maximize2, Minimize2, ExternalLink } from 'lucide-react';

export default function ArtifactCanvas({ artifact, onClose }) {
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'code'
  const [copied, setCopied] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  if (!artifact) return null;

  const { title, content, type } = artifact; // type: 'html' | 'js' | 'css' | 'mermaid' | 'markdown'

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = type === 'html' ? 'html' : type === 'js' ? 'js' : type === 'css' ? 'css' : 'md';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `artifact_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build full html page for iframe preview
  const getPreviewHtml = () => {
    if (type === 'html') {
      return content;
    }
    if (type === 'js' || type === 'javascript') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: monospace; background: #0f172a; color: #38bdf8; padding: 20px; font-size: 14px; margin: 0; }
            .log { border-bottom: 1px solid #1e293b; padding: 6px 0; }
            .error { color: #f43f5e; font-weight: bold; }
          </style>
        </head>
        <body>
          <div id="console"></div>
          <script>
            function log(msg, cls='') {
              const d = document.createElement('div');
              d.className = 'log ' + cls;
              d.textContent = typeof msg === 'object' ? JSON.stringify(msg, null, 2) : msg;
              document.getElementById('console').appendChild(d);
            }
            console.log = (...a) => log(a.join(' '));
            console.error = (...a) => log(a.join(' '), 'error');
            try {
              ${content}
            } catch(e) {
              console.error(e.message);
            }
          </script>
        </body>
        </html>
      `;
    }
    if (type === 'css') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { background: #0f172a; color: #f8fafc; font-family: sans-serif; padding: 20px; }
            ${content}
          </style>
        </head>
        <body>
          <h2>CSS Sandbox Preview</h2>
          <div class="box">Styled Box Element</div>
          <button class="btn">Styled Button</button>
        </body>
        </html>
      `;
    }
    return `<!DOCTYPE html><html><body style="background:#0f172a;color:#f8fafc;padding:20px;"><pre>${content}</pre></body></html>`;
  };

  return (
    <div className={`artifact-canvas-container ${isFullScreen ? 'fullscreen' : ''}`}>
      <div className="artifact-canvas-header">
        <div className="artifact-canvas-title-wrapper">
          <span className="artifact-badge">{type ? type.toUpperCase() : 'ARTIFACT'}</span>
          <h3 className="artifact-title">{title || 'Interactive Artifact'}</h3>
        </div>

        <div className="artifact-canvas-actions">
          <div className="artifact-tabs">
            <button
              className={`artifact-tab ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
            >
              <Eye size={13} />
              <span>Preview</span>
            </button>
            <button
              className={`artifact-tab ${activeTab === 'code' ? 'active' : ''}`}
              onClick={() => setActiveTab('code')}
            >
              <Code size={13} />
              <span>Code</span>
            </button>
          </div>

          <button className="canvas-action-btn" onClick={handleCopy} title="Copy code">
            {copied ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
          </button>
          <button className="canvas-action-btn" onClick={handleDownload} title="Download">
            <Download size={14} />
          </button>
          <button
            className="canvas-action-btn"
            onClick={() => setIsFullScreen(!isFullScreen)}
            title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button className="canvas-action-btn close" onClick={onClose} title="Close Canvas">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="artifact-canvas-body">
        {activeTab === 'preview' ? (
          <iframe
            srcDoc={getPreviewHtml()}
            title="Artifact Preview"
            className="artifact-iframe"
            sandbox="allow-scripts"
          />
        ) : (
          <pre className="artifact-code-pre">
            <code>{content}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
