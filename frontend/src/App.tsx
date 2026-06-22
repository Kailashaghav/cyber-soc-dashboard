import { useState, useEffect } from 'react';
import { api } from './services/api';
import type { VisualGraph, Alert, NetworkAnalysisResult } from './services/api';
import { NetworkGraph3D } from './components/NetworkGraph3D';
import { AlertPanel } from './components/AlertPanel';
import { LogAnalyzer } from './components/LogAnalyzer';
import { PhishingInspector } from './components/PhishingInspector';
import { ThreatIntel } from './components/ThreatIntel';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { Shield, Radio, ShieldAlert, Cpu, Mail, Database, X } from 'lucide-react';

function App() {
  // states
  const [graphData, setGraphData] = useState<VisualGraph>({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [anomalyCount, setAnomalyCount] = useState(0);
  
  const [activeTab, setActiveTab] = useState<'network' | 'email' | 'intel'>('network');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  // Load alert history and traffic graph on mount
  useEffect(() => {
    const initData = async () => {
      try {
        const history = await api.getAlertHistory(25);
        setAlerts(history);
        
        // Count history stats
        const networkAnomalies = history.filter(a => a.type === 'network').length;
        setAnomalyCount(networkAnomalies);
        setAnalyzedCount(networkAnomalies * 2 + 5); // Seed approximation
        
        const graph = await api.getGraph(60);
        setGraphData(graph);
      } catch (err) {
        console.error('Error fetching initial REST data', err);
      }
    };

    initData();
  }, []);

  // Web Socket real-time subscription
  useEffect(() => {
    const handleWSAlert = (alert: Alert) => {
      setAlerts((prev) => [alert, ...prev.slice(0, 49)]); // Maintain max 50 items
      if (alert.type === 'network') {
        setAnomalyCount((c) => c + 1);
        setAnalyzedCount((c) => c + 1);
        // Refresh graph to show the new connection
        refreshGraph();
      }
    };

    const cleanup = api.connectAlertsWS(handleWSAlert);
    return () => cleanup();
  }, []);

  const refreshGraph = async () => {
    try {
      const graph = await api.getGraph(60);
      setGraphData(graph);
    } catch (err) {
      console.error('Error refreshing graph', err);
    }
  };

  const handleManualAnalyze = (result: NetworkAnalysisResult) => {
    setAnalyzedCount((c) => c + 1);
    if (result.flagged) {
      setAnomalyCount((c) => c + 1);
    }
    // Refresh topology
    refreshGraph();
  };

  // Close details panel drawer
  const closeAlertDrawer = () => {
    setSelectedAlert(null);
  };

  return (
    <>
      {/* Top Banner Navigation */}
      <header className="header-bar">
        <div className="logo-section">
          <Shield size={24} style={{ color: 'var(--accent-cyan)' }} className="glow-cyan" />
          <span className="logo-text">Aegis Cybersecurity SOC</span>
          <div className="badge-live">Telemetry Stream</div>
        </div>

        <div className="status-summary">
          <div className="status-item">
            <Radio size={14} style={{ color: 'var(--accent-green)', animation: 'blink 1.5s infinite' }} />
            <span>Alerts Broadcast:</span>
            <span className="status-value" style={{ color: 'var(--accent-green)' }}>Active</span>
          </div>
          <div className="status-item">
            <span>Threat Blocklist:</span>
            <span className="status-value" style={{ color: 'var(--accent-cyan)' }}>Trie O(k)</span>
          </div>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="dashboard-grid">
        
        {/* Left Column - Live alerts stream */}
        <div className="left-col">
          <AlertPanel 
            alerts={alerts} 
            onSelectAlert={setSelectedAlert}
            audioEnabled={audioEnabled}
            setAudioEnabled={setAudioEnabled}
          />
        </div>

        {/* Center Column - 3D Force-Directed Map */}
        <div className="center-col panel" style={{ padding: 0 }}>
          <NetworkGraph3D 
            graphData={graphData} 
            selectedNode={selectedNode}
            onNodeSelect={setSelectedNode}
            alerts={alerts}
            onRefresh={refreshGraph}
          />
        </div>

        {/* Right Column - ML Workspace tab panels */}
        <div className="right-col">
          <div className="panel" style={{ flex: 1, minHeight: 0 }}>
            <div className="tab-container" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div 
                className={`tab ${activeTab === 'network' ? 'active' : ''}`} 
                onClick={() => setActiveTab('network')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Cpu size={12} />
                Network Log
              </div>
              <div 
                className={`tab ${activeTab === 'email' ? 'active' : ''}`} 
                onClick={() => setActiveTab('email')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Mail size={12} />
                Phishing NLP
              </div>
              <div 
                className={`tab ${activeTab === 'intel' ? 'active' : ''}`} 
                onClick={() => setActiveTab('intel')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Database size={12} />
                Threat Intel
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
              {activeTab === 'network' && <LogAnalyzer onAnalyzeSuccess={handleManualAnalyze} />}
              {activeTab === 'email' && <PhishingInspector />}
              {activeTab === 'intel' && <ThreatIntel />}
            </div>
          </div>
        </div>

        {/* Bottom Column - Analytics telemetry */}
        <AnalyticsCharts 
          alerts={alerts} 
          analyzedCount={analyzedCount}
          anomalyCount={anomalyCount}
        />
      </main>

      {/* Slide-out alert detail drawer */}
      <div className={`drawer ${selectedAlert ? 'open' : ''}`}>
        {selectedAlert && (
          <>
            <div className="drawer-header">
              <span className="drawer-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={18} style={{ color: selectedAlert.severity === 'critical' || selectedAlert.severity === 'high' ? 'var(--accent-crimson)' : 'var(--accent-amber)' }} />
                <span>Alert Telemetry Report</span>
              </span>
              <button className="close-btn" onClick={closeAlertDrawer}>
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
              <div style={{ padding: '12px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Incident Summary</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff' }}>{selectedAlert.summary}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="detail-row">
                  <span className="detail-label">Incident Type</span>
                  <span className="detail-value" style={{ textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>{selectedAlert.type}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Severity Rank</span>
                  <span className="detail-value" style={{ color: selectedAlert.severity === 'critical' ? 'var(--accent-crimson)' : 'var(--accent-amber)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    {selectedAlert.severity}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Captured Timestamp</span>
                  <span className="detail-value">{new Date(selectedAlert.timestamp).toLocaleString()}</span>
                </div>
                {selectedAlert.src_ip && (
                  <div className="detail-row">
                    <span className="detail-label">Attacker Source IP</span>
                    <span className="detail-value" style={{ color: 'var(--accent-cyan)', cursor: 'pointer' }} onClick={() => setSelectedNode(selectedAlert.src_ip || null)}>
                      {selectedAlert.src_ip}
                    </span>
                  </div>
                )}
                {selectedAlert.dst_ip && (
                  <div className="detail-row">
                    <span className="detail-label">Target Destination IP</span>
                    <span className="detail-value" style={{ color: 'var(--accent-cyan)', cursor: 'pointer' }} onClick={() => setSelectedNode(selectedAlert.dst_ip || null)}>
                      {selectedAlert.dst_ip}
                    </span>
                  </div>
                )}
              </div>

              {/* Raw Payload Inspector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Raw Model Output Payload:</div>
                <pre style={{ padding: '12px', borderRadius: '6px', background: '#020408', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem', color: '#00ffcc', overflowX: 'auto', fontFamily: 'monospace' }}>
                  {JSON.stringify(selectedAlert.details, null, 2)}
                </pre>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default App;
