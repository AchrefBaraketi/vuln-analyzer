import React, { useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

const ConnectivityGraph = ({ dependencies, graph }) => {
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const [tooltip, setTooltip] = useState({ x: 0, y: 0, text: '' });

  const { nodes, edges } = useMemo(() => {
    const nodes = [];
    const edges = [];
    const addedNodes = new Set();

    // Build reverse adjacency for impact calculation
    const reverseAdj = {};
    if (Array.isArray(graph)) {
      graph.forEach(({ from, to }) => {
        if (!reverseAdj[to]) reverseAdj[to] = [];
        reverseAdj[to].push(from);
      });
    }

    // Identify vulnerable nodes
    const vulnerableSet = new Set(
      dependencies.filter(d => d.vulnerabilities?.length).map(d => d.fileName)
    );

    // BFS for impacted
    const impactedSet = new Set();
    const visited = new Set(vulnerableSet);
    const queue = [...vulnerableSet];
    while (queue.length) {
      const curr = queue.shift();
      (reverseAdj[curr] || []).forEach(dep => {
        if (!visited.has(dep)) {
          visited.add(dep);
          if (!vulnerableSet.has(dep)) impactedSet.add(dep);
          queue.push(dep);
        }
      });
    }

    // Nodes
    dependencies.forEach((dep, i) => {
      const id = dep.fileName;
      let backgroundColor = '#28a745';
      if (vulnerableSet.has(id)) backgroundColor = '#dc3545';
      else if (impactedSet.has(id)) backgroundColor = '#fd7e14';

      if (!addedNodes.has(id)) {
        nodes.push({
          id,
          data: { label: id },
          position: { x: 150 + (i % 4) * 220, y: 80 + Math.floor(i / 4) * 140 },
          style: {
            backgroundColor,
            color: '#fff',
            padding: 8,
            borderRadius: 6,
            fontSize: 12,
            border: '1px solid #333',
            width: 180
          }
        });
        addedNodes.add(id);
      }
    });

    // Edges with colors and hover-friendly styles (no static labels)
    if (Array.isArray(graph)) {
      graph.forEach(({ from, to }) => {
        const isVulnEdge = vulnerableSet.has(from);
        const isImpEdge = impactedSet.has(to);
        const edgeColor = isVulnEdge ? '#dc3545' : isImpEdge ? '#fd7e14' : '#888';

        edges.push({
          id: `${from}->${to}`,
          source: from,
          target: to,
          type: 'smoothstep',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
          style: {
            strokeWidth: hoveredEdge === `${from}->${to}` ? 4 : 2,
            stroke: edgeColor,
            opacity: hoveredEdge === `${from}->${to}` ? 1 : 0.7
          },
        });
      });
    }

    return { nodes, edges };
  }, [dependencies, graph, hoveredEdge]);

  return (
    <div style={{ width: '100%', height: 600, position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        panOnScroll
        zoomOnScroll
        onEdgeMouseEnter={(evt, edge) => {
          setHoveredEdge(edge.id);
          setTooltip({ x: evt.clientX, y: evt.clientY, text: `${edge.source} → ${edge.target}` });
        }}
        onEdgeMouseMove={(evt) => {
          setTooltip(t => ({ ...t, x: evt.clientX, y: evt.clientY }));
        }}
        onEdgeMouseLeave={() => {
          setHoveredEdge(null);
          setTooltip({ x: 0, y: 0, text: '' });
        }}
        attributionPosition="bottom-right"
      >
        <MiniMap nodeColor={node => node.style.backgroundColor} />
        <Controls />
        <Background variant="dots" gap={16} size={1} />
      </ReactFlow>

      {/* Tooltip */}
      {tooltip.text && (
        <div style={{
          position: 'absolute',
          left: tooltip.x + 10,
          top: tooltip.y + 10,
          backgroundColor: 'rgba(255,255,255,0.9)',
          padding: '4px 8px',
          border: '1px solid #ccc',
          borderRadius: 4,
          fontSize: 12,
          pointerEvents: 'none',
          zIndex: 1000
        }}>
          {tooltip.text}
        </div>
      )}

      {/* Legend */}
      <div style={{ position: 'absolute', top: 10, right: 10, backgroundColor: '#fff', padding: 12, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', fontSize: 13, zIndex: 10 }}>
        <div style={{ marginBottom: 6, fontWeight: 'bold' }}>Legend:</div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}><span style={{ width: 12, height: 12, background: '#dc3545', marginRight: 6 }} /> Vulnerable</div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}><span style={{ width: 12, height: 12, background: '#fd7e14', marginRight: 6 }} /> Impacted</div>
        <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ width: 12, height: 12, background: '#28a745', marginRight: 6 }} /> Clean</div>
      </div>
    </div>
  );
};

export default ConnectivityGraph;