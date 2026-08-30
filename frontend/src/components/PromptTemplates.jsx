import React from 'react';
import { X, Code, BookOpen, FileText, Sparkles, Lightbulb, TrendingUp, ArrowRight } from 'lucide-react';

export default function PromptTemplates({ isOpen, onClose, onSelectTemplate }) {
  if (!isOpen) return null;

  const templates = [
    {
      id: 'code-review',
      category: 'Software Engineering',
      title: 'Code Performance & Security Audit',
      icon: <Code size={18} style={{ color: '#10b981' }} />,
      desc: 'Analyze code for performance bottlenecks, security flaws, and clean refactoring.',
      persona: 'coder',
      focus: 'all',
      prompt: 'Review the following code for performance bottlenecks, security vulnerabilities, edge cases, and provide an optimized production-grade refactored version with unit tests:'
    },
    {
      id: 'academic-paper',
      category: 'Academic Research',
      title: 'Research Paper Deep Breakdown',
      icon: <BookOpen size={18} style={{ color: '#3b82f6' }} />,
      desc: 'Deconstruct a paper into main thesis, methodology, key data findings, and limitations.',
      persona: 'scientist',
      focus: 'academic',
      prompt: 'Analyze this research paper/topic and provide a structured breakdown covering: 1. Main Thesis & Research Objectives, 2. Key Methodology & Experiments, 3. Critical Results & Data Findings, 4. Limitations & Future Directions:'
    },
    {
      id: 'resume-optimizer',
      category: 'Career & HR',
      title: 'ATS Resume & Cover Letter Optimizer',
      icon: <FileText size={18} style={{ color: '#f59e0b' }} />,
      desc: 'Tailor resume bullets with ATS keywords, quantifiable metrics, and impact verbs.',
      persona: 'writer',
      focus: 'writing',
      prompt: 'Analyze this resume experience section and optimize it for ATS screening by adding high-impact action verbs, quantifiable metrics, and relevant keyword alignment:'
    },
    {
      id: 'seo-content',
      category: 'Marketing & SEO',
      title: 'SEO Content Outline & Strategy',
      icon: <TrendingUp size={18} style={{ color: '#ec4899' }} />,
      desc: 'Generate a top-ranking SEO article structure with target keywords, H2/H3 headers, and FAQs.',
      persona: 'writer',
      focus: 'all',
      prompt: 'Generate an exhaustive SEO content strategy and article outline for this keyword, including target intent, primary/secondary keywords, detailed H2/H3 header structure, key takeaways, and FAQs:'
    },
    {
      id: 'concept-tutor',
      category: 'Study & Education',
      title: 'Step-by-Step Concept Tutor',
      icon: <Lightbulb size={18} style={{ color: '#8b5cf6' }} />,
      desc: 'Explain complex topics using simple analogies, step-by-step breakdowns, and quizzes.',
      persona: 'tutor',
      focus: 'all',
      prompt: 'Explain the following complex topic step-by-step using beginner-friendly analogies, real-world examples, core mathematical/logical formulas, and conclude with a 3-question self-assessment quiz:'
    },
    {
      id: 'business-strategy',
      category: 'Strategy & Analysis',
      title: 'Market Research & Competitor Analysis',
      icon: <Sparkles size={18} style={{ color: '#06b6d4' }} />,
      desc: 'Evaluate industry trends, target audience demographics, SWOT, and competitive edge.',
      persona: 'general',
      focus: 'all',
      prompt: 'Perform a comprehensive market research and competitor breakdown for this industry/product, including market size, key target persona demographics, SWOT analysis, and top growth strategies:'
    }
  ];

  return (
    <div className="prompt-modal-backdrop" onClick={onClose}>
      <div className="prompt-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="prompt-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} style={{ color: '#10b981' }} />
            <div>
              <h3 className="prompt-modal-title">AI Workflows & Prompt Library</h3>
              <p className="prompt-modal-subtitle">Select a curated workflow template to kickstart your research.</p>
            </div>
          </div>
          <button className="prompt-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="prompt-templates-grid">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="prompt-template-card"
              onClick={() => {
                onSelectTemplate(tpl.prompt, tpl.focus, tpl.persona);
                onClose();
              }}
            >
              <div className="template-card-header">
                <div className="template-icon-box">{tpl.icon}</div>
                <span className="template-category-badge">{tpl.category}</span>
              </div>
              <h4 className="template-card-title">{tpl.title}</h4>
              <p className="template-card-desc">{tpl.desc}</p>
              <div className="template-card-footer">
                <span>Use Template</span>
                <ArrowRight size={14} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
