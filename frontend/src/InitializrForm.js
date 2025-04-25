// frontend/src/InitializrForm.js
import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import path from 'path-browserify';
import AnalyzerMultiStep from './AnalyzerMultiStep';
import { AuthContext } from './AuthContext';
import UserListInline from './UserListInline';




const prettyLabels = {
  groupId: 'Group ID',
  artifactId: 'Artifact ID',
  name: 'Project Name',
  description: 'Project Description',
  packageName: 'Package Name',
  bootVersion: 'Spring Boot Version',
  javaVersion: 'Java Version',
  language: 'Language',
  packaging: 'Packaging'
};


const staticMetadata = {
  bootVersion: {
    values: [
      { id: '3.3.0', name: '3.3.0' },
      { id: '3.5.0', name: '3.5.0' }
    ]
  },
  language: {
    values: [
      { id: 'java', name: 'Java' },
      { id: 'kotlin', name: 'Kotlin' }
    ]
  },
  packaging: {
    values: [
      { id: 'jar', name: 'JAR' },
      { id: 'war', name: 'WAR' }
    ]
  },
  javaVersion: {
    values: [
      { id: '17', name: '17' },
      { id: '21', name: '21' }
    ]
  }
};

const formCardStyle = (darkMode) => ({
  backgroundColor: darkMode ? '#2c2c2c' : '#fff',
  padding: 20,
  borderRadius: 10,
  boxShadow: darkMode ? '0 0 15px rgba(255,255,255,0.1)' : '0 0 10px rgba(0,0,0,0.1)',
  transition: 'all 0.3s ease-in-out'
});

const labelStyle = (darkMode) => ({
  fontWeight: 'bold',
  display: 'block',
  marginBottom: 6,
  color: darkMode ? '#f5f5f5' : '#222'
});

const inputStyle = (darkMode) => ({
  width: '90%',
  padding: 10,
  fontSize: '15px',
  border: '1px solid #ccc',
  borderRadius: 6,
  backgroundColor: darkMode ? '#1c1c1c' : '#fff',
  color: darkMode ? '#f1f1f1' : '#000',
  marginBottom: 15,
  outline: 'none'
});


const radioWrapper = { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 15 };

const renderFormField = (label, value, darkMode, handleChange, name) => (
  <div style={formCardStyle(darkMode)} key={name}>
    <label style={labelStyle(darkMode)} htmlFor={name}>{label}</label>
    <input
      id={name}
      name={name}
      value={value}
      onChange={handleChange}
      style={inputStyle(darkMode)}
    />
  </div>
);


const renderRadioField = (name, options, selected, darkMode, handleChange) => (
  <div style={formCardStyle(darkMode)} key={name}>
    <label style={labelStyle(darkMode)}>{prettyLabels[name] || name}</label>
    <div style={radioWrapper}>
      {options.map(opt => (
        <label key={opt.id}>
          <input
            type="radio"
            name={name}
            value={opt.id}
            checked={selected === opt.id}
            onChange={handleChange}
          /> {opt.name}
        </label>
      ))}
    </div>
  </div>
);



const InitializrForm = () => {
  
  
  const { user } = useContext(AuthContext);
  const [form, setForm] = useState({
    groupId: 'com.example',
    artifactId: 'demo',
    name: 'demo',
    description: 'Demo project for Spring Boot',
    packageName: 'com.example.demo',
    dependencies: [],
    bootVersion: '3.3.0',
    language: 'java',
    packaging: 'jar',
    javaVersion: '17'
  });
  const [darkMode, setDarkMode] = useState(false);
  const [exploreFiles, setExploreFiles] = useState([]);
  const [fileTree, setFileTree] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [showExplorer, setShowExplorer] = useState(false);
  const [availableDependencies, setAvailableDependencies] = useState([]);
  const [search, setSearch] = useState('');
  const [activePage, setActivePage] = useState('initializer');
  const [projects, setProjects] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  const [renameTarget, setRenameTarget] = useState(null);
  const [newName, setNewName] = useState('');

  const [analyzerProjects, setAnalyzerProjects] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [availableVulnerableDeps, setAvailableVulnerableDeps] = useState([]);
  const [selectedVulnDep, setSelectedVulnDep] = useState('');

  const [showNotif, setShowNotif] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);


