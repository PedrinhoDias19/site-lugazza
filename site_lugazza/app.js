require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const path = require('path');
const apiRoutes = require('./apiRoutes');
const { Client, Project } = require('./database');
const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');

const app = express();

// Configuração da conexão com o MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('Conectado ao MongoDB Atlas');
        createAdminUser();
    })
    .catch(err => {
        console.error('Erro ao conectar ao MongoDB:', err.message);
        process.exit(1);
    });

app.use(session({
    secret: 'secretKey',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    return res.status(401).json({ message: 'Acesso negado. Por favor, faça login.' });
}

async function createAdminUser() {
    try {
        const adminUser = await Client.findOne({ username: 'admin' });
        if (!adminUser) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await Client.create({ username: 'admin', password: hashedPassword, role: 'admin' });
            console.log('Usuário admin criado com sucesso!');
        } else {
            console.log('Usuário admin já existe.');
        }
    } catch (err) {
        console.error('Erro ao criar usuário admin:', err.message);
    }
}

// Configuração do S3 para upload
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'Carregada com sucesso' : 'Não encontrada');
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'Carregada com sucesso' : 'Não encontrada');
console.log('AWS_REGION:', process.env.AWS_REGION ? 'Carregada com sucesso' : 'Não encontrada');
console.log('AWS_S3_BUCKET_NAME:', process.env.AWS_S3_BUCKET_NAME ? 'Carregada com sucesso' : 'Não encontrada');

const bucketName = process.env.AWS_S3_BUCKET_NAME;
if (!bucketName) {
    throw new Error('O nome do bucket S3 (AWS_S3_BUCKET_NAME) é obrigatório. Verifique o arquivo .env');
}

const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: bucketName,
        metadata: (req, file, cb) => {
            cb(null, { fieldName: file.fieldname });
        },
        key: (req, file, cb) => {
            const projectId = req.params.projectId;
            const date = new Date().toISOString().split('T')[0];
            cb(null, `${projectId}/${date}/${Date.now()}-${file.originalname}`);
        },
    }),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Somente arquivos de imagem são permitidos.'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // Limite de 5MB por imagem
});

// Rota para upload de imagens com atualização do banco
app.post('/upload-images/:projectId', upload.array('images', 12), async (req, res) => {
    const { projectId } = req.params;

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'Nenhuma imagem enviada.' });
    }

    const imageUrls = req.files.map(file => file.location);

    try {
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Projeto não encontrado.' });
        }

        project.images.push(...imageUrls);
        await project.save();

        res.json({ success: true, urls: imageUrls });
    } catch (error) {
        console.error('Erro ao salvar URLs no banco:', error);
        res.status(500).json({ message: 'Erro no servidor ao salvar URLs.' });
    }
});

// Rotas para páginas de dashboards
app.get('/dashboard_admin', isAuthenticated, (req, res) => {
    if (req.session.username === 'admin') {
        res.sendFile(path.join(__dirname, 'public', 'dashboard_admin.html'));
    } else {
        res.redirect('/dashboard_client');
    }
});

app.get('/dashboard_client', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard_client.html'));
});

app.use('/api', apiRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
