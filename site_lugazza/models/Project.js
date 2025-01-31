// models/Project.js
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    currentStage: { type: String },
    progress: { type: Number, default: 0 }
});

module.exports = mongoose.model('Project', projectSchema);
