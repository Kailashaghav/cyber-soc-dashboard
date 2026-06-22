import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from 'recharts';
import type { Alert } from '../services/api';
import { BarChart3, TrendingUp, ShieldAlert } from 'lucide-react';

interface AnalyticsChartsProps {
  alerts: Alert[];
  analyzedCount: number;
  anomalyCount: number;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  alerts,
  analyzedCount,
  anomalyCount,
}) => {
  
  // 1. Alert counts by severity
  const severityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    info: 0,
  };

  alerts.forEach((alert) => {
    if (severityCounts[alert.severity] !== undefined) {
      severityCounts[alert.severity]++;
    }
  });

  const severityData = [
    { name: 'Critical', value: severityCounts.critical, color: 'var(--accent-crimson)' },
    { name: 'High', value: severityCounts.high, color: 'var(--accent-amber)' },
    { name: 'Medium', value: severityCounts.medium, color: 'var(--accent-purple)' },
    { name: 'Info', value: severityCounts.info, color: 'var(--accent-cyan)' },
  ];

  // 2. Alert activity over time (rolling hourly summary based on timestamps)
  const getTimelineData = () => {
    const timeSlots: { [key: string]: number } = {};
    
    // Seed last 6 time intervals (minutes or relative seconds for demo purposes)
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const pastTime = new Date(now.getTime() - i * 15000); // 15-second blocks for demo granularity
      const timeStr = pastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      timeSlots[timeStr] = 0;
    }

    // Populate timeline with alert counts
    alerts.forEach((alert) => {
      try {
        const alertTime = new Date(alert.timestamp);
        // Find nearest 15-second block to aggregate
        const sec = Math.floor(alertTime.getSeconds() / 15) * 15;
        alertTime.setSeconds(sec);
        alertTime.setMilliseconds(0);
        
        const timeStr = alertTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        // Find closest matching slot in our pre-seeded keys
        const match = Object.keys(timeSlots).find(k => k.substring(0, 5) === timeStr.substring(0, 5));
        if (match) {
          timeSlots[match]++;
        }
      } catch {}
    });

    return Object.entries(timeSlots).map(([time, count]) => ({
      time,
      Alerts: count,
    }));
  };

  const timelineData = getTimelineData();

  return (
    <div className="bottom-col" style={{ display: 'flex', width: '100%', gap: '12px' }}>
      
      {/* Alert Severity Distribution */}
      <div className="panel" style={{ flex: '1', minWidth: '220px' }}>
        <div className="panel-header">
          <div className="panel-title">
            <BarChart3 size={16} />
            <span>Threat Classification</span>
          </div>
        </div>
        
        <div style={{ flex: 1, width: '100%', height: '120px' }}>
          {alerts.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-sans)' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]}>
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              No threat telemetry captured.
            </div>
          )}
        </div>
      </div>

      {/* Alert volume timeline */}
      <div className="panel" style={{ flex: '2', minWidth: '350px' }}>
        <div className="panel-header">
          <div className="panel-title">
            <TrendingUp size={16} />
            <span>Real-time Alert Load</span>
          </div>
        </div>
        
        <div style={{ flex: 1, width: '100%', height: '120px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={8} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} allowDecimals={false} />
              <Tooltip 
                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-sans)' }}
                labelStyle={{ color: '#fff', fontWeight: 'bold' }}
              />
              <Area type="monotone" dataKey="Alerts" stroke="var(--accent-cyan)" fillOpacity={1} fill="url(#colorAlerts)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Security Health status card */}
      <div className="panel" style={{ flex: '1.2', minWidth: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div className="panel-header">
          <div className="panel-title">
            <ShieldAlert size={16} />
            <span>Inspection Summary</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Packets Inspected:</span>
            <span style={{ fontWeight: 'bold', color: 'var(--accent-cyan)', fontFamily: 'var(--font-display)' }}>
              {analyzedCount}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Anomalies Flagged:</span>
            <span style={{ fontWeight: 'bold', color: anomalyCount > 0 ? 'var(--accent-crimson)' : 'var(--accent-green)', fontFamily: 'var(--font-display)' }}>
              {anomalyCount}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Reputation Warnings:</span>
            <span style={{ fontWeight: 'bold', color: alerts.filter(a => a.type === 'network' && a.details?.ip_reputation).length > 0 ? 'var(--accent-amber)' : 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
              {alerts.filter(a => a.type === 'network' && a.details?.ip_reputation).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
