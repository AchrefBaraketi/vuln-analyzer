// routes/analysisRoute.js

require('dotenv').config(); // load JWT_SECRET, MAVEN_PATH, DEPENDENCY_CHECK_PATH
const express    = require('express');
const mongoose   = require('mongoose');
const fs         = require('fs');
const os         = require('os');
const path       = require('path');
const unzipper   = require('unzipper');
const axios      = require('axios');
const jwt        = require('jsonwebtoken');
const { exec }   = require('child_process');

const Project  = require('../models/Project');
const Analysis = require('../models/Analysis');

const router   = express.Router();

// Ensure required env vars
const JWT_SECRET = process.env.JWT_SECRET;
const MAVEN_PATH = process.env.MAVEN_PATH || 'mvn';
const OWASP_PATH = process.env.DEPENDENCY_CHECK_PATH;
if (!JWT_SECRET) {
  console.error('❌ Missing JWT_SECRET in .env');
  process.exit(1);
}
if (!OWASP_PATH) {
  console.error('❌ Missing DEPENDENCY_CHECK_PATH in .env');
  process.exit(1);
}

/**
 * Middleware: require a valid JWT
 */
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const [, token] = auth.split(' ');

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Promisified exec
 */
function execPromise(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, { ...opts, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const error = new Error(`Command "${cmd}" failed: ${stderr}`);
        error.stdout = stdout;
        error.stderr = stderr;
        return reject(error);
      }
      resolve(stdout);
    });
  });
}

/**
 * Build reverse dependency links from OWASP report
 */
function simulateDependencyRelations(reportJson) {
  const raw = reportJson.dependencies || [];
  const map = {};

  raw.forEach(d => {
    map[d.fileName] = {
      fileName:       d.fileName,
      dependencies:   d.dependencies || [],
      vulnerabilities: d.vulnerabilities || [],
      usedIn:         [],
      dependencyType: 'direct',
      transitiveDepth: 1
    };
  });

  Object.values(map).forEach(node => {
    node.dependencies.forEach(dep => {
      if (map[dep]) {
        map[dep].usedIn.push(node.fileName);
      }
    });
  });

  return Object.values(map);
}

/**
 * Parse explicit upgrade suggestions from vulnerability description
 */
function extractRecommendedVersions(desc) {
  const m = desc.match(/recommend(?:ed)? to upgrade to version\s+(.+?)(?:, which|\.|$)/i);
  if (!m) return [];
  return m[1]
    .replace(/\s+or\s+/gi, ', ')
    .split(/\s*,\s*/)
    .map(v => v.trim());
}

/**
 * Fallback semver bump if no explicit recommendation found
 */
function extractSafeVersionFromDescription(desc) {
  const matches = desc.match(/\d+\.\d+\.\d+/g) || [];
  if (!matches.length) return 'latest';

  const semvers = matches
    .map(v => v.split('.').map(n => Number(n)))
    .sort((a, b) => {
      for (let i = 0; i < 3; i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
      }
      return 0;
    });

  const [maj, min, patch] = semvers[semvers.length - 1];
  return `${maj}.${min}.${patch + 1}`;
}

/**
 * Build upgrade-path simulations for a vulnerable dependency
 */
function buildSimulations(sourceNode, vulnerableDependency) {
  const desc = sourceNode.vulnerabilities[0]?.description || '';
  let recs = extractRecommendedVersions(desc);
  if (!recs.length) {
    recs = [ extractSafeVersionFromDescription(desc) ];
  }

  return recs.map(ver => ({
    id: `${vulnerableDependency}-upgrade-to-${ver}`,
    description: `Simulate upgrading ${vulnerableDependency} to ${ver}`,
    severityScore: sourceNode.vulnerabilities.length,
    recommendedVersion: ver,
    graph: [ { from: vulnerableDependency, to: ver } ]
  }));
}

// apply auth to all analysis routes
router.use(requireAuth);

/**
 * @route   POST /analysis/projects/:id/analyze
 * @desc    Run OWASP dependency-check, parse results, and save Analysis
 * @access  Authenticated
 */
