const API_BASE_URL = 'http://localhost:8000';
const WS_BASE_URL = 'ws://localhost:8000';

export interface TrafficLogInput {
  protocol_type: string;
  service: string;
  flag: string;
  src_bytes: number;
  dst_bytes: number;
  duration?: number;
  count?: number;
  srv_count?: number;
  logged_in?: number;
  same_srv_rate?: number;
  diff_srv_rate?: number;
  src_ip?: string;
  dst_ip?: string;
}

export interface ModelPrediction {
  model: string;
  is_attack?: boolean;
  attack_probability?: number;
  attack_category?: string;
  is_anomaly?: boolean;
  reconstruction_error?: number;
  threshold?: number;
}

export interface NetworkAnalysisResult {
  flagged: boolean;
  severity: string;
  random_forest: {
    model: string;
    is_attack: boolean;
    attack_probability: number;
    attack_category: string;
  };
  autoencoder: {
    model: string;
    is_anomaly: boolean;
    reconstruction_error: number;
    threshold: number;
  };
  ip_reputation: {
    src_ip?: { ip: string; flagged: boolean; details: any };
    dst_ip?: { ip: string; flagged: boolean; details: any };
  };
}

export interface EmailCheckInput {
  subject: string;
  body: string;
}

export interface EmailAnalysisResult {
  is_phishing: boolean;
  phishing_probability: number;
  top_signals: Array<{ term: string; weight: number }>;
}

export interface GraphNode {
  id: string;
  out_degree: number;
  in_degree: number;
  x?: number;
  y?: number;
  z?: number;
}

export interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number;
}

export interface VisualGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Alert {
  type: 'network' | 'email';
  severity: 'critical' | 'high' | 'medium' | 'info';
  summary: string;
  details: any;
  src_ip?: string;
  dst_ip?: string;
  timestamp: string;
}

export const api = {
  async analyzeTraffic(log: TrafficLogInput): Promise<NetworkAnalysisResult> {
    const response = await fetch(`${API_BASE_URL}/api/network/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
    return response.json();
  },

  async getGraph(maxNodes: number = 100): Promise<VisualGraph> {
    const response = await fetch(`${API_BASE_URL}/api/network/graph?max_nodes=${maxNodes}`);
    return response.json();
  },

  async getPortScanAlerts(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/api/network/graph/port-scan-alerts`);
    const data = await response.json();
    return data.alerts || [];
  },

  async getDdosAlerts(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/api/network/graph/ddos-alerts`);
    const data = await response.json();
    return data.alerts || [];
  },

  async analyzeEmail(payload: EmailCheckInput): Promise<EmailAnalysisResult> {
    const response = await fetch(`${API_BASE_URL}/api/email/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  async checkIP(ip: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/threat-intel/check-ip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip }),
    });
    return response.json();
  },

  async checkDomain(domain: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/threat-intel/check-domain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    });
    return response.json();
  },

  async addIPToBlocklist(ipPrefix: string, reason: string, severity: string = 'high'): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/threat-intel/blocklist/ip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip_prefix: ipPrefix, reason, severity }),
    });
    return response.json();
  },

  async addDomainToBlocklist(domain: string, reason: string, severity: string = 'high'): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/threat-intel/blocklist/domain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, reason, severity }),
    });
    return response.json();
  },

  async getAlertHistory(limit: number = 50): Promise<Alert[]> {
    const response = await fetch(`${API_BASE_URL}/api/alerts/history?limit=${limit}`);
    const data = await response.json();
    return data.alerts || [];
  },

  connectAlertsWS(onAlert: (alert: Alert) => void, onConnect?: () => void, onDisconnect?: () => void): () => void {
    let ws: WebSocket;
    let reconnectTimeout: any;
    let isClosedIntentional = false;

    const connect = () => {
      ws = new WebSocket(`${WS_BASE_URL}/api/alerts/ws`);

      ws.onopen = () => {
        console.log('Alerts WebSocket connected.');
        if (onConnect) onConnect();
      };

      ws.onmessage = (event) => {
        try {
          const alert = JSON.parse(event.data) as Alert;
          onAlert(alert);
        } catch (err) {
          console.error('Error parsing alert WebSocket payload', err);
        }
      };

      ws.onclose = () => {
        console.log('Alerts WebSocket disconnected.');
        if (onDisconnect) onDisconnect();
        if (!isClosedIntentional) {
          reconnectTimeout = setTimeout(connect, 3000); // Autoreconnect
        }
      };

      ws.onerror = (err) => {
        console.error('Alerts WebSocket error:', err);
      };
    };

    connect();

    return () => {
      isClosedIntentional = true;
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  },
};
