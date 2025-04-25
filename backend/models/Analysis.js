const { Schema, model, Types } = require('mongoose');
const Analysis = new Schema({
  projectId:  { type: Types.ObjectId, ref: 'Project', required: true },
  reportDate: { type: Date, default: Date.now },
  summary: {
    totalDependencies: Number,
    vulnerableCount:   Number,
    highSeverity:      Number,
    mediumSeverity:    Number,
    lowSeverity:       Number
  },
  reportJson: Schema.Types.Mixed
}, { timestamps: true });
module.exports = model('Analysis', Analysis);
