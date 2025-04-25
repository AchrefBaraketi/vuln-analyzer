// server.js

/**
 * Entry point for the backend API
 * - Loads environment variables
 * - Connects to MongoDB
 * - Mounts feature-specific routes
 * - Proxies Spring Initializr endpoints
 */

require('dotenv').config();                // Load .env vars (MONGO_URI, JWT_SECRET, etc.)
const express      = require('express');
const cors         = require('cors');
const bodyParser   = require('body-parser');
const connectDB    = require('./config/db'); // sets up mongoose connection
const axios        = require('axios');
const unzipper     = require('unzipper');
const fs           = require('fs');
const path         = require('path');

// Route modules
const authRoute     = require('./routes/authRoutes');
const usersRoute    = require('./routes/userRoutes');
const rolesRoute    = require('./routes/RoleRoutes');
const projectsRoute = require('./routes/projectRoutes');
const analysisRoute = require('./routes/analysisRoutes');

// Initialize DB
connectDB();

const app = express();

// Global middleware
app.use(cors());
app.use(bodyParser.json());

// Mount modular routes
app.use('/auth', authRoute);          // register + login
app.use('/users', usersRoute);        // admin user management
app.use('/roles', rolesRoute);
app.use('/projects', projectsRoute);  // project CRUD + upload/download
app.use('/analysis', analysisRoute);  // dependency analysis & impact

/**
 * Helper: convert a Readable stream into a Buffer
 */
function streamToBuffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', chunk => chunks.push(chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

/**
 * POST /generate
 * Proxy to Spring Initializr for on-the-fly project generation
 */
app.post('/generate', async (req, res) => {
  try {
    const {
      groupId, artifactId, name, description,
      packageName, bootVersion, language,
      packaging, javaVersion, dependencies, preview
    } = req.body;

    // Build query params, omitting null/empty
    const clean = obj => Object.fromEntries(
      Object.entries(obj).filter(([_, v]) => v != null && v !== '')
    );
    const params = clean({
      type: 'maven-project', language, bootVersion,
      baseDir: name, groupId, artifactId,
      name, description, packageName,
      packaging, javaVersion
    });
    const query = new URLSearchParams(params);
    (dependencies || []).forEach(dep => query.append('dependencies', dep));

    const url = `https://start.spring.io/starter.zip?${query}`;
    console.log('➡️  Fetching Spring project:', url);

    const response = await axios.get(url, { responseType: 'stream' });

    if (preview) {
      // Return file list + contents instead of ZIP
      const zipBuffer = await streamToBuffer(response.data);
      const dir = await unzipper.Open.buffer(zipBuffer);
      const files = [];
      for (const entry of dir.files) {
        if (!entry.path.endsWith('/')) {
          const content = await entry.buffer();
          files.push({ path: entry.path, content: content.toString('utf8') });
        }
      }
      return res.json({ success: true, files });
    }

    // Stream ZIP directly to client
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${name || 'spring-app'}.zip`);
    response.data.pipe(res);
  } catch (err) {
    console.error('❌ /generate error:', err.message || err);
    const status = err.response?.status || 500;
    const msg    = err.response?.statusText || err.message;
    res.status(status).json({ error: 'Failed to generate project', message: msg });
  }
});

/**
 * GET /meta/dependencies
 * Fetch and simplify Spring Initializr dependency metadata
 */
app.get('/meta/dependencies', async (req, res) => {
  try {
    const { data } = await axios.get('https://start.spring.io/metadata/client');
    const simplified = data.dependencies.values.flatMap(group =>
      group.values.map(dep => ({ id: dep.id, name: `${dep.name.toLowerCase()} (${dep.id})` }))
    );
    res.json(simplified);
  } catch (err) {
    console.error('❌ /meta/dependencies error:', err);
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
