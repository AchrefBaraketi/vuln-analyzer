// routes/usersRoute.js

require('dotenv').config();              // Load JWT_SECRET from .env
const express    = require('express');
const jwt        = require('jsonwebtoken');
const mongoose   = require('mongoose');
const User       = require('../models/User');
const Role       = require('../models/Role');

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ Missing JWT_SECRET in .env');
  process.exit(1);
}

/**
 * Middleware: Require valid JWT in Authorization header
 */
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const [, token] = authHeader.split(' ');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Middleware: Allow only admin users
 */
async function isAdmin(req, res, next) {
  try {
    const user = await User.findById(req.user.id).populate('role', 'name');
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (user.role.name !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: admin only' });
    }
    next();
  } catch (err) {
    console.error('❌ [usersRoute] isAdmin error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

/**
 * @route   GET /users
 * @desc    List all users (admin only)
 */
router.get('/', requireAuth, isAdmin, async (req, res) => {
  try {
    // 1) Fetch all users (raw)
    const users = await User.find().lean();

    // 2) Fetch all roles to map IDs→names
    const roles = await Role.find().lean();
    const roleMap = roles.reduce((map, r) => {
      map[r._id.toString()] = r.name;
      return map;
    }, {});

    // 3) Build response array with normalized role names
    const out = users.map(u => {
      let roleName;
      if (typeof u.role === 'string' && mongoose.Types.ObjectId.isValid(u.role)) {
        // stored as ObjectId string
        roleName = roleMap[u.role] || 'unknown';
      } else if (typeof u.role === 'string') {
        // legacy literal role
        roleName = u.role;
      } else {
        // real ObjectId
        roleName = roleMap[u.role.toString()] || 'unknown';
      }
      return {
        id:       u._id,
        username: u.username,
        role:     roleName
      };
    });

    res.json(out);
  } catch (err) {
    console.error('❌ [usersRoute] GET /users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * @route   POST /users
 * @desc    Create a new user (admin only)
 */
router.post('/', requireAuth, isAdmin, async (req, res) => {
  try {
    const { username, password, roleId } = req.body;

    // Validate request
    if (!username || !password || !roleId) {
      return res.status(400).json({ error: 'username, password, and roleId are required' });
    }

    // Ensure role exists
    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(400).json({ error: 'Invalid roleId' });
    }

    // Create and save user
    const newUser = new User({ username, password, role: role._id });
    await newUser.save();

    res.status(201).json({
      id:       newUser._id,
      username: newUser.username,
      role:     role.name
    });
  } catch (err) {
    console.error('❌ [usersRoute] POST /users error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   PUT /users/:id
 * @desc    Update username and/or role (admin only)
 */
router.put('/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { username, roleName } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Apply updates
    if (username) user.username = username;
    if (roleName) {
      const role = await Role.findOne({ name: roleName });
      if (!role) {
        return res.status(400).json({ error: 'Invalid roleName' });
      }
      user.role = role._id;
    }

    await user.save();

    // Return updated info
    const populated = await user.populate('role', 'name');
    res.json({
      id:       populated._id,
      username: populated.username,
      role:     populated.role.name
    });
  } catch (err) {
    console.error('❌ [usersRoute] PUT /users/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   DELETE /users/:id
 * @desc    Delete a user (admin only)
 */
router.delete('/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('❌ [usersRoute] DELETE /users/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
