import React, { useState, useEffect } from 'react';
import SimulationGraph from './SimulationGraph';
import ConnectivityGraph from './ConnectivityGraph';
import DependencyGraph from './DependencyGraph';
import { saveAs } from 'file-saver';

const AnalyzerMultiStep = ({ projects, analysisResults, analyzing, selectedProject, onAnalyze, onImpact, darkMode }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedVulnDep, setSelectedVulnDep] = useState('');
  const [activeSimIndex, setActiveSimIndex] = useState(0);

  const selectedProjectName = projects.find(p => p.id === selectedProject)?.name || '';

  useEffect(() => {
    if (analysisResults?.simulations?.length > 0) {
      setActiveSimIndex(0);
    }
  }, [analysisResults?.simulations]);

  const cardStyle = {
    backgroundColor: darkMode ? '#2b2b2b' : '#f9f9f9',
    padding: 20,
    borderRadius: 10,
    boxShadow: darkMode ? '0 2px 10px rgba(0,0,0,0.5)' : '0 2px 10px rgba(0,0,0,0.1)',
    marginBottom: 24,
    transition: 'all 0.3s ease-in-out'
  };

  const handleAnalyze = async (projectId) => {
    setLoading(true);
    await onAnalyze(projectId);
    setLoading(false);
    setStep(2);
  };

  const [expandedRows, setExpandedRows] = useState({});

  const toggleDescription = (idx) => {
    setExpandedRows(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const exportToCSV = () => {
    const header = ['Dependency', 'Severity', 'CVEs', 'Description'];
    const rows = analysisResults.dependencies
      .filter(dep => dep.vulnerabilities?.length)
      .map(dep => {
        const severity = dep.vulnerabilities[0]?.severity?.toUpperCase() || 'UNKNOWN';
        const cves = (dep.vulnerabilities || []).map(v => v.name).join('; ');
        const desc = dep.vulnerabilities[0]?.description?.replace(/\n/g, ' ') || 'N/A';
        return [dep.fileName, severity, cves, desc];
      });

    const csvContent = [header, ...rows]
      .map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, 'vulnerable_dependencies.csv');
  };

  return (
    <div>
      {/* Stepper */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30 }}>
        {[1, 2, 3].map(s => (
          <div key={s} onClick={() => {
            if (s === 1 || (s === 2 && analysisResults) || (s === 3 && analysisResults?.simulations)) {
              setStep(s);
            }
          }}
            style={{
              flex: 1,
              padding: 12,
              textAlign: 'center',
              cursor: (s === 1 || (s === 2 && analysisResults) || (s === 3 && analysisResults?.simulations)) ? 'pointer' : 'not-allowed',
              background: step === s ? '#007acc' : darkMode ? '#444' : '#ddd',
              color: step === s ? '#fff' : darkMode ? '#ccc' : '#000',
              borderRadius: 8,
              margin: '0 6px',
              fontWeight: 'bold',
              opacity: (s === 1 || (s === 2 && analysisResults) || (s === 3 && analysisResults?.simulations)) ? 1 : 0.5
            }}>
            {s === 1 && '🗂️ Select Project'}
            {s === 2 && '📊 Analyze Vulnerabilities'}
            {s === 3 && '🧪 Impact Simulation'}
          </div>
        ))}
      </div>

      {/* Loader Popup */}
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
          <div style={{ backgroundColor: darkMode ? '#1e1e1e' : '#fff', color: darkMode ? '#fff' : '#000', padding: 30, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontSize: 16, fontWeight: 'bold' }}>
            ⏳ Analyzing project...
          </div>
        </div>
      )}

      {/* Step 1: Project List */}
      {step === 1 && (
        <div style={cardStyle}>
          <h3>🔍 Choose a project to analyze:</h3>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {projects.map(p => (
              <li key={p.id} style={{ padding: 16, borderRadius: 10, backgroundColor: darkMode ? '#2e2e2e' : '#f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{p.name}</span>
                <button onClick={() => handleAnalyze(p.id)} style={{ padding: '6px 12px', backgroundColor: '#17a2b8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>🔍 Analyze</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Step 2: Analysis Report */}
      {step === 2 && analysisResults && (
        <div style={cardStyle}>
          <h3>📊 Vulnerabilities in <code>{selectedProjectName}</code></h3>
          <DependencyGraph vulnerabilities={analysisResults.dependencies} />

          <h4 style={{ marginTop: 30, marginBottom: 10 }}>📋 Vulnerable Dependencies</h4>
          <button onClick={exportToCSV} style={{ marginBottom: 10, padding: '8px 14px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>📤 Export to CSV</button>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 20 }}>
            <thead><tr style={{ backgroundColor: darkMode ? '#444' : '#ccc', color: darkMode ? '#fff' : '#000' }}>
              <th style={{ padding: '12px 10px', border: '1px solid #999' }}>Dependency</th>
              <th style={{ padding: '12px 10px', border: '1px solid #999' }}>Severity</th>
              <th style={{ padding: '12px 10px', border: '1px solid #999' }}>CVEs</th>
              <th style={{ padding: '12px 10px', border: '1px solid #999' }}>Description</th>
            </tr></thead>
            <tbody>
              {analysisResults.dependencies.filter(dep => dep.vulnerabilities?.length).map((dep, idx) => {
                const severity = dep.vulnerabilities[0]?.severity?.toUpperCase() || 'UNKNOWN';
                const severityColors = { CRITICAL: '#dc3545', HIGH: '#e67e22', MEDIUM: '#f1c40f', LOW: '#28a745', UNKNOWN: '#6c757d' };
                const desc = dep.vulnerabilities[0]?.description || 'N/A';
                const isExpanded = expandedRows[idx];
                return (
                  <tr key={idx} style={{ backgroundColor: darkMode ? (idx%2 ? '#2c2c2c':'#252525') : (idx%2 ? '#f9f9f9':'#fff') }}>
                    <td style={{ padding: '10px', border: '1px solid #999' }}>{dep.fileName}</td>
                    <td style={{ textAlign:'center',fontWeight:'bold',color:'#fff',backgroundColor:severityColors[severity]||'#6c757d',borderRadius:6,padding:'6px 10px',border:'1px solid #999' }}>{severity}</td>
                    <td style={{ padding:'10px',border:'1px solid #999' }}>{(dep.vulnerabilities||[]).map(v=>v.name).join(', ')}</td>
                    <td style={{ padding:'10px',fontSize:13,color:darkMode?'#ccc':'#555',border:'1px solid #999' }}>
                      {isExpanded?desc:`${desc.slice(0,120)}...`}
                      {desc.length>120 && <button onClick={()=>toggleDescription(idx)} style={{marginLeft:8,background:'none',border:'none',color:'#007bff',cursor:'pointer'}}>{isExpanded?'Show less':'Show more'}</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h4 style={{ marginTop: 20 }}>🔗 Connectivity Graph</h4>
            <ConnectivityGraph dependencies={analysisResults.dependencies} graph={analysisResults.graph}/>

          <button onClick={()=>setStep(3)} style={{ marginTop:20,padding:'10px 16px',backgroundColor:'#28a745',color:'#fff',border:'none',borderRadius:6,cursor:'pointer' }}>➡️ View Impact Simulations</button>
        </div>
      )}

      {/* Step 3: Simulation */}
      {step === 3 && (
        <div style={cardStyle}>
          <h3>🧠 Simulation Impact Analysis</h3>
          <div style={{marginBottom:16}}>
            <label><strong>Select Vulnerable Dependency:</strong>
              <select value={selectedVulnDep} onChange={e=>{ const dep=e.target.value; setSelectedVulnDep(dep); onImpact(dep); }} style={{marginLeft:12,padding:8,borderRadius:6,border:'1px solid #ccc',backgroundColor:darkMode?'#222':'#fff',color:darkMode?'#fff':'#000'}}>
                <option value="">-- Choose one --</option>
                {analysisResults?.dependencies?.filter(d=>d.vulnerabilities?.length).map(dep=><option key={dep.fileName} value={dep.fileName}>{dep.fileName}</option>)}
              </select>
            </label>
          </div>
          {selectedVulnDep && analysisResults?.simulations && <SimulationGraph simulations={analysisResults.simulations} darkMode={darkMode} />}
          <button onClick={()=>setStep(2)} style={{marginTop:20,padding:'10px 16px',backgroundColor:'#6c757d',color:'#fff',border:'none',borderRadius:6,cursor:'pointer'}}>⬅️ Back to Analysis</button>
        </div>
      )}
    </div>
  );
};

export default AnalyzerMultiStep;