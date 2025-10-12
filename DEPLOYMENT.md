# TaskFlow Deployment Guide

## 🎉 Build Status: ALL COMPONENTS SUCCESSFUL ✅

All components of the TaskFlow Employee Management System are now building successfully without errors:

- ✅ Frontend (React + TypeScript)
- ✅ Backend (Node.js + TypeScript) 
- ✅ Infrastructure (AWS CDK)
- ✅ ML Services (Python FastAPI)
- ✅ Google Calendar Integration
- ✅ Slack Integration

## Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **Node.js** (v18 or higher)
3. **Python** (v3.8 or higher)
4. **AWS CDK CLI** installed globally: `npm install -g aws-cdk`
5. **Docker** (for local ML services development)

## ⚠️ AWS Permissions Notice

**For AWS Learning Labs or Restricted Environments:**
If you encounter IAM permission errors during CDK bootstrap (like `iam:CreateRole` errors), your AWS environment has restricted permissions. In this case:

1. **Skip CDK deployment** - Use the alternative deployment options below
2. **Focus on local development** - Test the frontend and backend locally
3. **Use manual AWS resource creation** - Create resources through AWS Console

## Deployment Options

### Option 1: Full CDK Deployment (Requires Administrator Access)

### Option 1: Full CDK Deployment (Requires Administrator Access)

#### 1. Deploy Infrastructure (AWS CDK)

First, install AWS CDK CLI globally:
```bash
npm install -g aws-cdk
```

Then deploy the infrastructure:
```bash
cd infrastructure
npm run build
npx cdk bootstrap  # Only needed once per AWS account/region
npx cdk deploy
```

Alternatively, if you prefer not to install CDK globally, use npx for all CDK commands:
```bash
npx cdk bootstrap
npx cdk deploy
npx cdk synth  # to see generated CloudFormation
npx cdk diff   # to see what changes would be made
```

This will create:
- DynamoDB tables (tasks, leave-requests, files, users)
- S3 bucket for file uploads
- Cognito User Pool for authentication
- API Gateway and Lambda functions
- SNS topic for notifications
- EC2 instance for ML services

### Option 2: Local Development & Testing (Recommended for Learning Environments)

If you have restricted AWS permissions, focus on local development:

#### 1. Run Frontend Locally
```bash
cd frontend
npm start  # Runs on http://localhost:3000
```

#### 2. Test Backend Functions Locally
```bash
cd backend
npm run build
npm test
```

#### 3. Run ML Services Locally
```bash
cd ml-services
pip install -r requirements.txt
python -m uvicorn api.server:app --reload --port 8000
# Visit http://localhost:8000/docs for API documentation
```

#### 4. Test Integration Services
```bash
cd integrations/google-calendar
npm run build
npm test

cd ../slack
npm run build
npm test
```

### Option 3: Manual AWS Resource Creation (Intermediate)

If you want to deploy to AWS but have permission restrictions:

1. **Create DynamoDB Tables manually** through AWS Console:
   - `taskflow-tasks` (Primary key: `id`)
   - `taskflow-leave-requests` (Primary key: `id`)
   - `taskflow-files` (Primary key: `id`)
   - `taskflow-users` (Primary key: `id`)

2. **Create S3 Bucket** for file uploads

3. **Create Cognito User Pool** for authentication

4. **Deploy Lambda functions** individually using ZIP uploads

5. **Create API Gateway** and connect to Lambda functions

### Option 4: Serverless Framework Alternative

For environments with limited CDK support, consider using Serverless Framework:

```bash
npm install -g serverless
# Convert CDK infrastructure to serverless.yml
# Deploy with: serverless deploy
```

### 2. Deploy ML Services

After infrastructure deployment, get the EC2 instance IP from CDK outputs:

```bash
# SSH into the EC2 instance
ssh -i your-key.pem ec2-user@<EC2-INSTANCE-IP>

# Install dependencies
sudo yum update -y
sudo yum install python3 python3-pip -y
sudo pip3 install fastapi uvicorn scikit-learn pandas numpy

# Copy ML service files to the instance
# (Use scp or configure CodeDeploy for automated deployment)

# Start the ML service
cd /opt/ml-services
python3 -m uvicorn api.server:app --host 0.0.0.0 --port 8000
```

### 3. Configure Frontend

1. Update `frontend/src/aws-exports.ts` with actual CDK output values:

