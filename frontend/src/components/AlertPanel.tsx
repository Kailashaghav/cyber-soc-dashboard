import React, { useState, useEffect } from 'react';
import type { Alert } from '../services/api';
import { Bell, BellOff, AlertTriangle, ShieldCheck, Info, SquareTerminal } from 'lucide-react';

interface AlertPanelProps {
  alerts: Alert[];
  onSelectAlert: (alert: Alert) => void;
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({
  alerts,
  onSelectAlert,
  audioEnabled,
  setAudioEnabled,
}) => {
  const [filter, setFilter] = useState<'all' | 'severe' | 'medium-info'>('all');

  // Synthesis alarm sound in browser
  const playAlertSound = (severity: string) => {
    if (!audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (severity === 'critical') {
        // High-low alternating siren
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(440, ctx.currentTime + 0.15);
        osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.3);
        
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (severity === 'high') {
        // Double beep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(700, ctx.currentTime);
        
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + 0.12);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else {
        // Low ping
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn('Audio Context block:', e);
    }
  };

  // Play alarm sound when a new alert arrives
  useEffect(() => {
    if (alerts.length > 0) {
      const latest = alerts[0];
      playAlertSound(latest.severity);
    }
  }, [alerts]);

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'severe') return alert.severity === 'critical' || alert.severity === 'high';
    if (filter === 'medium-info') return alert.severity === 'medium' || alert.severity === 'info';
    return true;
  });

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle size={16} className="glow-crimson" style={{ color: 'var(--accent-crimson)' }} />;
      case 'medium':
        return <AlertTriangle size={16} className="glow-amber" style={{ color: 'var(--accent-amber)' }} />;
      default:
        return <Info size={16} className="glow-cyan" style={{ color: 'var(--accent-cyan)' }} />;
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="panel" style={{ flex: 1, minHeight: 0 }}>
      <div className="panel-header">
        <div className="panel-title">
          <SquareTerminal size={18} />
          <span>Real-time Alert Feed</span>
        </div>
        
        <button 
          onClick={() => setAudioEnabled(!audioEnabled)}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            padding: '4px',
            color: audioEnabled ? 'var(--accent-cyan)' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
          title={audioEnabled ? 'Mute Alert Sound' : 'Enable Alert Sound'}
        >
          {audioEnabled ? <Bell size={16} /> : <BellOff size={16} />}
        </button>
      </div>

      <div className="tab-container">
        <div 
          className={`tab ${filter === 'all' ? 'active' : ''}`} 
          onClick={() => setFilter('all')}
        >
          All ({alerts.length})
        </div>
        <div 
          className={`tab ${filter === 'severe' ? 'active' : ''}`} 
          onClick={() => setFilter('severe')}
        >
          Critical/High ({alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length})
        </div>
        <div 
          className={`tab ${filter === 'medium-info' ? 'active' : ''}`} 
          onClick={() => setFilter('medium-info')}
        >
          Med/Info ({alerts.filter(a => a.severity === 'medium' || a.severity === 'info').length})
        </div>
      </div>

      <div className="alert-feed">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert, index) => (
            <div 
              key={index} 
              className={`alert-card ${alert.severity}`}
              onClick={() => onSelectAlert(alert)}
            >
              <div className="alert-meta">
                <span className="alert-severity">{alert.severity}</span>
                <span>{formatTimestamp(alert.timestamp)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {getAlertIcon(alert.severity)}
                <span className="alert-title">{alert.summary}</span>
              </div>
              {(alert.src_ip || alert.dst_ip) && (
                <div className="alert-ips">
                  {alert.src_ip && <span>SRC: {alert.src_ip}</span>}
                  {alert.dst_ip && <span>&rarr; DST: {alert.dst_ip}</span>}
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <ShieldCheck size={28} style={{ color: 'var(--accent-green)' }} />
            <span>No alerts flagged. Network secure.</span>
          </div>
        )}
      </div>
    </div>
  );
};
