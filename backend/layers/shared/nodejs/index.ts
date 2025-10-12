// Shared utilities for TaskFlow Lambda functions
export { DynamoDBClient } from '@aws-sdk/client-dynamodb';
export { 
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  UpdateCommand,
  QueryCommand as DocQueryCommand,
  ScanCommand as DocScanCommand
} from '@aws-sdk/lib-dynamodb';
export { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
export { getSignedUrl } from '@aws-sdk/s3-request-presigner';
export { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
export { v4 as uuid } from 'uuid';