router.post('/projects/:id/analyze', async (req, res) => {
  try {
    // 1) Load project and its ZIP from GridFS
    const proj = await Project.findById(req.params.id);
    if (!proj) return res.sendStatus(404);

    const tmpZip = path.join(os.tmpdir(), `proj-${proj._id}.zip`);
    await new Promise((resolve, reject) => {
      new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' })
        .openDownloadStream(proj.zipFileId)
        .pipe(fs.createWriteStream(tmpZip))
        .on('finish', resolve)
        .on('error', reject);
    });

    // 2) Unzip into temp directory
    const tmpDir = path.join(os.tmpdir(), `proj-${proj._id}`);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });
    await fs.createReadStream(tmpZip)
      .pipe(unzipper.Extract({ path: tmpDir }))
      .promise();

    // 3) Detect nested project root
    let projectRoot = tmpDir;
    const items = fs.readdirSync(tmpDir);
    if (items.length === 1 && fs.statSync(path.join(tmpDir, items[0])).isDirectory()) {
      projectRoot = path.join(tmpDir, items[0]);
    }

    // 4) Build with Maven
    try {
      await execPromise(`"${MAVEN_PATH}" clean package -U -DskipTests`, { cwd: projectRoot, shell: true });
    } catch (e) {
      console.error('❌ Maven build failed:', e.stderr || e.message);
      throw new Error(`Maven build failed:\n${e.stderr || e.message}`);
    }

    // 5) Extract JAR libs
    const target = path.join(projectRoot, 'target');
    const jarFile = fs.readdirSync(target).find(f => f.endsWith('.jar') && !f.endsWith('-sources.jar'));
    if (!jarFile) throw new Error('No JAR found after Maven build');

    const libDir = path.join(os.tmpdir(), `lib-${proj._id}`);
    fs.rmSync(libDir, { recursive: true, force: true });
    fs.mkdirSync(libDir, { recursive: true });
    await fs.createReadStream(path.join(target, jarFile))
      .pipe(unzipper.Extract({ path: libDir }))
      .promise();

    const scanPath = path.join(libDir, 'BOOT-INF', 'lib');
    if (!fs.existsSync(scanPath)) throw new Error('BOOT-INF/lib missing in JAR');

    // 6) Run OWASP Dependency-Check
    const reportDir = path.join(os.tmpdir(), `report-${proj._id}`);
    fs.rmSync(reportDir, { recursive: true, force: true });
    fs.mkdirSync(reportDir, { recursive: true });
    await execPromise(
      `${OWASP_PATH} --noupdate --project "${proj.name}" --scan "${scanPath}" --format JSON --out "${reportDir}"`,
      { shell: true }
    );

    const reportJson = JSON.parse(
      fs.readFileSync(path.join(reportDir, 'dependency-check-report.json'), 'utf8')
    );

    // 7) Generate dependency graph via Maven
    const dotOutput = await execPromise(
      `"${MAVEN_PATH}" dependency:tree -DoutputType=dot`,
      { cwd: projectRoot, shell: true }
    );

    const graph = [];
    dotOutput.split('\n').forEach(line => {
      const matches = line.match(/"([^"]+)"/g);
      if (matches?.length === 2) {
        const parseArtifact = quoted => {
          const [ , artifactId, , version ] = quoted.replace(/"/g, '').split(':');
          return `${artifactId}-${version}.jar`;
        };
        graph.push({ from: parseArtifact(matches[0]), to: parseArtifact(matches[1]) });
      }
    });

    // 8) Build summary counts
    const deps = reportJson.dependencies || [];
    const summary = {
      totalDependencies: deps.length,
      vulnerableCount:   deps.filter(d => d.vulnerabilities?.length).length,
      highSeverity:      deps.flatMap(d => d.vulnerabilities||[]).filter(v => v.severity === 'HIGH').length,
      mediumSeverity:    deps.flatMap(d => d.vulnerabilities||[]).filter(v => v.severity === 'MEDIUM').length,
      lowSeverity:       deps.flatMap(d => d.vulnerabilities||[]).filter(v => v.severity === 'LOW').length
    };

    // 9) Save Analysis document
    const analysis = await Analysis.create({
      projectId:  proj._id,
      reportDate: new Date(reportJson.projectInfo.reportDate),
      summary,
      reportJson
    });

    // 10) Cleanup temp files
    fs.unlinkSync(tmpZip);
    fs.rmSync(tmpDir,   { recursive: true, force: true });
    fs.rmSync(libDir,   { recursive: true, force: true });
    fs.rmSync(reportDir,{ recursive: true, force: true });

    // Return result
    res.json({
      _id:         analysis._id,
      projectId:   analysis.projectId,
      reportDate:  analysis.reportDate,
      summary:     analysis.summary,
      dependencies: reportJson.dependencies,
      projectInfo:  reportJson.projectInfo,
      graph
    });
  } catch (err) {
    console.error('❌ Analysis failed:', err);
    res.status(500).json({ error: 'Analysis failed', details: err.toString() });
  }
});

/**
 * @route   GET /analysis/projects/:id/analysis
 * @desc    Fetch the latest Analysis for a project
 * @access  Authenticated
 */
router.get('/projects/:id/analysis', async (req, res) => {
  try {
    const docs = await Analysis.find({ projectId: req.params.id })
      .sort('-reportDate')
      .limit(1)
      .lean();
    if (!docs.length) return res.sendStatus(404);
    res.json(docs[0]);
  } catch (e) {
    console.error('❌ Fetch analysis error:', e);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
});

/**
 * @route   POST /analysis/impact-analysis
 * @desc    Simulate impact of upgrading a vulnerable dependency
 * @access  Authenticated
 */
router.post('/impact-analysis', async (req, res) => {
  try {
    const { projectId, vulnerableDependency } = req.body;

    // 1) Load latest analysis
    const analysis = await Analysis.findOne({ projectId })
      .sort('-reportDate')
      .lean();
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    // 2) Build enhanced node list
    const enhanced = simulateDependencyRelations(analysis.reportJson);

    // 3) Locate source node
    const source = enhanced.find(d => d.fileName === vulnerableDependency);
    if (!source) {
      return res.status(404).json({ error: 'Vulnerable dependency not found' });
    }

    // 4) Compute impact list
    const impact = enhanced
      .filter(d =>
        d.dependencies.includes(vulnerableDependency) &&
        d.vulnerabilities.length === 0
      )
      .map(d => ({
        source:         vulnerableDependency,
        target:         d.fileName,
        impactLevel:    'High',
        transitiveDepth:d.transitiveDepth,
        dependencyType: d.dependencyType,
        usedIn:         d.usedIn,
        recommendation: `After upgrading ${vulnerableDependency}, verify integration with ${d.fileName}`
      }));

    // 5) Build upgrade-path simulations
    const simulations = buildSimulations(source, vulnerableDependency);

    // 6) Return impact + simulations
    res.json({ projectId, simulations, impact });
  } catch (e) {
    console.error('❌ Impact analysis failed:', e);
    res.status(500).json({ error: 'Impact analysis failed', message: e.message });
  }
});

module.exports = router;
