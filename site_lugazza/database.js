const mongoose = require('mongoose');

if (!mongoose.models.Client) {
    const ClientSchema = new mongoose.Schema({
        username: { type: String, required: true },
        password: { type: String, required: true },
        project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
        role: { type: String, default: 'client' }
    });

    mongoose.model('Client', ClientSchema);
}

if (!mongoose.models.Project) {
    const ProjectSchema = new mongoose.Schema({
        name: { type: String, required: true },
        currentStage: { type: String, required: true },
        progress: { type: Number, default: 0 },
        lastUpdated: { type: Date, required: true, default: Date.now },
        images: [{ type: String }],
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' }
    });

    mongoose.model('Project', ProjectSchema);
}

const Client = mongoose.models.Client;
const Project = mongoose.models.Project;

module.exports = { Client, Project };
