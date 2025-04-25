// routes/authRoute.js

require('dotenv').config(); // ensure process.env.JWT_SECRET is loaded
const express = require('express');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const Role    = require('../models/Role');

const router  = express.Router();

/**
 * @route   POST /auth/register
 * @desc    Register a new user with a specific role
 * @access  Public
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, roleId } = req.body;

    // 1) Ensure the role exists
    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(400).json({ error: 'Invalid role selected' });
    }

    // 2) Create and save the new user
    const user = new User({ username, password, role: role._id });
    await user.save();

    // 3) Respond with created user info (omit password)
    res.status(201).json({
      id:       user._id,
      username: user.username,
      role:     role.name
    });
  } catch (err) {
    console.error('❌ [authRoute] POST /register error:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route   POST /auth/login
 * @desc    Authenticate user and return a JWT
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1) Find user by username and populate role name
    const user = await User.findOne({ username }).populate('role', 'name');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 2) Verify password (assumes User schema has comparePassword method)
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 3) Sign a JWT (expires in 1 day)
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 4) Return token and basic user info
    res.json({
      token,
      user: {
        id:       user._id,
        username: user.username,
        role:     user.role.name
      }
    });
  } catch (err) {
    console.error('❌ [authRoute] POST /login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
