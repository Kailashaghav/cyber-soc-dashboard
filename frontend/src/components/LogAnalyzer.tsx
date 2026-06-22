import React, { useState } from 'react';
import { api } from '../services/api';
import type { TrafficLogInput, NetworkAnalysisResult } from '../services/api';
import { Cpu, AlertTriangle, ShieldCheck } from 'lucide-react';

interface LogAnalyzerProps {
  onAnalyzeSuccess: (result: NetworkAnalysisResult) => void;
}

const PRESETS = [
  {
    name: 'Normal HTTP Traffic',
    data: {
      protocol_type: 'tcp',
      service: 'http',
      flag: 'SF',
      src_bytes: 232,
      dst_bytes: 4235,
      duration: 0,
      count: 2,
      srv_count: 2,
      logged_in: 1,
      same_srv_rate: 1,
      diff_srv_rate: 0,
      src_ip: '192.168.1.45',
      dst_ip: '10.0.0.5',
    },
  },
  {
    name: 'Port Scan Attempt',
    data: {
      protocol_type: 'tcp',
      service: 'private',
      flag: 'S0',
      src_bytes: 0,
      dst_bytes: 0,
      duration: 0,
      count: 229,
      srv_count: 10,
      logged_in: 0,
      same_srv_rate: 0.04,
      diff_srv_rate: 0.06,
      src_ip: '185.220.10.22', // Tor Exit Node range
      dst_ip: '10.0.0.12',
    },
  },
  {
    name: 'DDoS Attack (Syn Flood)',
    data: {
      protocol_type: 'tcp',
      service: 'private',
      flag: 'S0',
      src_bytes: 0,
      dst_bytes: 0,
      duration: 0,
      count: 511,
      srv_count: 511,
      logged_in: 0,
      same_srv_rate: 1.0,
      diff_srv_rate: 0.0,
      src_ip: '203.0.113.88',
      dst_ip: '10.0.0.5', // DDoS target
    },
  },
  {
    name: 'Novel/Anomalous Transfer',
    data: {
      protocol_type: 'tcp',
      service: 'ftp',
      flag: 'SF',
      src_bytes: 9845210, // Unusually huge src_bytes
      dst_bytes: 120,
      duration: 45,
      count: 1,
      srv_count: 1,
      logged_in: 1,
      same_srv_rate: 1,
      diff_srv_rate: 0,
      src_ip: '192.168.1.189',
      dst_ip: '45.155.205.233', // Known C2 Server
    },
  },
];

