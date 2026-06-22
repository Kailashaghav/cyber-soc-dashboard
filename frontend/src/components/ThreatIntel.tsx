import React, { useState } from 'react';
import { api } from '../services/api';
import { ShieldCheck, ShieldAlert, Plus, Search, Database } from 'lucide-react';

export const ThreatIntel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'check' | 'add'>('check');
  const [queryType, setQueryType] = useState<'ip' | 'domain'>('ip');
  const [queryVal, setQueryVal] = useState('185.220.10.55');
  const [checkResult, setCheckResult] = useState<any | null>(null);
  
  // Blocklist inputs
  const [blockValue, setBlockValue] = useState('');
  const [blockReason, setBlockReason] = useState('botnet_c2');
  const [blockSeverity, setBlockSeverity] = useState('high');
  const [addStatus, setAddStatus] = useState<string | null>(null);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryVal.trim()) return;
    setCheckResult(null);
    try {
      let res;
      if (queryType === 'ip') {
        res = await api.checkIP(queryVal.trim());
      } else {
        res = await api.checkDomain(queryVal.trim());
      }
      setCheckResult(res);
    } catch (err) {
      console.error('Error querying threat intel reputation', err);
    }
  };

  const handleAddBlocklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockValue.trim()) return;
    setAddStatus(null);
    try {
      if (queryType === 'ip') {
        await api.addIPToBlocklist(blockValue.trim(), blockReason, blockSeverity);
        setAddStatus(`Successfully appended IP prefix [${blockValue}] to Trie Blocklist!`);
      } else {
        await api.addDomainToBlocklist(blockValue.trim(), blockReason, blockSeverity);
        setAddStatus(`Successfully appended Domain [${blockValue}] to Trie Blocklist!`);
      }
      setBlockValue('');
    } catch (err) {
      setAddStatus('Failed to update blocklist registry.');
      console.error('Error adding rule to blocklist', err);
    }
  };

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="panel-header">
        <div className="panel-title">
          <Database size={18} />
          <span>Trie Threat Intelligence</span>
        </div>
      </div>

      <div className="tab-container" style={{ marginBottom: '8px' }}>
        <div 
          className={`tab ${activeTab === 'check' ? 'active' : ''}`} 
          onClick={() => { setActiveTab('check'); setCheckResult(null); setAddStatus(null); }}
        >
          Check Reputation
        </div>
        <div 
          className={`tab ${activeTab === 'add' ? 'active' : ''}`} 
          onClick={() => { setActiveTab('add'); setCheckResult(null); setAddStatus(null); }}
        >
          Register Threat
        </div>
      </div>

      {activeTab === 'check' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <form onSubmit={handleCheck} style={{ display: 'flex', gap: '6px' }}>
            <select 
              value={queryType} 
              onChange={(e) => { setQueryType(e.target.value as any); setQueryVal(e.target.value === 'ip' ? '185.220.10.55' : 'paypal-confirm-security.com'); }}
              style={{ width: '90px', padding: '6px' }}
            >
              <option value="ip">IP</option>
              <option value="domain">Domain</option>
            </select>
            <input 
              type="text" 
              value={queryVal} 
              onChange={(e) => setQueryVal(e.target.value)} 
              placeholder={queryType === 'ip' ? 'e.g. 185.220.10.5' : 'e.g. secure-login.com'}
              style={{ padding: '6px 10px' }}
            />
            <button type="submit" style={{ padding: '6px 12px' }}>
              <Search size={14} />
            </button>
          </form>

          {checkResult && (
            <div style={{ padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#fff', wordBreak: 'break-all' }}>
                  {queryType === 'ip' ? checkResult.ip : checkResult.domain}
                </span>
                {checkResult.flagged ? (
                  <span style={{ color: 'var(--accent-crimson)', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldAlert size={14} /> BLOCKED
                  </span>
                ) : (
                  <span style={{ color: 'var(--accent-green)', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={14} /> ALLOWED
                  </span>
                )}
              </div>

              {checkResult.flagged && checkResult.details && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <div>Reason: <span style={{ color: '#fff' }}>{checkResult.details.reason}</span></div>
                  <div>Severity Match: <span style={{ color: checkResult.details.severity === 'critical' ? 'var(--accent-crimson)' : 'var(--accent-amber)' }}>{checkResult.details.severity.toUpperCase()}</span></div>
                  {checkResult.details.ip_prefix && (
                    <div>Matched Rule: <span style={{ color: '#fff' }}>{checkResult.details.ip_prefix}</span></div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleAddBlocklist} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="form-grid" style={{ gridTemplateColumns: '90px 1fr' }}>
            <div className="form-group">
              <label>Target Type</label>
              <select 
                value={queryType} 
                onChange={(e) => { setQueryType(e.target.value as any); setBlockValue(''); }}
                style={{ padding: '6px' }}
              >
                <option value="ip">IP Prefix</option>
                <option value="domain">Domain</option>
              </select>
            </div>
            <div className="form-group">
              <label>{queryType === 'ip' ? 'IP CIDR/Prefix' : 'Domain Name'}</label>
              <input 
                type="text" 
                value={blockValue} 
                onChange={(e) => setBlockValue(e.target.value)} 
                placeholder={queryType === 'ip' ? 'e.g. 192.168.10' : 'e.g. badsite.com'}
                style={{ padding: '6px' }}
                required
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Match Reason</label>
              <select value={blockReason} onChange={(e) => setBlockReason(e.target.value)} style={{ padding: '6px' }}>
                <option value="tor_exit_node">Tor Exit Node</option>
                <option value="botnet_c2">Botnet Command & Control</option>
                <option value="phishing_activity">Phishing Host</option>
                <option value="spam_source">Spam Generator</option>
                <option value="known_exploit_origin">Exploit Scanner</option>
              </select>
            </div>
            <div className="form-group">
              <label>Severity level</label>
              <select value={blockSeverity} onChange={(e) => setBlockSeverity(e.target.value)} style={{ padding: '6px' }}>
                <option value="info">Info</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <button type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px' }}>
            <Plus size={14} /> Append Blocklist Rule
          </button>

          {addStatus && (
            <div style={{ color: addStatus.includes('Successfully') ? 'var(--accent-green)' : 'var(--accent-crimson)', fontSize: '0.75rem', marginTop: '4px', textAlign: 'center' }}>
              {addStatus}
            </div>
          )}
        </form>
      )}
    </div>
  );
};
