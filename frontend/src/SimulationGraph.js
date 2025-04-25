import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';

const SimulationGraph = ({ simulations = [], darkMode }) => {
  const [activeSimId, setActiveSimId] = useState(null);
  const [tooltip, setTooltip] = useState({ x: 0, y: 0, text: '' });

  // Suppress ResizeObserver loop errors
  useEffect(() => {
    const handler = (e) => {
      if (e.message && e.message.includes('ResizeObserver loop completed')) {
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);

  // Ensure a simulation is selected
  useEffect(() => {
    if (simulations.length) {
      const exists = simulations.some(s => s.id === activeSimId);
      setActiveSimId(exists ? activeSimId : simulations[0].id);
    }
  }, [simulations]);

  const activeSim = useMemo(() => simulations.find(s => s.id === activeSimId), [simulations, activeSimId]);

  // split artifact/version
  const splitName = name => {
    const withoutExt = name.replace(/\.jar$/, '');
    const parts = withoutExt.split('-');
    const version = parts.pop();
    const artifact = parts.join('-');
    return { artifact, version };
  };

  // memoize nodes & edges to prevent re-render on tooltip updates
  const { nodes, edges } = useMemo(() => {
    const nodes = [];
    const edges = [];
    if (activeSim?.graph) {
      activeSim.graph.forEach((edgeItem, idx) => {
        const { artifact, version: fromVer } = splitName(edgeItem.from);
        const fromId = `node-${edgeItem.from}`;
        if (idx === 0) {
          nodes.push({
            id: fromId,
            data: { label: `${artifact}\n${fromVer}` },
            position: { x: 100, y: 200 },
            style: {
              background: darkMode ? '#b71c1c' : '#ffcccc',
              color: '#000', padding: 8, borderRadius: 8,
              border: '2px solid ' + (darkMode ? '#f44336' : '#e57373'),
              textAlign: 'center', whiteSpace: 'pre-wrap', width: 120
            }
          });
        }
        const toVer = edgeItem.to;
        const toId = `node-${artifact}-${toVer}`;
        nodes.push({
          id: toId,
          data: { label: `${artifact}\n${toVer}` },
          position: { x: 100 + (idx + 1) * 200, y: 200 },
          style: {
            background: darkMode ? '#1b5e20' : '#c8e6c9',
            color: '#000', padding: 8, borderRadius: 8,
            border: '2px solid ' + (darkMode ? '#4caf50' : '#81c784'),
            textAlign: 'center', whiteSpace: 'pre-wrap', width: 120
          }
        });
        edges.push({
          id: `edge-${idx}`,
          source: fromId,
          target: toId,
          type: 'smoothstep', animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
          style: { stroke: darkMode ? '#90caf9' : '#1976d2', strokeWidth: 2 }
        });
      });
    }
    return { nodes, edges };
  }, [activeSim, darkMode]);

  const onInit = useCallback(instance => instance.fitView({ padding: 0.1 }), []);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={{ marginBottom: 16 }}>
        <select value={activeSimId || ''} onChange={e => setActiveSimId(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }}>
          {simulations.map(sim => (
            <option key={sim.id} value={sim.id}>{`Upgrade to ${sim.recommendedVersion}`}</option>
          ))}
        </select>
      </div>
      <div style={{ width: '100%', height: 400, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onInit={onInit}
          onNodeMouseEnter={(evt, node) => setTooltip({ x: evt.clientX, y: evt.clientY, text: node.data.label })}
          onNodeMouseMove={evt => setTooltip(t => ({ ...t, x: evt.clientX, y: evt.clientY }))}
          onNodeMouseLeave={() => setTooltip({ x: 0, y: 0, text: '' })}
          attributionPosition="bottom-right"
        >
          <MiniMap nodeColor={n => n.style.background} />
          <Controls />
          <Background variant="lines" gap={16} size={1} />
        </ReactFlow>
        {tooltip.text && (
          <div style={{ position: 'absolute', left: tooltip.x + 10, top: tooltip.y + 10, backgroundColor: 'rgba(255,255,255,0.9)', padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12, pointerEvents: 'none', zIndex: 1000 }}>
            {tooltip.text}
          </div>
        )}
      </div>
      {activeSim && (
        <div style={{ marginTop: 16, padding: 12, background: darkMode ? '#212121' : '#f5f5f5', borderRadius: 6 }}>
          <p><strong>Description:</strong> {activeSim.description}</p>
          <p><strong>Security Score:</strong> {activeSim.severityScore.toFixed(1)}</p>
          <p><strong>Recommended Version:</strong> {activeSim.recommendedVersion}</p>
        </div>
      )}
    </div>
  );
};

export default SimulationGraph;
