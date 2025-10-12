import { APIGatewayProxyHandler } from 'aws-lambda';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const S3_BUCKET = process.env.S3_BUCKET || 'taskflow-uploads';
const FILES_TABLE = process.env.FILES_TABLE || 'taskflow-files';

interface FileMetadata {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  s3Key: string;
  s3Bucket: string;
  taskId?: string;
  leaveRequestId?: string;
}

// POST /files/upload - Generate presigned URL for file upload
export const generateUploadUrl: APIGatewayProxyHandler = async (event) => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const { fileName, fileSize, mimeType, uploadedBy, taskId, leaveRequestId } = JSON.parse(event.body);
    
    if (!fileName || !fileSize || !mimeType || !uploadedBy) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'fileName, fileSize, mimeType, and uploadedBy are required' }),
      };
    }

    const fileId = uuidv4();
    const fileExtension = fileName.split('.').pop();
    const s3Key = `uploads/${uploadedBy}/${fileId}.${fileExtension}`;

    // Generate presigned URL for upload
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      ContentType: mimeType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour

    // Store file metadata
    const fileMetadata: FileMetadata = {
      id: fileId,
      fileName,
      fileSize,
      mimeType,
      uploadedBy,
      uploadedAt: new Date().toISOString(),
      s3Key,
      s3Bucket: S3_BUCKET,
      taskId,
      leaveRequestId,
    };

    await docClient.send(new PutCommand({
      TableName: FILES_TABLE,
      Item: fileMetadata,
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        fileId,
        uploadUrl: presignedUrl,
        metadata: fileMetadata,
      }),
    };
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Failed to generate upload URL' }),
    };
  }
};

// GET /files/{id} - Get file metadata and download URL
export const getFile: APIGatewayProxyHandler = async (event) => {
  try {
    const fileId = event.pathParameters?.id;
    if (!fileId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'File ID is required' }),
      };
    }

    // Get file metadata from DynamoDB
    const result = await docClient.send(new GetCommand({
      TableName: FILES_TABLE,
      Key: { id: fileId },
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'File not found' }),
      };
    }

    const fileMetadata = result.Item as FileMetadata;

    // Generate presigned URL for download
    const command = new GetObjectCommand({
      Bucket: fileMetadata.s3Bucket,
      Key: fileMetadata.s3Key,
    });

    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        metadata: fileMetadata,
        downloadUrl,
      }),
    };
  } catch (error) {
    console.error('Error getting file:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Failed to get file' }),
    };
  }
};

// DELETE /files/{id} - Delete file
export const deleteFile: APIGatewayProxyHandler = async (event) => {
  try {
    const fileId = event.pathParameters?.id;
    if (!fileId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'File ID is required' }),
      };
    }

    // Get file metadata from DynamoDB
    const result = await docClient.send(new GetCommand({
      TableName: FILES_TABLE,
      Key: { id: fileId },
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'File not found' }),
      };
    }

    const fileMetadata = result.Item as FileMetadata;

    // Delete file from S3
    await s3Client.send(new DeleteObjectCommand({
      Bucket: fileMetadata.s3Bucket,
      Key: fileMetadata.s3Key,
    }));

    // Delete metadata from DynamoDB
    await docClient.send(new DeleteCommand({
      TableName: FILES_TABLE,
      Key: { id: fileId },
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'File deleted successfully' }),
    };
  } catch (error) {
    console.error('Error deleting file:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Failed to delete file' }),
    };
  }
};