export const LogAnalyzer: React.FC<LogAnalyzerProps> = ({ onAnalyzeSuccess }) => {
  const [formData, setFormData] = useState<TrafficLogInput>({
    protocol_type: 'tcp',
    service: 'http',
    flag: 'SF',
    src_bytes: 150,
    dst_bytes: 300,
    duration: 0,
    count: 1,
    srv_count: 1,
    logged_in: 1,
    same_srv_rate: 1.0,
    diff_srv_rate: 0.0,
    src_ip: '192.168.1.50',
    dst_ip: '10.0.0.5',
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NetworkAnalysisResult | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const isNumeric = ['src_bytes', 'dst_bytes', 'duration', 'count', 'srv_count', 'logged_in', 'same_srv_rate', 'diff_srv_rate'].includes(name);
    
    setFormData((prev) => ({
      ...prev,
      [name]: isNumeric ? (value === '' ? 0 : parseFloat(value)) : value,
    }));
  };

  const loadPreset = (preset: typeof PRESETS[0]) => {
    setFormData(preset.data);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await api.analyzeTraffic(formData);
      setResult(res);
      onAnalyzeSuccess(res);
    } catch (err) {
      console.error('Error analyzing traffic', err);
    } finally {
      setLoading(false);
    }
  };

  // Compute reconstruction error progress percentage for gauge
  const getReconPercent = (error: number, threshold: number) => {
    const maxVal = threshold * 3;
    return Math.min(100, (error / maxVal) * 100);
  };

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="panel-header">
        <div className="panel-title">
          <Cpu size={18} />
          <span>Intrusion ML Inspector</span>
        </div>
      </div>

      {/* Preset Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
        {PRESETS.map((preset, i) => (
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
        <div className="form-grid">
          <div className="form-group">
            <label>Source IP</label>
            <input name="src_ip" type="text" value={formData.src_ip || ''} onChange={handleInputChange} placeholder="192.168.1.1" />
          </div>
          <div className="form-group">
            <label>Dest IP</label>
            <input name="dst_ip" type="text" value={formData.dst_ip || ''} onChange={handleInputChange} placeholder="10.0.0.5" />
          </div>
        </div>

        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div className="form-group">
            <label>Protocol</label>
            <select name="protocol_type" value={formData.protocol_type} onChange={handleInputChange}>
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
              <option value="icmp">ICMP</option>
            </select>
          </div>
          <div className="form-group">
            <label>Service</label>
            <select name="service" value={formData.service} onChange={handleInputChange}>
              <option value="http">HTTP</option>
              <option value="ftp">FTP</option>
              <option value="smtp">SMTP</option>
              <option value="private">Private</option>
              <option value="domain_u">Domain DNS</option>
              <option value="eco_i">Echo ICMP</option>
            </select>
          </div>
          <div className="form-group">
            <label>Flag</label>
            <select name="flag" value={formData.flag} onChange={handleInputChange}>
              <option value="SF">SF (Normal Connection)</option>
              <option value="S0">S0 (SYN Attempt, No Response)</option>
              <option value="REJ">REJ (Connection Rejected)</option>
              <option value="RSTR">RSTR (Reset by Responder)</option>
            </select>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Source Bytes</label>
            <input name="src_bytes" type="number" value={formData.src_bytes} onChange={handleInputChange} />
          </div>
          <div className="form-group">
            <label>Dest Bytes</label>
            <input name="dst_bytes" type="number" value={formData.dst_bytes} onChange={handleInputChange} />
          </div>
        </div>

        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div className="form-group">
            <label>Conn Count</label>
            <input name="count" type="number" value={formData.count} onChange={handleInputChange} />
          </div>
          <div className="form-group">
            <label>Same Srv Rate</label>
            <input name="same_srv_rate" type="number" step="0.01" min="0" max="1" value={formData.same_srv_rate} onChange={handleInputChange} />
          </div>
          <div className="form-group">
            <label>Diff Srv Rate</label>
            <input name="diff_srv_rate" type="number" step="0.01" min="0" max="1" value={formData.diff_srv_rate} onChange={handleInputChange} />
          </div>
        </div>

        <button type="submit" disabled={loading} style={{ marginTop: '4px' }}>
          {loading ? 'Analyzing Traffic Patterns...' : 'Inspect Connection'}
        </button>
      </form>

      {/* Analysis Results Display */}
      {result && (
        <div style={{ marginTop: '8px', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Header Status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>DECISION ENGINE:</span>
            {result.flagged ? (
              <span style={{ color: 'var(--accent-crimson)', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={14} /> FLAGGED ({result.severity.toUpperCase()})
              </span>
            ) : (
              <span style={{ color: 'var(--accent-green)', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={14} /> PATTERN SECURE
              </span>
            )}
          </div>

          {/* Model Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
            {/* RandomForest */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>RandomForest (Supervised)</span>
              <span style={{ fontWeight: 'bold', color: result.random_forest.is_attack ? 'var(--accent-crimson)' : 'var(--accent-green)' }}>
                {result.random_forest.is_attack 
                  ? `${result.random_forest.attack_category} (${Math.round(result.random_forest.attack_probability * 100)}%)` 
                  : 'Normal'
                }
              </span>
            </div>

            {/* Autoencoder reconstruction gauge */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Autoencoder Anomaly Score</span>
                <span style={{ fontWeight: 'bold', color: result.autoencoder.is_anomaly ? 'var(--accent-amber)' : 'var(--accent-green)' }}>
                  Error: {result.autoencoder.reconstruction_error}
                </span>
              </div>
              <div className="gauge-track">
                <div 
                  className="gauge-fill" 
                  style={{ 
                    width: `${getReconPercent(result.autoencoder.reconstruction_error, result.autoencoder.threshold)}%`,
                    backgroundColor: result.autoencoder.is_anomaly ? 'var(--accent-crimson)' : 'var(--accent-green)',
                    boxShadow: `0 0 8px ${result.autoencoder.is_anomaly ? 'var(--accent-crimson)' : 'var(--accent-green)'}`
                  }}
                />
                <div 
                  className="gauge-marker" 
                  style={{ left: `${(result.autoencoder.threshold / (result.autoencoder.threshold * 3)) * 100}%` }}
                  title={`Anomaly Threshold: ${result.autoencoder.threshold}`}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                <span>0.0</span>
                <span>Threshold: {result.autoencoder.threshold}</span>
                <span>Max</span>
              </div>
            </div>

            {/* IP reputation warnings */}
            {(result.ip_reputation.src_ip?.flagged || result.ip_reputation.dst_ip?.flagged) && (
              <div style={{ background: 'rgba(255, 0, 85, 0.08)', border: '1px solid rgba(255, 0, 85, 0.2)', padding: '6px', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--accent-crimson)' }}>
                {result.ip_reputation.src_ip?.flagged && (
                  <div>&bull; SRC [{result.ip_reputation.src_ip.ip}] reputation match: {result.ip_reputation.src_ip.details?.reason}</div>
                )}
                {result.ip_reputation.dst_ip?.flagged && (
                  <div>&bull; DST [{result.ip_reputation.dst_ip.ip}] reputation match: {result.ip_reputation.dst_ip.details?.reason}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
