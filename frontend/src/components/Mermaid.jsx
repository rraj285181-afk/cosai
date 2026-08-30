import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Initialize Mermaid once
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  themeVariables: {
    background: '#1b1c22',
    primaryColor: '#10b981',
    primaryTextColor: '#fff',
    lineColor: '#374151',
    secondaryColor: '#1f2937',
    tertiaryColor: '#111827'
  }
});

let mermaidIdCounter = 0;

export default function Mermaid({ chart }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (!chart || typeof chart !== 'string' || !chart.trim()) return;

    const renderId = `mermaid-svg-${Math.random().toString(36).substring(2, 9)}`;

    async function renderChart() {
      try {
        // Validate syntax first before calling render to avoid DOM errors on incomplete stream text
        await mermaid.parse(chart);

        setError(null);
        const badEl = document.getElementById(renderId);
        if (badEl) badEl.remove();

        const { svg: renderedSvg } = await mermaid.render(renderId, chart);
        if (isMounted) {
          setSvg(renderedSvg);
        }
      } catch (err) {
        // Incomplete chart syntax while streaming — display quiet loading fallback without console warnings
        if (isMounted) {
          setError('Rendering diagram...');
        }
        const badEl = document.getElementById(renderId);
        if (badEl) badEl.remove();
      }
    }

    renderChart();

    return () => {
      isMounted = false;
      const badEl = document.getElementById(renderId);
      if (badEl) badEl.remove();
    };
  }, [chart]);

  if (error) {
    return (
      <div className="mermaid-error-container">
        <span className="mermaid-error-title">{error}</span>
        <pre className="mermaid-raw-code">{chart}</pre>
      </div>
    );
  }

  return (
    <div 
      dangerouslySetInnerHTML={{ __html: svg }} 
      className="mermaid-chart-wrapper" 
    />
  );
}
