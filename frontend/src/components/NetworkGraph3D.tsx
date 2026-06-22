import React, { useEffect, useRef, useState, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import type { VisualGraph, GraphNode, Alert } from '../services/api';
import { Shield, ShieldAlert, Zap, RefreshCw, Info } from 'lucide-react';

interface NetworkGraph3DProps {
  graphData: VisualGraph;
  selectedNode: string | null;
  onNodeSelect: (ip: string | null) => void;
  alerts: Alert[];
  onRefresh: () => void;
}

export const NetworkGraph3D: React.FC<NetworkGraph3DProps> = ({
  graphData,
  selectedNode,
  onNodeSelect,
  alerts,
  onRefresh,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [showParticles, setShowParticles] = useState(true);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [highlightedLinks, setHighlightedLinks] = useState<Set<any>>(new Set());
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);

  // Memoize graph mapping edges to links
  const forceGraphData = useMemo(() => {
    return {
      nodes: graphData.nodes,
      links: graphData.edges.map((e) => ({
        source: e.source,
        target: e.target,
        weight: e.weight,
      })),
    };
  }, [graphData]);

  // Resize graph on window resize
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Find nodes with active warnings/alerts
  const flaggedIPs = new Set<string>();
  alerts.forEach((alert) => {
    if (alert.src_ip) flaggedIPs.add(alert.src_ip);
    if (alert.dst_ip) flaggedIPs.add(alert.dst_ip);
  });

  // Highlight connections connected to hover node
  const updateHighlight = () => {
    const nodes = new Set<string>();
    const links = new Set<any>();

    if (hoverNode) {
      nodes.add(hoverNode.id);
      forceGraphData.links.forEach((link: any) => {
        const srcId = typeof link.source === 'object' ? link.source.id : link.source;
        const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
        if (srcId === hoverNode.id) {
          nodes.add(tgtId);
          links.add(link);
        } else if (tgtId === hoverNode.id) {
          nodes.add(srcId);
          links.add(link);
        }
      });
    }

    setHighlightedNodes(nodes);
    setHighlightedLinks(links);
  };

  const handleNodeHover = (node: any) => {
    setHoverNode(node);
  };

  useEffect(() => {
    updateHighlight();
  }, [hoverNode, forceGraphData]);

  // Focus camera on node when selected
  useEffect(() => {
    if (selectedNode && fgRef.current) {
      const node = graphData.nodes.find((n) => n.id === selectedNode);
      if (node && node.x !== undefined && node.y !== undefined && node.z !== undefined) {
        // Position camera to look at selected node
        const distance = 80;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        
        fgRef.current.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
          node, // lookAt locator
          1500 // transition ms
        );
      }
    }
  }, [selectedNode, graphData]);

  const handleNodeClick = (node: any) => {
    onNodeSelect(node.id === selectedNode ? null : node.id);
  };

  const getEventNodeColor = (node: any) => {
    const ip = node.id;
    if (ip === selectedNode) return '#00f0ff'; // Selection glow cyan
    if (hoverNode && highlightedNodes.has(ip)) {
      return ip === hoverNode.id ? '#ffffff' : '#00f0ff'; // Hovered node white, adjacent cyan
    }
    if (flaggedIPs.has(ip)) return '#ff0055'; // Danger crimson
    if (node.out_degree > 12 || node.in_degree > 15) return '#ffaa00'; // Warning hazard amber
    return '#00ffcc'; // Safe neon green
  };

  return (
    <div className="graph-container" ref={containerRef}>
      {/* 3D Force Graph */}
      {graphData.nodes.length > 0 ? (
        <ForceGraph3D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={forceGraphData}
          backgroundColor="#03050a"
          nodeColor={getEventNodeColor}
          nodeVal={(node: any) => Math.max(4, (node.in_degree + node.out_degree) * 0.75)}
          nodeLabel={(node: any) => {
            const isFlagged = flaggedIPs.has(node.id);
            const degreeText = `In: ${node.in_degree} | Out: ${node.out_degree}`;
            const statusText = isFlagged 
              ? `<span style="color: #ff0055; font-weight: bold;">[FLAGGED TRAFFIC]</span>` 
              : `<span style="color: #00ffcc;">[SECURE]</span>`;
            return `
              <div style="background: rgba(11, 17, 33, 0.9); border: 1px solid rgba(255, 255, 255, 0.15); padding: 8px 12px; border-radius: 6px; font-family: 'Outfit', sans-serif; pointer-events: none;">
                <div style="color: #00f0ff; font-weight: bold; margin-bottom: 4px;">IP: ${node.id}</div>
                <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 4px;">${degreeText}</div>
                <div style="font-size: 0.75rem;">Status: ${statusText}</div>
              </div>
            `;
          }}
          linkColor={(link: any) => {
            if (highlightedLinks.has(link)) return '#00f0ff';
            const srcId = typeof link.source === 'object' ? link.source.id : link.source;
            const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
            if (flaggedIPs.has(srcId) || flaggedIPs.has(tgtId)) return 'rgba(255, 0, 85, 0.4)';
            return 'rgba(255, 255, 255, 0.08)';
          }}
          linkWidth={(link: any) => (highlightedLinks.has(link) ? 2.5 : 1.2)}
          linkDirectionalParticles={showParticles ? (link: any) => {
            const srcId = typeof link.source === 'object' ? link.source.id : link.source;
            const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
            return (flaggedIPs.has(srcId) || flaggedIPs.has(tgtId) || highlightedLinks.has(link)) ? 4 : 1;
          } : 0}
          linkDirectionalParticleColor={(link: any) => {
            const srcId = typeof link.source === 'object' ? link.source.id : link.source;
            const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
            if (flaggedIPs.has(srcId) || flaggedIPs.has(tgtId)) return '#ff0055';
            return '#00ffcc';
          }}
          linkDirectionalParticleWidth={(link: any) => (highlightedLinks.has(link) ? 3 : 1.8)}
          linkDirectionalParticleSpeed={(link: any) => {
            const srcId = typeof link.source === 'object' ? link.source.id : link.source;
            const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
            return (flaggedIPs.has(srcId) || flaggedIPs.has(tgtId)) ? 0.015 : 0.006;
          }}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          cooldownTicks={100}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '12px', color: 'var(--text-secondary)' }}>
          <RefreshCw style={{ animation: 'spin 2s linear infinite' }} size={32} />
          <span>Generating 3D Network Topology Grid...</span>
        </div>
      )}

      {/* Control Overlay */}
      <div className="graph-overlay-ui">
        <div className="graph-card-ui" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
            <Shield size={16} className="glow-cyan" style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-display)', color: '#fff', letterSpacing: '1px' }}>3D NETWORK MAP</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            Nodes: <span style={{ color: '#fff', fontWeight: 'bold' }}>{graphData.nodes.length}</span> | 
            Edges: <span style={{ color: '#fff', fontWeight: 'bold' }}>{graphData.edges.length}</span>
          </div>
        </div>

        <div className="graph-card-ui" style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="secondary" 
            style={{ padding: '4px 8px', fontSize: '0.65rem' }}
            onClick={() => setShowParticles(!showParticles)}
          >
            <Zap size={10} style={{ marginRight: '4px', verticalAlign: 'middle', color: showParticles ? 'var(--accent-green)' : 'inherit' }} />
            {showParticles ? 'Hide Packet Flow' : 'Show Packet Flow'}
          </button>
          
          <button 
            className="secondary" 
            style={{ padding: '4px 8px', fontSize: '0.65rem' }}
            onClick={onRefresh}
          >
            <RefreshCw size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Reload Graph
          </button>
        </div>

        {selectedNode && (
          <div className="graph-card-ui" style={{ maxWidth: '220px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>SELECTED NODE:</span>
              <button 
                onClick={() => onNodeSelect(null)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--accent-crimson)', padding: 0, fontSize: '0.65rem', textTransform: 'none', cursor: 'pointer' }}
              >
                Clear
              </button>
            </div>
            <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-display)', fontWeight: 'bold', color: '#fff', wordBreak: 'break-all' }}>
              {selectedNode}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {graphData.nodes.find(n => n.id === selectedNode) ? (
                <>
                  <span>In-Degree: {graphData.nodes.find(n => n.id === selectedNode)?.in_degree}</span>
                  <span>Out-Degree: {graphData.nodes.find(n => n.id === selectedNode)?.out_degree}</span>
                  {flaggedIPs.has(selectedNode) && (
                    <span style={{ color: 'var(--accent-crimson)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', fontWeight: 'bold' }}>
                      <ShieldAlert size={12} /> Active Anomaly Alerts
                    </span>
                  )}
                </>
              ) : (
                <span>Loading node statistics...</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Instructions */}
      <div style={{ position: 'absolute', bottom: '12px', right: '12px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '6px', pointerEvents: 'none' }} className="graph-card-ui">
        <Info size={12} style={{ color: 'var(--accent-cyan)' }} />
        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Drag to rotate | Scroll to zoom | Click node to analyze</span>
      </div>
    </div>
  );
};
