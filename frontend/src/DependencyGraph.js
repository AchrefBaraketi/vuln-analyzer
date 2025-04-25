import React, { useMemo, useCallback, useState, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  ReactFlowProvider
} from 'reactflow';
import { toPng } from 'html-to-image';

import dagre from 'dagre';
import 'reactflow/dist/style.css';
import 'tippy.js/dist/tippy.css';
import Tippy from '@tippyjs/react';

const nodeWidth = 180;
const nodeHeight = 60;

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const pos = dagreGraph.node(node.id);
    node.position = {
      x: pos.x - nodeWidth / 2,
      y: pos.y - nodeHeight / 2
    };
  });

  return { nodes, edges };
};

const DependencyGraph = ({ vulnerabilities }) => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [expandedDeps, setExpandedDeps] = useState(new Set());

  const handleExport = useCallback(() => {
    if (!reactFlowWrapper.current) return;
    toPng(reactFlowWrapper.current).then((dataUrl) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'dependency-graph.png';
      a.click();
    });
  }, []);

  const initializeGraph = useCallback(() => {
    if (!vulnerabilities || !Array.isArray(vulnerabilities)) return;

    const nodes = [
      {
        id: 'root',
        data: { label: '📦 Project Root' },
        style: { background: '#007acc', color: '#fff', borderRadius: 10, padding: 10 },
        position: { x: 0, y: 0 }
      }
    ];
    const edges = [];

    vulnerabilities.forEach((dep, i) => {
      const depId = `dep-${i}`;
      const isVuln = dep.vulnerabilities?.length > 0;

      nodes.push({
        id: depId,
        data: { label: `🧱 ${dep.fileName}`, expandable: !!dep.vulnerabilities?.length },
        style: {
          background: isVuln ? '#e74c3c' : '#2ecc71',
          color: '#fff',
          borderRadius: 8,
          padding: 10,
          fontWeight: 'bold'
        }
      });

      edges.push({
        id: `e-root-${depId}`,
        source: 'root',
        target: depId,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed }
      });
    });

    const layout = getLayoutedElements(nodes, edges);
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [vulnerabilities]);

  const onNodeClick = useCallback((_, node) => {
    const { id, data } = node;

    if (id.startsWith('vul-')) {
      const cve = id.replace('vul-', '');
      window.open(`https://nvd.nist.gov/vuln/detail/${cve}`, '_blank');
      return;
    }

    if (data.expandable && !expandedDeps.has(id)) {
      const depIndex = nodes.findIndex((n) => n.id === id);
      const dep = vulnerabilities.find((d) => `dep-${vulnerabilities.indexOf(d)}` === id);
      if (!dep) return;

      const newNodes = [...nodes];
      const newEdges = [...edges];

      (dep.vulnerabilities || []).forEach((vul, j) => {
        const vulId = `vul-${vul.name}`;

        if (!nodes.find(n => n.id === vulId)) {
          newNodes.push({
            id: vulId,
            data: { label: `⚠️ ${vul.name}` },
            style: { background: '#f39c12', color: '#000', borderRadius: 8, padding: 10 }
          });

          newEdges.push({
            id: `e-${id}-${vulId}`,
            source: id,
            target: vulId,
            style: { stroke: '#f39c12' },
            markerEnd: { type: MarkerType.ArrowClosed }
          });
        }
      });

      const layout = getLayoutedElements(newNodes, newEdges);
      setNodes(layout.nodes);
      setEdges(layout.edges);

      const updated = new Set(expandedDeps);
      updated.add(id);
      setExpandedDeps(updated);
    }
  }, [nodes, edges, vulnerabilities, expandedDeps]);

  useMemo(() => {
    initializeGraph();
  }, [initializeGraph]);

  if (!nodes.length) return <p>No vulnerabilities to visualize.</p>;

  return (
    <ReactFlowProvider>
      <div style={{ height: 600, border: '1px solid #ccc', borderRadius: 8, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
          <button onClick={handleExport} style={{ padding: '6px 12px', borderRadius: 4 }}>📤 Export PNG</button>
        </div>
        <div ref={reactFlowWrapper} style={{ height: '100%' }}>
          <ReactFlow
            nodes={nodes.map(n => ({
              ...n,
              data: {
                ...n.data,
                label: (
                  <Tippy content={n.id.startsWith('vul-') ? 'Click to view CVE' : 'Click to expand'}>
                    <div>{n.data.label}</div>
                  </Tippy>
                )
              }
            }))}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            panOnScroll
            zoomOnScroll
          >
            <MiniMap />
            <Controls />
            <Background />
          </ReactFlow>
        </div>
      </div>
    </ReactFlowProvider>
  );
};

export default DependencyGraph;