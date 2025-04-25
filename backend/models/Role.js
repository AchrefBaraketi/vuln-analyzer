// models/Role.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RoleSchema = new Schema({
  name:        { type: String, required: true, unique: true },
  permissions: [String]
}, { timestamps: true });

module.exports = mongoose.model('Role', RoleSchema);
