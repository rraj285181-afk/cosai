import React, { useState, useEffect, useRef } from 'react';
import { Play, Code, Eye, RefreshCw, Terminal, Maximize2 } from 'lucide-react';

export default function CodeRunner({ code, language, onOpenArtifact }) {
  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'preview'
  const [iframeUrl, setIframeUrl] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const iframeRef = useRef(null);

  const cleanLang = language ? language.toLowerCase() : 'html';

  const handleRun = () => {
    setIsRunning(true);
    setActiveTab('preview');

    let htmlContent = '';

    if (cleanLang === 'html' || cleanLang === 'xml') {
      htmlContent = code;
    } else if (cleanLang === 'javascript' || cleanLang === 'js') {
      // Script sandbox with console hooking
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { 
              font-family: monospace; 
              background-color: #0f172a; 
              color: #38bdf8; 
              padding: 16px; 
              margin: 0; 
              font-size: 13.5px; 
              line-height: 1.6;
              word-break: break-all;
            }
            .log { border-bottom: 1px solid #1e293b; padding: 6px 0; }
            .error { color: #f43f5e; font-weight: bold; }
            .system { color: #64748b; font-style: italic; }
          </style>
        </head>
        <body>
          <div id="console"></div>
          <script>
            const consoleDiv = document.getElementById('console');
            function logToConsole(message, type = 'log') {
              const div = document.createElement('div');
              div.className = 'log ' + type;
              div.textContent = typeof message === 'object' ? JSON.stringify(message, null, 2) : String(message);
              consoleDiv.appendChild(div);
              window.scrollTo(0, document.body.scrollHeight);
            }
            
            // Override console
            console.log = (...args) => logToConsole(args.join(' '), 'log');
            console.error = (...args) => logToConsole(args.join(' '), 'error');
            console.warn = (...args) => logToConsole(args.join(' '), 'warn');
            
            logToConsole('Console initialized. Running script...', 'system');
            
            window.onerror = function(msg, url, line) {
              logToConsole('Runtime Error: ' + msg + ' (Line ' + line + ')', 'error');
              return true;
            };

            try {
              ${code}
              logToConsole('Script executed successfully.', 'system');
            } catch (err) {
              logToConsole(err.message, 'error');
            }
          </script>
        </body>
        </html>
      `;
    } else if (cleanLang === 'css') {
      // CSS sandbox displaying standard block elements to show styling
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { 
              background-color: #0f172a; 
              color: #f1f5f9; 
              font-family: sans-serif; 
              padding: 20px; 
              margin: 0;
            }
            ${code}
          </style>
        </head>
        <body>
          <h3>CSS Styling Preview</h3>
          <p>This sandbox renders standard elements styled with your custom CSS code.</p>
          <hr/>
          <div class="container">
            <button class="btn btn-primary">Primary Button</button>
            <button class="btn">Default Button</button>
            <div class="box">Styled Box Container</div>
            <a href="#">Styled Link Action</a>
            <ul>
              <li>First styled list item</li>
              <li>Second styled list item</li>
            </ul>
          </div>
        </body>
        </html>
      `;
    } else {
      // Fallback
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <body>
          <h3>Preview not supported for: ${language}</h3>
          <pre>${code}</pre>
        </body>
        </html>
      `;
    }

    // Revoke old object URL if exists to avoid memory leak
    if (iframeUrl) {
      URL.revokeObjectURL(iframeUrl);
    }

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setIframeUrl(url);
    
    setTimeout(() => {
      setIsRunning(false);
    }, 600);
  };

  useEffect(() => {
    return () => {
      if (iframeUrl) {
        URL.revokeObjectURL(iframeUrl);
      }
    };
  }, [iframeUrl]);

  return (
    <div className="code-runner-container">
      <div className="code-runner-header">
        <div className="code-runner-info">
          <Terminal size={14} style={{ color: '#10b981' }} />
          <span className="code-runner-lang">{cleanLang.toUpperCase()} Block</span>
        </div>
        <div className="code-runner-actions">
          <button
            onClick={() => setActiveTab('code')}
            className={`runner-tab-btn ${activeTab === 'code' ? 'active' : ''}`}
            title="View Code"
          >
            <Code size={13} />
            <span>Code</span>
          </button>
          <button
            onClick={handleRun}
            className={`runner-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            title="Run and Preview"
            disabled={isRunning}
          >
            {activeTab === 'preview' ? <RefreshCw size={13} className={isRunning ? 'spin' : ''} /> : <Play size={13} />}
            <span>{activeTab === 'preview' ? 'Reload' : 'Run'}</span>
          </button>
          {onOpenArtifact && (
            <button
              onClick={() => onOpenArtifact({ title: `${cleanLang.toUpperCase()} Code Artifact`, content: code, type: cleanLang })}
              className="runner-tab-btn"
              title="Open Split Canvas"
            >
              <Maximize2 size={13} />
              <span>Canvas</span>
            </button>
          )}
        </div>
      </div>

      <div className="code-runner-body">
        {activeTab === 'code' ? (
          <pre className="code-runner-pre">
            <code>{code}</code>
          </pre>
        ) : (
          <div className="code-runner-preview-wrapper">
            {iframeUrl ? (
              <iframe
                ref={iframeRef}
                src={iframeUrl}
                title="Code Sandbox Preview"
                className="code-runner-iframe"
                sandbox="allow-scripts"
              />
            ) : (
              <div className="code-runner-placeholder">
                <Eye size={24} style={{ color: '#475569', marginBottom: '8px' }} />
                <span>Click Run to execute and view interactive output.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
