const { Schema, model, Types } = require('mongoose');
const Project = new Schema({
  name:        { type: String, required: true },
  owner:       { type: Types.ObjectId, ref: 'User', required: true },
  description: String,
  metadata:    Schema.Types.Mixed,
  zipFileId:   Types.ObjectId,
  fileTree:    Schema.Types.Mixed
}, { timestamps: true });
module.exports = model('Project', Project);
