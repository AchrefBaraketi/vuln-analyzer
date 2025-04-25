// routes/projectsRoute.js

require('dotenv').config(); // load MONGO_URI, JWT_SECRET, etc.

const express        = require('express');
const mongoose       = require('mongoose');
const jwt            = require('jsonwebtoken');
const Busboy         = require('busboy');
const unzipper       = require('unzipper');
const { GridFSBucket } = require('mongodb');
const fs             = require('fs');
const os             = require('os');
const path           = require('path');

const router         = express.Router();
const Project        = require('../models/Project');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ Missing JWT_SECRET in .env');
  process.exit(1);
}

/**
 * Middleware to require a valid JWT in Authorization header.
 */
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Not authenticated' });
  const [, token] = auth.split(' ');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// apply auth to all routes
router.use(requireAuth);

/**
 * Helper: get a GridFSBucket instance.
 */
function getBucket() {
  return new GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
}

/**
 * Helper: convert a readable stream to a Buffer.
 */
function streamToBuffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', c => chunks.push(c));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

/**
 * @route   POST /projects
 * @desc    Upload a ZIP + metadata, store in GridFS & Mongo
 */
router.post('/', (req, res) => {
  const bb = Busboy({ headers: req.headers });
  let zipBuffer = Buffer.alloc(0);
  let projectName, description, metadata;

  // collect form fields
  bb.on('field', (name, val) => {
    if (name === 'name')        projectName = val;
    else if (name === 'description') description = val;
    else if (name === 'metadata')    metadata = JSON.parse(val);
  });

  // collect file bytes
  bb.on('file', (field, stream) => {
    const chunks = [];
    stream.on('data', c => chunks.push(c));
    stream.on('end', () => zipBuffer = Buffer.concat([ zipBuffer, ...chunks ]));
  });

  bb.on('finish', async () => {
    try {
      // 1) upload ZIP into GridFS
      const bucket = getBucket();
      const uploadStream = bucket.openUploadStream(`${Date.now()}_${projectName}.zip`);
      uploadStream.end(zipBuffer);

      uploadStream.once('error', err => {
        console.error('GridFS upload error:', err);
        res.status(500).json({ error: 'Failed to store ZIP' });
      });

      uploadStream.once('finish', async () => {
        // 2) build in-memory fileTree
        const directory = await unzipper.Open.buffer(zipBuffer);
        const fileTree = directory.files.reduce((tree, entry) => {
          const parts = entry.path.split('/');
          let cur = tree;
          parts.forEach((p, i) => {
            cur[p] = cur[p] || (i === parts.length - 1 ? null : {});
            cur = cur[p] || {};
          });
          return tree;
        }, {});

        // 3) save Project doc
        const proj = await Project.create({
          name:      projectName,
          owner:     req.user.id,
          description,
          metadata,
          zipFileId: uploadStream.id,
          fileTree
        });

        res.status(201).json(proj);
      });
    } catch (err) {
      console.error('POST /projects error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  req.pipe(bb);
});

/**
 * @route   GET /projects
 * @desc    List all projects for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const list = await Project
      .find({ owner: req.user.id })
      .select('name description createdAt')
      .sort('-createdAt')
      .lean();
    res.json(list);
  } catch (err) {
    console.error('GET /projects error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   GET /projects/:id
 * @desc    Get full project metadata + fileTree
 */
router.get('/:id', async (req, res) => {
  try {
    const proj = await Project.findOne({
      _id:   req.params.id,
      owner: req.user.id
    }).lean();
    if (!proj) return res.status(404).json({ error: 'Not found' });
    res.json(proj);
  } catch (err) {
    console.error('GET /projects/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   GET /projects/:id/zip
 * @desc    Download the ZIP from GridFS
 */
router.get('/:id/zip', async (req, res) => {
  try {
    const proj = await Project.findOne({
      _id:   req.params.id,
      owner: req.user.id
    });
    if (!proj) return res.sendStatus(404);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${proj.name}.zip"`);

    const downloadStream = getBucket().openDownloadStream(proj.zipFileId);
    downloadStream.on('error', err => {
      console.error('GridFS download error', err);
      res.sendStatus(404);
    });
    downloadStream.pipe(res);
  } catch (err) {
    console.error('GET /projects/:id/zip error:', err);
    res.status(500).json({ error: 'Failed to download ZIP' });
  }
});

/**
 * @route   DELETE /projects/:id
 * @desc    Delete project doc + GridFS file + stray chunks
 */
router.delete('/:id', async (req, res) => {
  try {
    const proj = await Project.findOneAndDelete({
      _id:   req.params.id,
      owner: req.user.id
    });
    if (!proj) {
      return res.status(404).json({ error: 'Not found or no permission' });
    }

    const bucket = getBucket();
    // delete file
    await bucket.delete(proj.zipFileId);
    // clean chunks
    await mongoose.connection.db
      .collection('uploads.chunks')
      .deleteMany({ files_id: proj.zipFileId });

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /projects/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   PUT /projects/:id
 * @desc    Overwrite existing project ZIP + metadata
 */
router.put('/:id', (req, res) => {
  const bb = Busboy({ headers: req.headers });
  let zipBuffer = Buffer.alloc(0);
  let projectName, description, metadata;

  bb.on('field', (name, val) => {
    if (name === 'name')          projectName = val;
    else if (name === 'description') description = val;
    else if (name === 'metadata')    metadata = JSON.parse(val);
  });

  bb.on('file', (field, stream) => {
    const chunks = [];
    stream.on('data', c => chunks.push(c));
    stream.on('end', () => zipBuffer = Buffer.concat([ zipBuffer, ...chunks ]));
  });

  bb.on('finish', async () => {
    try {
      // fetch & ownership check
      const proj = await Project.findOne({ _id: req.params.id, owner: req.user.id });
      if (!proj) return res.status(404).json({ error: 'Not found' });

      const oldId = proj.zipFileId;
      // upload new ZIP
      const bucket = getBucket();
      const uploadStream = bucket.openUploadStream(`${Date.now()}_${projectName}.zip`);
      uploadStream.end(zipBuffer);

      uploadStream.once('error', err => {
        console.error('GridFS upload error:', err);
        res.status(500).json({ error: 'Failed to store new ZIP' });
      });

      uploadStream.once('finish', async () => {
        // rebuild fileTree
        const directory = await unzipper.Open.buffer(zipBuffer);
        const fileTree = directory.files.reduce((tree, entry) => {
          const parts = entry.path.split('/');
          let cur = tree;
          parts.forEach((p, i) => {
            cur[p] = cur[p] || (i === parts.length - 1 ? null : {});
            cur = cur[p] || {};
          });
          return tree;
        }, {});

        // update doc
        proj.name        = projectName;
        proj.description = description;
        proj.metadata    = metadata;
        proj.zipFileId   = uploadStream.id;
        proj.fileTree    = fileTree;
        await proj.save();

        // delete old ZIP & chunks
        try { await bucket.delete(oldId); } catch (_) { /* ignore */ }
        await mongoose.connection.db
          .collection('uploads.chunks')
          .deleteMany({ files_id: oldId });

        res.json(proj);
      });
    } catch (err) {
      console.error('PUT /projects/:id error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  req.pipe(bb);
});

/**
 * @route   POST /projects/rename
 * @desc    Rename a project (top-level & metadata)
 */
router.post('/rename', async (req, res) => {
  try {
    const { from, to } = req.body;
    const proj = await Project.findOne({ owner: req.user.id, name: from });
    if (!proj) {
      return res.status(404).json({ error: 'Project not found' });
    }

    proj.name = to;
    if (proj.metadata && typeof proj.metadata === 'object') {
      proj.metadata.name = to;
    }
    await proj.save();

    res.json({ success: true, project: proj });
  } catch (err) {
    console.error('POST /projects/rename error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