useEffect(() => {
      if (activePage === 'analyzer') {
        axios
      .get('/projects')
      .then(({ data }) => {
        // store [{ id, name }] instead of raw
        setAnalyzerProjects(data.map(p => ({ id: p._id, name: p.name })));
      })
          .catch(err => console.error('Failed to load analyzer projects:', err));
      }
    }, [activePage]);


  useEffect(() => {
    axios.get('/meta/dependencies').then(res => setAvailableDependencies(res.data));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const toggleDependency = (id) => {
    setForm(prev => ({
      ...prev,
      dependencies: prev.dependencies.includes(id)
        ? prev.dependencies.filter(dep => dep !== id)
        : [...prev.dependencies, id]
    }));
  };

  const analyzeProject = async (projectId) => {
    setSelectedProject(projectId);
    setAnalyzing(true);
  
    try {
      // 1) hit your /analyze/:name endpoint
      const { data: report } = await axios.post(`/analysis/projects/${projectId}/analyze`);
  
  
      // 2) build out your vulnerable‑deps list
      const vulnerableDeps = report.dependencies
        .filter(dep => dep.vulnerabilities?.length)
        .map(dep => ({
          fileName: dep.fileName,
          highestSeverity: dep.vulnerabilities[0].severity || 'LOW',
          cves: dep.vulnerabilities.map(v => v.name),
          suggestedVersion: dep.vulnerabilities[0].recommendation?.split('to ')[1] || 'latest'
        }));
  
      setAvailableVulnerableDeps(vulnerableDeps);
      setSelectedVulnDep(vulnerableDeps[0]?.fileName || '');
      setAnalysisResults(report);
  
      // 3) auto‑trigger impact analysis for the first vuln dep
      if (vulnerableDeps.length) {
        const firstDep = vulnerableDeps[0].fileName;
        const { data: impact } = await axios.post('/analysis/impact-analysis', {
          projectId,
          vulnerableDependency: firstDep
        });
        setAnalysisResults(prev => ({ ...prev, simulations: impact.simulations }));
      }
  
    } catch (err) {
      console.error('❌ Analysis error:', err);
      alert(`Analysis failed: ${err?.response?.data?.error || err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };
  


  const runImpactAnalysis = async (depName) => {
    try {
      const { data: impact } = await axios.post('/analysis/impact-analysis', {
        projectId: selectedProject,
        vulnerableDependency: depName
        // ✅ No need to send safeVersion — backend computes it dynamically
      });
      setAnalysisResults(prev => ({ ...prev, simulations: impact.simulations }));
    } catch (err) {
      alert('Impact analysis failed: ' + (err?.response?.data?.error || err.message));
    }
  };






  const generateZip = async () => {
    try {
      const response = await axios.post('/generate', form, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${form.name || 'spring-app'}.zip`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      alert('Error generating project: ' + (err?.response?.data?.message || err.message));
    }
  };

  const previewProject = async () => {
    try {
      const response = await axios.post('/generate', { ...form, preview: true });
      const files = response.data.files;
      setExploreFiles(files);
      setFileTree(buildTree(files));
      setSelectedFile(files[0]);
      setShowExplorer(true);
    } catch (err) {
      alert('Preview failed: ' + err.message);
    }
  };


  const buildTree = (files) => {
    const tree = {};
    files.forEach(({ path: filePath }) => {
      const parts = filePath.split('/');
      let current = tree;
      parts.forEach((part, idx) => {
        if (!current[part]) current[part] = idx === parts.length - 1 ? null : {};
        current = current[part] || {};
      });
    });
    return tree;
  };

  const renderTree = (node, basePath = '') => {
    return Object.entries(node).map(([name, child]) => {
      const fullPath = path.join(basePath, name);
      const file = exploreFiles.find(f => f.path === fullPath);
      return (
        <li key={fullPath}>
          {child === null ? (
            <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', paddingLeft: 10, color: darkMode ? '#fff' : '#000' }} onClick={() => setSelectedFile(file)}>📄 {name}</button>
          ) : (
            <details>
              <summary style={{ color: darkMode ? '#fff' : '#000' }}>📁 {name}</summary>
              <ul style={{ listStyle: 'none', paddingLeft: 20 }}>{renderTree(child, fullPath)}</ul>
            </details>
          )}
        </li>
      );
    });
  };

  // Before: axios.post('/projects/save', form);
  const saveProject = async () => {
    try {
      // generate ZIP…
      const response = await axios.post('/generate', form, { responseType: 'blob' });
      const zipBlob = new Blob([response.data], { type: 'application/zip' });
  
      // build FormData
      const data = new FormData();
      data.append('zip', zipBlob, `${form.name}.zip`);
      data.append('name', form.name);
      data.append('description', form.description);
      data.append('metadata', JSON.stringify(form));
  
      const token = localStorage.getItem('token');
      if (selectedProjectId) {
        // ─── EDIT existing ───────────────────────
        await axios.put(
          `/projects/${selectedProjectId}`,
          data,
          { headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${token}`
          }}
        );
        alert('✅ Project updated!');
      } else {
        // ─── CREATE new ───────────────────────
        await axios.post(
          '/projects',
          data,
          { headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${token}`
          }}
        );
        alert('✅ Project saved to MongoDB!');
      }
  
      // reload your projects list
      loadProjects();
      setActivePage('projects');
    } catch (err) {
      console.error(err);
      alert('❌ Save failed: ' + (err.response?.data?.error || err.message));
    }
  };
  

const loadProjects = async () => {
  const { data } = await axios.get('/projects');
  // data = [ { _id, name, description, createdAt }, … ]
  setProjects(data);
};


const handleRename = async () => {
  if (!newName.trim()) {
    return alert('Please enter a new project name');
  }
  try {
    await axios.post('/projects/rename', {
      from: renameTarget,
      to:   newName.trim()
    });
    alert(`Renamed "${renameTarget}" → "${newName}"`);
    setRenameTarget(null);
    setNewName('');
    loadProjects();
  } catch (err) {
    console.error('❌ Rename failed:', err);
    alert(`Rename failed: ${err.response?.data?.error || err.message}`);
  }
};


  const downloadZip = async (id) => {
    const res = await axios.get(`/projects/${id}/zip`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.zip`;
    a.click();
  };

  // in your component
const confirmAndDelete = async (id) => {
 // if (!window.confirm('Delete project permanently?')) return;
  try {
    await axios.delete(`/projects/${id}`);
    loadProjects();
    setConfirmDelete(null);
  } catch (err) {
    console.error('Delete failed:', err);
    alert(`Delete failed: ${err.response?.data?.error||err.message}`);
  }
};


  const loadProject = async (id) => {
    try {
      const token = localStorage.getItem('token');
    const { data } = await axios.get(
      `/projects/${id}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
      setForm({
        groupId:     data.metadata.groupId,
        artifactId:  data.metadata.artifactId,
        name:        data.name,          // override from saved
        description: data.description,   // override from saved
        packageName: data.metadata.packageName,
        dependencies:data.metadata.dependencies || [],
        bootVersion: data.metadata.bootVersion,
        language:    data.metadata.language,
        packaging:   data.metadata.packaging,
        javaVersion: data.metadata.javaVersion
      });
      setFileTree(data.fileTree || {});
      setSelectedProjectId(id);
      setActivePage('initializer');
    } catch (err) {
      console.error('loadProject ▶', err.response?.status, err.response?.data);
      alert(`Failed to load project: ${err.response?.status} ${err.response?.data?.error || err.message}`);
    
    }
  };


  useEffect(() => {
    if (activePage === 'projects') loadProjects();
  }, [activePage]);

  const themeStyles = {
    backgroundColor: darkMode ? '#1c1c1c' : '#f9f9f9',
    color: darkMode ? '#fff' : '#000'
  };

  const filteredDependencies = availableDependencies.filter(dep => dep.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif', ...themeStyles }}>
      <aside style={{
        zIndex: 2000,
        position: 'fixed',
        height: '95%',
        width: '220px',
        padding: '20px',
        backgroundColor: darkMode ? '#1e1e1e' : '#f1f1f1',
        borderRight: darkMode ? '1px solid #333' : '1px solid #ccc',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'all 0.3s ease'
      }}>
        <div>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <img
              src={darkMode ? "/logo-dark.png" : "/logo-dark.png"}
              alt="App Logo"
              style={{
                width: 70,
                height: 'auto',
                borderRadius: 12,
                boxShadow: darkMode
                  ? '0 0 8px rgba(255,255,255,0.2)'
                  : '0 0 8px rgba(0,0,0,0.1)'
              }}
            />
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {user?.role === 'admin' && (
              <button
                onClick={() => setActivePage('users')}
                style={{
                  padding: '10px 14px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  backgroundColor: activePage === 'users'
                    ? (darkMode ? '#007acc' : '#cce5ff')
                    : 'transparent',
                  color: activePage === 'users'
                    ? (darkMode ? '#fff' : '#003366')
                    : (darkMode ? '#ccc' : '#333'),
                  transition: 'background-color 0.2s ease'
                }}
              >
                👥 Users
              </button>
            )}

            {[
              { key: 'initializer', label: '🚀 Initializer' },
              { key: 'projects', label: '📂 Projects' },
              { key: 'analyzer', label: '🔍 Analyzer' }
            ].map(item => (
              <button
                key={item.key}
                onClick={() => setActivePage(item.key)}
                style={{
                  padding: '10px 14px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  backgroundColor: activePage === item.key
                    ? (darkMode ? '#007acc' : '#cce5ff')
                    : 'transparent',
                  color: activePage === item.key
                    ? (darkMode ? '#fff' : '#003366')
                    : (darkMode ? '#ccc' : '#333'),
                  transition: 'background-color 0.2s ease'
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div style={{ marginTop: 30 }}>
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{
              padding: '10px 14px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              cursor: 'pointer',
              backgroundColor: darkMode ? '#444' : '#ddd',
              color: darkMode ? '#fff' : '#000',
              transition: 'background-color 0.3s ease'
            }}
          >
            {darkMode ? '🌞 Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>
      </aside>


      <main style={{ width: '85%', padding: '30px', position: 'relative' }}>

        <header style={{
          position: 'fixed',
          top: 0,
          left: '260px', // same as sidebar width
          right: 0,
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 30px',
          backgroundColor: darkMode ? '#1e1e1e' : '#f1f1f1',
          borderBottom: '1px solid rgba(0,0,0,0.1)',
          zIndex: 1000,
          boxShadow: darkMode ? '0 2px 4px rgba(0,0,0,0.6)' : '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          {/* Left side: Page title or breadcrumb */}
          <div style={{ fontSize: 18, fontWeight: 'bold', color: darkMode ? '#eee' : '#333' }}>
            {activePage === 'users' && 'Users List'}
            {activePage === 'initializer' && 'Project Initializr'}
            {activePage === 'projects' && 'My Projects'}
            {activePage === 'analyzer' && 'Analyzer Dashboard'}
          </div>

          {/* Right side: Icons + extra tools */}
          <div style={{
            position: 'absolute',
            top: 10,
            right: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            zIndex: 2000
          }}>
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setShowNotif(!showNotif)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: darkMode ? '#333' : '#eee',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                }}
              >🔔</div>
              {showNotif && (
                <div style={{ position: 'absolute', top: 42, right: 0, background: darkMode ? '#1e1e1e' : '#fff', color: darkMode ? '#fff' : '#000', border: '1px solid #ccc', borderRadius: 10, padding: 12, width: 260, boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                  <strong>Notifications</strong>
                  <ul style={{
                    marginTop: 10,
                    listStyle: 'none',
                    padding: 0,
                    fontSize: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}>
                    <li style={{
                      display: 'flex',
                      alignItems: 'start',
                      gap: 10,
                      background: darkMode ? '#292929' : '#f5f5f5',
                      padding: '10px',
                      borderRadius: 8
                    }}>
                      <span style={{ fontSize: 20 }}>📌</span>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>New Vulnerability</div>
                        <div style={{ fontSize: 12, color: darkMode ? '#bbb' : '#666' }}>
                          A vulnerable package has been detected in your project scan.
                        </div>
                      </div>
                    </li>

                    <li style={{
                      display: 'flex',
                      alignItems: 'start',
                      gap: 10,
                      background: darkMode ? '#292929' : '#f5f5f5',
                      padding: '10px',
                      borderRadius: 8
                    }}>
                      <span style={{ fontSize: 20 }}>⚠️</span>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>Scan Complete</div>
                        <div style={{ fontSize: 12, color: darkMode ? '#bbb' : '#666' }}>
                          Your dependency scan has finished successfully.
                        </div>
                      </div>
                    </li>

                    <li style={{
                      display: 'flex',
                      alignItems: 'start',
                      gap: 10,
                      background: darkMode ? '#292929' : '#f5f5f5',
                      padding: '10px',
                      borderRadius: 8
                    }}>
                      <span style={{ fontSize: 20 }}>✅</span>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>Backup Complete</div>
                        <div style={{ fontSize: 12, color: darkMode ? '#bbb' : '#666' }}>
                          Your project was successfully backed up.
                        </div>
                      </div>
                    </li>
                  </ul>

                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setShowUserMenu(!showUserMenu)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: darkMode ? '#333' : '#eee',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                }}
              >👤</div>
              {showUserMenu && (
                <div style={{ position: 'absolute', top: 42, right: 0, background: darkMode ? '#1e1e1e' : '#fff', color: darkMode ? '#fff' : '#000', border: '1px solid #ccc', borderRadius: 10, padding: 12, width: 180, boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 14 }}>


                    <li
                      style={{ padding: '10px 0', cursor: 'pointer' }}
                      onClick={() => {
                        localStorage.removeItem('user');
                        window.location.href = '/login';
                      }}
                    >
                      🚪 Logout
                    </li>
                  </ul>

                </div>
              )}
            </div>
          </div>
        </header>



        <div style={{ marginLeft: '220px', width: '90%', padding: '30px' }}>


          {activePage === 'initializer' && (
            <>
              <h2 style={{ marginBottom: 20 }}>🚀 Spring Boot Project Initializr</h2>



              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 24
              }}>


                {['groupId', 'artifactId', 'name', 'description', 'packageName'].map(key =>
                  renderFormField(prettyLabels[key], form[key], darkMode, handleChange, key)
                )}


                {Object.entries(staticMetadata).map(([key, { values }]) =>
                  renderRadioField(key, values, form[key], darkMode, handleChange)
                )}
              </div>

              <div style={{ marginTop: 30, ...formCardStyle(darkMode) }}>
                <h3 style={{ marginBottom: 10 }}>📦 Dependencies</h3>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search dependencies..."
                  style={{ ...inputStyle(darkMode), marginBottom: 20 }}
                />
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {filteredDependencies.map(dep => (
                    <label key={dep.id} style={{ display: 'block', marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        checked={form.dependencies.includes(dep.id)}
                        onChange={() => toggleDependency(dep.id)}
                        style={{ marginRight: 8 }}
                      />
                      {dep.name}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 30, display: 'flex', gap: 12 }}>
                <button
                  onClick={generateZip}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: '#28a745',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '16px',
                    cursor: 'pointer',
                    transition: 'background-color 0.3s ease'
                  }}
                  onMouseOver={(e) => (e.target.style.backgroundColor = '#218838')}
                  onMouseOut={(e) => (e.target.style.backgroundColor = '#28a745')}
                >
                  🚀 Generate
                </button>

                <button
                  onClick={previewProject}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: '#17a2b8',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '16px',
                    cursor: 'pointer',
                    transition: 'background-color 0.3s ease'
                  }}
                  onMouseOver={(e) => (e.target.style.backgroundColor = '#138496')}
                  onMouseOut={(e) => (e.target.style.backgroundColor = '#17a2b8')}
                >
                  🔍 Explore
                </button>

                <button
                  onClick={saveProject}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '16px',
                    cursor: 'pointer',
                    transition: 'background-color 0.3s ease'
                  }}
                  onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
                  onMouseOut={(e) => (e.target.style.backgroundColor = '#007bff')}
                >
                  {selectedProjectId ? '🔄 Update' : '💾 Save'}
                </button>
              </div>
            </>
          )}


          {activePage === 'projects' && (
            <div>
              <h2 style={{ marginBottom: 20 }}>📁 Saved Projects</h2>
              <ul style={{
                listStyle: 'none',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}>
                {projects.map(p => (
                  <li
                    key={p.name}
                    style={{
                      padding: 16,
                      borderRadius: 10,
                      backgroundColor: darkMode ? '#2b2b2b' : '#f5f5f5',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: darkMode
                        ? '0 2px 8px rgba(0,0,0,0.4)'
                        : '0 2px 6px rgba(0,0,0,0.1)',
                      transition: 'background-color 0.3s ease'
                    }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 500 }}>{p.name}</span>
                    <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        onClick={() => downloadZip(p._id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#17a2b8',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer'
                        }}
                      >
                        ⬇️ Download
                      </button>
                      <button
                        onClick={() => loadProject(p._id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#17a2b8',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer'
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => setRenameTarget(p.name)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#ffc107',
                          color: '#000',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer'
                        }}
                      >
                        ✎ Rename
                      </button>
                      <button
                        onClick={() => setConfirmDelete(p._id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#dc3545',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {confirmDelete && (
                <div style={{
                  position: 'fixed',
                  top: '35%',
                  left: '35%',
                  width: '30%',
                  backgroundColor: darkMode ? '#1e1e1e' : '#fff',
                  color: darkMode ? '#fff' : '#000',
                  border: '1px solid #aaa',
                  padding: 20,
                  zIndex: 2000,
                  borderRadius: 10,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                }}>
                  <p>⚠️ Confirm delete project <strong>{confirmDelete}</strong>?</p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button
                      onClick={() => confirmAndDelete(confirmDelete)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#dc3545',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer'
                      }}
                    >
                      ✅ Yes
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#6c757d',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer'
                      }}
                    >
                      ❌ No
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}


          {activePage === 'analyzer' && (
            <div>
              <h2 style={{ marginBottom: 20 }}>🔎 Dependency Analyzer</h2>

              <AnalyzerMultiStep
                projects={analyzerProjects}
                analysisResults={analysisResults}
                analyzing={analyzing}
                selectedProject={selectedProject}
                onAnalyze={analyzeProject}
                onImpact={runImpactAnalysis}
                darkMode={darkMode}
              />
            </div>
          )}


          {activePage === 'users' && (
            <UserListInline darkMode={darkMode} />
          )}



        </div>

        {showExplorer && (
          <div style={{ position: 'absolute', top: '6%', left: '21%', width: '90%', height: '93%', backgroundColor: darkMode ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out', transform: showExplorer ? 'scale(1)' : 'scale(0.95)', opacity: showExplorer ? 1 : 0, backdropFilter: 'blur(5px)' }}>
            <div style={{ backgroundColor: darkMode ? '#2c2c2c' : '#fff', color: darkMode ? '#fff' : '#000', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 10, position: 'relative' }}>
              <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Explorer</h3>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={generateZip}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#28a745',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'background-color 0.3s ease'
                    }}
                    onMouseOver={(e) => (e.target.style.backgroundColor = '#218838')}
                    onMouseOut={(e) => (e.target.style.backgroundColor = '#28a745')}
                  >
                    ⬇️ Download
                  </button>

                  <button
                    onClick={() => setShowExplorer(false)}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#dc3545',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'background-color 0.3s ease'
                    }}
                    onMouseOver={(e) => (e.target.style.backgroundColor = '#c82333')}
                    onMouseOut={(e) => (e.target.style.backgroundColor = '#dc3545')}
                  >
                    ❌ Close
                  </button>
                </div>

              </div>
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ width: '30%', overflowY: 'auto', borderRight: '1px solid #ddd', paddingRight: 10 }}>
                  <ul style={{ listStyle: 'none', padding: 0 }}>{renderTree(fileTree)}</ul>
                </div>
                <div style={{ width: '70%', overflowY: 'auto', paddingLeft: 10 }}>
                  {selectedFile && (
                    <>
                      <h4>{selectedFile.path}</h4>
                      <SyntaxHighlighter language="java" style={darkMode ? oneDark : oneLight} wrapLines customStyle={{ fontSize: '13px', background: 'transparent' }}>
                        {selectedFile.content}
                      </SyntaxHighlighter>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {renameTarget && (
          <div style={{
            position: 'fixed',
            top: '30%',
            left: '35%',
            width: '30%',
            background: darkMode ? '#1e1e1e' : '#fff',
            color: darkMode ? '#fff' : '#000',
            border: '1px solid #444',
            padding: 24,
            zIndex: 3000,
            borderRadius: 10,
            boxShadow: darkMode
              ? '0 4px 20px rgba(255,255,255,0.1)'
              : '0 4px 20px rgba(0,0,0,0.1)',
            transition: 'all 0.3s ease'
          }}>
            <h3 style={{ marginBottom: 10 }}>🔤 Rename Project</h3>
            <p style={{ marginBottom: 16 }}>
              Rename <strong style={{ color: '#28a745' }}>{renameTarget}</strong> to:
            </p>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New project name"
              style={{
                width: '95%',
                padding: '10px',
                fontSize: 16,
                backgroundColor: darkMode ? '#2c2c2c' : '#f9f9f9',
                border: '1px solid #999',
                borderRadius: 6,
                color: darkMode ? '#fff' : '#000',
                marginBottom: 20
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                onClick={handleRename}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                💾 Rename
              </button>
              <button
                onClick={() => setRenameTarget(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                ❌ Cancel
              </button>
            </div>
          </div>
        )}




      </main>
    </div>
  );
};

export default InitializrForm;
