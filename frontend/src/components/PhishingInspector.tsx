import React, { useState } from 'react';
import { api } from '../services/api';
import type { EmailCheckInput, EmailAnalysisResult } from '../services/api';
import { Mail, ShieldAlert, ShieldCheck } from 'lucide-react';

const EMAIL_PRESETS = [
  {
    name: 'Phishing (Urgent Alert)',
    subject: 'Urgent: Verify your banking credentials now',
    body: 'We detected suspicious activity on your account. Please click here http://paypal-confirm-security.com immediately to verify your credentials, or your access will be suspended within 24 hours. Sincerely, Security Dept.',
  },
  {
    name: 'Phishing (Urgent Notice)',
    subject: 'Update Account Information',
    body: 'Dear client, your password has expired. You must update your billing details on our secure-login-verify.com portal to avoid debit suspension.',
  },
  {
    name: 'Legitimate Corporate Email',
    subject: 'Minutes of yesterday meeting',
    body: 'Hi team, please find attached the spreadsheet summary for the Q3 planning session. Let me know if you have any questions or feedback before the board meeting next Wednesday. Thanks, Sarah.',
  },
];

export const PhishingInspector: React.FC = () => {
  const [formData, setFormData] = useState<EmailCheckInput>({
    subject: 'Verify your account',
    body: 'Please verify your credentials immediately at http://paypal-confirm-security.com or your account will be disabled.',
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmailAnalysisResult | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const loadPreset = (preset: typeof EMAIL_PRESETS[0]) => {
    setFormData({ subject: preset.subject, body: preset.body });
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.body.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.analyzeEmail(formData);
      setResult(res);
    } catch (err) {
      console.error('Error analyzing email', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to color words by weight
  const renderHighlightedBody = () => {
    if (!result || !result.top_signals) return formData.body;
    
    // Create map of terms
    const signalMap = new Map<string, number>();
    result.top_signals.forEach((sig) => {
      signalMap.set(sig.term.toLowerCase(), sig.weight);
    });

    // Split text by words
    const words = formData.body.split(/(\s+)/);
    return words.map((part, index) => {
      const cleanWord = part.toLowerCase().replace(/[^a-z0-9]/g, '');
      const weight = signalMap.get(cleanWord);
      
      if (weight !== undefined) {
        const isPhish = weight > 0;
        return (
          <span 
            key={index} 
            className={`phishing-word ${isPhish ? 'phish' : 'ham'}`}
            title={`NLP weight: ${weight}`}
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="panel-header">
        <div className="panel-title">
          <Mail size={18} />
          <span>NLP Phishing Scanner</span>
        </div>
      </div>

      {/* presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
        {EMAIL_PRESETS.map((preset, i) => (
          <button 
            key={i} 
            type="button" 
            className="secondary" 
            style={{ padding: '4px 8px', fontSize: '0.65rem', textTransform: 'none', letterSpacing: '0.5px' }}
            onClick={() => loadPreset(preset)}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <form onSubmit={handleAnalyze} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="form-group">
          <label>Email Subject</label>
          <input 
            name="subject" 
            type="text" 
            value={formData.subject} 
            onChange={handleInputChange} 
            placeholder="e.g. Verify password update" 
          />
        </div>
        
        <div className="form-group">
          <label>Email Body</label>
          <textarea 
            name="body" 
            value={formData.body} 
            onChange={handleInputChange} 
            rows={3} 
            placeholder="Paste raw email body here..." 
          />
        </div>

        <button type="submit" disabled={loading} style={{ marginTop: '4px' }}>
          {loading ? 'Evaluating Text Semantics...' : 'Scan For Phishing'}
        </button>
      </form>

      {result && (
        <div style={{ marginTop: '8px', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* Probability Indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>PHISHING CLASSIFICATION:</span>
            {result.is_phishing ? (
              <span style={{ color: 'var(--accent-crimson)', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldAlert size={14} /> POSITIVE ({Math.round(result.phishing_probability * 100)}%)
              </span>
            ) : (
              <span style={{ color: 'var(--accent-green)', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={14} /> HAM SECURE ({Math.round((1 - result.phishing_probability) * 100)}%)
              </span>
            )}
          </div>

          {/* Highlighted text visual block */}
          <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', lineHeight: '1.4', color: 'var(--text-secondary)', maxHeight: '100px', overflowY: 'auto' }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>
              Explainable NLP Highlights:
            </div>
            {renderHighlightedBody()}
          </div>

          {/* Top contributing terms table */}
          <div>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>
              Semantic Word Weights:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {result.top_signals.map((sig, idx) => {
                const isPhish = sig.weight > 0;
                return (
                  <span 
                    key={idx} 
                    style={{ 
                      fontSize: '0.65rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: isPhish ? 'rgba(255, 0, 85, 0.08)' : 'rgba(0, 255, 204, 0.08)',
                      border: `1px solid ${isPhish ? 'rgba(255, 0, 85, 0.15)' : 'rgba(0, 255, 204, 0.15)'}`,
                      color: isPhish ? 'var(--accent-crimson)' : 'var(--accent-green)',
                      fontFamily: 'var(--font-display)'
                    }}
                  >
                    "{sig.term}": {sig.weight > 0 ? `+${sig.weight}` : sig.weight}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
