// routes/rolesRoute.js

require('dotenv').config();              // load MONGO_URI, etc.
const express    = require('express');
const Role       = require('../models/Role');

const router     = express.Router();

/**
 * Seed default roles if none exist
 */
async function initRoles() {
  const count = await Role.countDocuments();
  if (count === 0) {
    await Role.create([
      { name: 'admin', permissions: ['*'] },
      { name: 'user', permissions: [] }
    ]);
    console.log('🛠️  Default roles initialized');
  }
}
initRoles().catch(console.error);

/**
 * @route   GET /roles
 * @desc    List all available roles
 * @access  Public (or restrict as needed)
 */
router.get('/', async (req, res) => {
  try {
    const roles = await Role.find().lean();
    res.json(roles);
  } catch (err) {
    console.error('❌ [rolesRoute] GET /roles error:', err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

/**
 * @route   POST /roles
 * @desc    Create a new role
 * @access  Protected (add auth middleware if required)
 */
router.post('/', async (req, res) => {
  try {
    const { name, permissions = [] } = req.body;
    const role = await Role.create({ name, permissions });
    res.status(201).json(role);
  } catch (err) {
    console.error('❌ [rolesRoute] POST /roles error:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
