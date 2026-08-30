import React, { useState } from 'react';
import { ExternalLink, Globe } from 'lucide-react';

// Helper to safely extract domain name from URL
function getDomain(urlStr) {
  if (!urlStr) return 'website';
  try {
    const url = new URL(urlStr);
    return url.hostname.replace(/^www\./, '');
  } catch (e) {
    return 'website';
  }
}

export default function SourceCard({ source, index, isHighlighted, onClick }) {
  const [imgError, setImgError] = useState(false);
  const domain = getDomain(source.url);
  const faviconUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`;

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`perplexity-source-card ${isHighlighted ? 'highlighted' : ''}`}
      onClick={(e) => {
        if (onClick) {
          onClick(e, source, index);
        }
      }}
      title={`${source.title}\n${source.snippet || ''}`}
    >
      <div className="source-card-header">
        <div className="source-card-domain">
          {!imgError ? (
            <img
              src={faviconUrl}
              alt=""
              className="source-card-favicon"
              onError={() => setImgError(true)}
            />
          ) : (
            <Globe size={13} className="source-card-favicon-fallback" />
          )}
          <span className="source-domain-name">{domain}</span>
        </div>
        <span className="source-card-index-badge">{index}</span>
      </div>

      <div className="source-card-title">
        {source.title || 'Source Article'}
      </div>

      {source.snippet && (
        <div className="source-card-snippet">
          {source.snippet}
        </div>
      )}

      <div className="source-card-footer">
        <span className="source-domain-subtext">{domain}</span>
        <ExternalLink size={12} className="source-link-icon" />
      </div>
    </a>
  );
}
