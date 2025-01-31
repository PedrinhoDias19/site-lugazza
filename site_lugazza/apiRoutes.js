require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const router = express.Router();
const { Client, Project } = require('./database'); // Models exported from database.js

// AWS S3 configuration for image upload
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const bucketName = process.env.AWS_S3_BUCKET_NAME;

if (!bucketName) {
    throw new Error('The S3 bucket name (AWS_S3_BUCKET_NAME) is required. Check the .env file.');
}

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Route for image upload to AWS S3
router.post('/upload-images', upload.array('images', 12), async (req, res) => {
    try {
        const imageUrls = await Promise.all(req.files.map(async (file) => {
            const uploadParams = {
                Bucket: bucketName,
                Key: `${Date.now()}-${file.originalname}`,
                Body: file.buffer,
                ContentType: file.mimetype,
            };
            const upload = new Upload({
                client: s3,
                params: uploadParams,
            });

            const result = await upload.done();
            return result.Location;
        }));

        res.json({ success: true, urls: imageUrls });
    } catch (error) {
        console.error('Error uploading images:', error);
        res.status(500).json({ message: 'Error uploading images' });
    }
});

// Login route with detailed checks
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const client = await Client.findOne({ username });
        if (!client) {
            console.log('User not found');
            return res.status(401).json({ message: 'Incorrect username or password' });
        }

        const passwordMatch = await bcrypt.compare(password, client.password);
        if (!passwordMatch) {
            console.log('Incorrect password');
            return res.status(401).json({ message: 'Incorrect username or password' });
        }

        req.session.userId = client._id;
        req.session.username = client.username;

        if (client.username === 'admin') {
            res.json({ redirectURL: '/dashboard_admin' });
        } else {
            res.json({ redirectURL: '/dashboard_client' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

// CRUD for Clients
router.post('/add-client', async (req, res) => {
    const { username, project, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newClient = new Client({ username, project, password: hashedPassword });
        await newClient.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding client:', error);
        res.status(500).json({ error: 'Error adding client' });
    }
});

router.get('/clients', async (req, res) => {
    try {
        const clients = await Client.find().populate('project');
        res.json(clients);
    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ message: 'Error fetching clients' });
    }
});

router.put('/edit-client/:id', async (req, res) => {
    const { name, password } = req.body;
    try {
        const updateData = { username: name };
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateData.password = hashedPassword;
        }
        await Client.findByIdAndUpdate(req.params.id, updateData);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({ error: 'Error updating client' });
    }
});

router.delete('/delete-client/:id', async (req, res) => {
    try {
        await Client.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting client:', error);
        res.status(500).json({ error: 'Error deleting client' });
    }
});

// CRUD for Projects
router.post('/add-project', async (req, res) => {
    const { name, currentStage, progress, clientId } = req.body;
    try {
        const clientRecord = await Client.findById(clientId);
        if (!clientRecord) return res.status(404).json({ message: 'Client not found' });

        const newProject = new Project({ name, currentStage, progress, client: clientRecord._id });
        await newProject.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding project:', error);
        res.status(500).json({ error: 'Error adding project' });
    }
});

router.put('/update-project/:id', async (req, res) => {
    const { name, currentStage, progress } = req.body;
    try {
        await Project.findByIdAndUpdate(req.params.id, { name, currentStage, progress });
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Error updating project' });
    }
});

router.delete('/delete-project/:id', async (req, res) => {
    try {
        await Project.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Error deleting project' });
    }
});

// Route to fetch projects
router.get('/projects', async (req, res) => {
    try {
        const projects = await Project.find().populate('client', 'username');
        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ message: 'Error fetching projects' });
    }
});

// Route to fetch images for a project
router.get('/project-images/:projectId', async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const project = await Project.findById(projectId).populate('images'); // Assuming 'images' is a field storing image URLs.
        
        if (!project || !project.images) {
            return res.status(404).json({ message: 'Images not found' });
        }

        // Return image URLs
        res.json(project.images);
    } catch (error) {
        console.error('Error fetching project images:', error);
        res.status(500).json({ message: 'Server error fetching images' });
    }
});

module.exports = router;
