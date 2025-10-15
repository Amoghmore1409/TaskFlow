import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config({ path: '../frontend/.env' });

const app = express();
const port = 3001;

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Configure S3 Client
const s3Client = new S3Client({
  region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.REACT_APP_AWS_SESSION_TOKEN,
  },
});

const S3_BUCKET = process.env.REACT_APP_S3_BUCKET || 'taskflow-file-uploads';

console.log('Server Configuration:');
console.log('- S3 Bucket:', S3_BUCKET);
console.log('- AWS Region:', process.env.REACT_APP_AWS_REGION);
console.log('- Port:', port);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    bucket: S3_BUCKET,
    region: process.env.REACT_APP_AWS_REGION 
  });
});

// File upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { userId, taskId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Generate unique file key
    const timestamp = Date.now();
    const fileExtension = req.file.originalname.split('.').pop();
    const fileName = req.file.originalname.replace(`.${fileExtension}`, '');
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9]/g, '-');
    const s3Key = `uploads/${userId}/${timestamp}-${sanitizedFileName}.${fileExtension}`;

    console.log('Uploading file:', {
      originalName: req.file.originalname,
      s3Key: s3Key,
      size: req.file.size,
      contentType: req.file.mimetype,
      userId,
      taskId,
    });

    // Upload to S3
    const params = {
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      Metadata: {
        uploadedBy: userId,
        originalFileName: req.file.originalname,
        ...(taskId && { taskId: taskId.toString() }),
      },
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    // Construct the S3 URL
    const s3Url = `https://${S3_BUCKET}.s3.${process.env.REACT_APP_AWS_REGION}.amazonaws.com/${s3Key}`;

    console.log('✓ File uploaded successfully:', s3Url);

    res.json({
      success: true,
      message: 'File uploaded successfully',
      fileName: req.file.originalname,
      s3Key: s3Key,
      s3Url: s3Url,
      size: req.file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message,
      details: error.toString(),
    });
  }
});

// Multiple files upload endpoint
app.post('/upload-multiple', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const { userId, taskId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    console.log(`Uploading ${req.files.length} files for user ${userId}`);

    const uploadPromises = req.files.map(async (file) => {
      const timestamp = Date.now();
      const fileExtension = file.originalname.split('.').pop();
      const fileName = file.originalname.replace(`.${fileExtension}`, '');
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9]/g, '-');
      const s3Key = `uploads/${userId}/${timestamp}-${sanitizedFileName}.${fileExtension}`;

      const params = {
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          uploadedBy: userId,
          originalFileName: file.originalname,
          ...(taskId && { taskId: taskId.toString() }),
        },
      };

      const command = new PutObjectCommand(params);
      await s3Client.send(command);

      const s3Url = `https://${S3_BUCKET}.s3.${process.env.REACT_APP_AWS_REGION}.amazonaws.com/${s3Key}`;

      return {
        originalName: file.originalname,
        s3Key: s3Key,
        s3Url: s3Url,
        size: file.size,
      };
    });

    const uploadedFiles = await Promise.all(uploadPromises);

    console.log(`✓ ${uploadedFiles.length} files uploaded successfully`);

    res.json({
      success: true,
      message: `${uploadedFiles.length} files uploaded successfully`,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message,
      details: error.toString(),
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
  });
});

app.listen(port, () => {
  console.log(`\n🚀 TaskFlow Upload Server running at http://localhost:${port}`);
  console.log(`✓ Ready to accept file uploads\n`);
});