```typescript
const awsconfig = {
  region: 'us-east-1', // Your AWS region
  userPoolId: '<USER_POOL_ID_FROM_CDK_OUTPUT>',
  userPoolWebClientId: '<USER_POOL_CLIENT_ID_FROM_CDK_OUTPUT>',
  apiUrl: '<API_GATEWAY_URL_FROM_CDK_OUTPUT>',
  s3Bucket: '<S3_BUCKET_NAME_FROM_CDK_OUTPUT>',
  mlApiUrl: '<ML_API_ENDPOINT_FROM_CDK_OUTPUT>'
};
```

### 4. Deploy Frontend

**Option A: AWS Amplify Console (Recommended)**
1. Go to AWS Amplify Console
2. Connect your GitHub repository
3. Set build settings:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - cd frontend
           - npm ci
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: frontend/build
       files:
         - '**/*'
   ```

**Option B: S3 + CloudFront**
```bash
cd frontend
npm run build
aws s3 sync build/ s3://your-frontend-bucket --delete
```

### 5. Integration Services (Optional)

**Google Calendar Integration:**
```bash
cd integrations/google-calendar
npm run build
# Deploy to AWS Lambda or your preferred hosting platform
```

**Slack Integration:**
```bash
cd integrations/slack
npm run build
# Deploy to AWS Lambda or your preferred hosting platform
```

## Environment Variables

Create `.env` files for each service:

**Frontend (.env):**
```
REACT_APP_AWS_REGION=us-east-1
REACT_APP_API_URL=<YOUR_API_GATEWAY_URL>
REACT_APP_ML_API_URL=<YOUR_ML_API_URL>
```

**Backend (Lambda environment variables set via CDK)**
```
DYNAMODB_TASKS_TABLE=<TABLE_NAME>
DYNAMODB_LEAVE_TABLE=<TABLE_NAME>
DYNAMODB_FILES_TABLE=<TABLE_NAME>
DYNAMODB_USERS_TABLE=<TABLE_NAME>
S3_BUCKET=<BUCKET_NAME>
SNS_TOPIC_ARN=<TOPIC_ARN>
```

**ML Services (.env):**
```
AWS_REGION=us-east-1
DYNAMODB_TASKS_TABLE=<TABLE_NAME>
DYNAMODB_USERS_TABLE=<TABLE_NAME>
```

## Testing

1. **Frontend Local Development:**
```bash
cd frontend
npm start  # Runs on http://localhost:3000
```

2. **Backend Testing:**
```bash
cd backend
npm test
```

3. **Infrastructure Testing:**
```bash
cd infrastructure
npm test
```

## Monitoring and Logging

- **CloudWatch Logs**: All Lambda functions automatically log to CloudWatch
- **CloudWatch Metrics**: API Gateway and DynamoDB metrics available
- **X-Ray Tracing**: Enable in Lambda functions for distributed tracing

## Security Considerations

1. **API Gateway**: Configure CORS, request validation, and rate limiting
2. **Cognito**: Set up strong password policies and MFA
3. **S3**: Configure bucket policies for secure file access
4. **EC2**: Ensure security groups only allow necessary traffic
5. **DynamoDB**: Use IAM roles with least privilege access

## Scaling Considerations

1. **Lambda**: Automatically scales, configure concurrency limits if needed
2. **DynamoDB**: Configure auto-scaling for read/write capacity
3. **S3**: Automatically scales, consider CloudFront for global distribution
4. **ML Services**: Consider using ECS or Fargate for better scaling

## Maintenance

1. **Updates**: Use CDK for infrastructure updates
2. **Monitoring**: Set up CloudWatch alarms for key metrics
3. **Backups**: Enable DynamoDB point-in-time recovery
4. **Security**: Regularly update dependencies and review IAM policies

## Troubleshooting

1. **Build Issues**: Check TypeScript/Node.js versions
2. **Deployment Issues**: Verify AWS credentials and permissions
3. **Runtime Issues**: Check CloudWatch logs for Lambda functions
4. **CORS Issues**: Verify API Gateway CORS configuration

---

## 🚀 Your TaskFlow system is now ready for deployment!

The system includes:
- Complete task management with Kanban boards
- Multi-level leave approval workflows
- Role-based dashboards
- File upload/download with S3
- Real-time notifications
- ML-powered task recommendations
- Google Calendar and Slack integrations
- Production-ready AWS architecture

All code is properly organized, typed, and ready for enterprise deployment.
