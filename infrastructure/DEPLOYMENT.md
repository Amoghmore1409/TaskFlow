# TaskFlow Infrastructure Deployment Guide

## Prerequisites

Before deploying the TaskFlow infrastructure, ensure you have:

1. **AWS CLI configured** with appropriate permissions
2. **AWS CDK CLI installed** (`npm install -g aws-cdk`)
3. **Node.js 18+** and npm installed
4. **Python 3.9+** (for ML services)

## AWS Permissions Required

Your AWS user/role needs the following permissions:
- CloudFormation full access
- IAM role creation and management
- Lambda function management
- API Gateway management
- DynamoDB management
- S3 bucket management
- Cognito management
- SNS management
- EC2 management (for ML services)
- Amplify management (for frontend hosting)

## Deployment Steps

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install

# Install infrastructure dependencies
cd ../infrastructure
npm install

# Install ML service dependencies
cd ../ml-services
pip install -r requirements.txt
```

### 2. Build Backend

```bash
cd backend
npm run build
```

### 3. Bootstrap CDK (First time only)

```bash
cd infrastructure
cdk bootstrap
```

### 4. Deploy Infrastructure

```bash
cd infrastructure
npm run deploy
```

This will create:
- DynamoDB tables for tasks, leave requests, files, and users
- S3 bucket for file uploads
- Lambda functions for all API endpoints
- API Gateway with CORS configuration
- Cognito User Pool for authentication
- SNS topic for notifications
- (Optional) EC2 instance for ML services
- (Optional) Amplify app for frontend hosting

### 5. Configure Environment Variables

After deployment, update the environment files with the actual values:

```bash
# Frontend environment
cp frontend/.env.example frontend/.env
# Edit frontend/.env with the CDK outputs

# Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with the CDK outputs

# ML services environment
cp ml-services/.env.example ml-services/.env
# Edit ml-services/.env with your configuration
```

### 6. Deploy Frontend to Amplify

```bash
cd frontend
npm run build

# If using Amplify hosting, push your code to the connected Git repository
# Amplify will automatically build and deploy
```

### 7. (Optional) Deploy ML Services to EC2

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Install dependencies
sudo yum update -y
sudo yum install -y python3 python3-pip

# Copy ML services code
scp -i your-key.pem -r ml-services/ ec2-user@your-ec2-ip:/home/ec2-user/

# Install Python dependencies
cd ml-services
pip3 install -r requirements.txt

# Start the ML API server
python3 api/server.py
```

## CDK Outputs

After deployment, note these important outputs:

- **ApiUrl**: Your API Gateway endpoint URL
- **UserPoolId**: Cognito User Pool ID
- **UserPoolClientId**: Cognito User Pool Client ID
- **S3BucketName**: S3 bucket for file uploads
- **SNSTopicArn**: SNS topic for notifications
- **AmplifyAppUrl**: Frontend application URL

## Post-Deployment Configuration

### 1. Create Admin User

```bash
# Using AWS CLI
aws cognito-idp admin-create-user \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin \
  --user-attributes Name=email,Value=admin@company.com Name=given_name,Value=Admin Name=family_name,Value=User \
  --temporary-password TempPassword123! \
  --message-action SUPPRESS
```

### 2. Set Up Google Calendar Integration (Optional)

1. Create a Google Cloud Project
2. Enable Google Calendar API
3. Create OAuth2 credentials
4. Update environment variables with client ID and secret

### 3. Set Up Slack Integration (Optional)

1. Create a Slack app in your workspace
2. Add bot token scopes: `chat:write`, `users:read`, `users:read.email`
3. Install the app to your workspace
4. Update environment variables with bot token

### 4. Configure SNS Subscriptions

```bash
# Subscribe to email notifications
aws sns subscribe \
  --topic-arn YOUR_SNS_TOPIC_ARN \
  --protocol email \
  --notification-endpoint admin@company.com
```

## Testing the Deployment

### 1. Test API Endpoints

```bash
# Health check
curl https://YOUR_API_URL/health

# Test authentication (after creating a user)
curl -X POST https://YOUR_API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

### 2. Test Frontend

Visit your Amplify URL or locally run:

```bash
cd frontend
npm start
```

### 3. Test ML Services

```bash
curl http://YOUR_EC2_IP:8000/health
```

## Monitoring and Maintenance

### CloudWatch Logs

Monitor your Lambda functions through CloudWatch:
- `/aws/lambda/taskflow-*` log groups
- Set up alerts for errors and performance metrics

### DynamoDB Monitoring

- Monitor read/write capacity usage
- Set up alarms for throttling
- Consider auto-scaling if needed

### S3 Monitoring

- Monitor storage usage and costs
- Set up lifecycle policies for old files
- Configure backup if needed

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure your AWS user has all required permissions
2. **CDK Bootstrap**: Run `cdk bootstrap` if you get bootstrap errors
3. **Lambda Timeout**: Increase timeout in CDK stack if functions timeout
4. **CORS Issues**: Check API Gateway CORS configuration
5. **Authentication Issues**: Verify Cognito User Pool configuration

### Logs and Debugging

```bash
# View CDK diff before deployment
cdk diff

# View CloudWatch logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/taskflow"

# Tail logs in real-time
aws logs tail /aws/lambda/taskflow-list-tasks --follow
```

## Cost Optimization

### Development Environment

- Use DynamoDB On-Demand billing
- Stop EC2 instances when not in use
- Use smaller Lambda memory allocations

### Production Environment

- Consider DynamoDB Provisioned mode with auto-scaling
- Use EC2 Reserved Instances or Savings Plans
- Implement S3 Intelligent Tiering
- Set up CloudWatch cost alarms

## Security Best Practices

1. **Enable AWS Config** for compliance monitoring
2. **Use IAM least privilege** principle
3. **Enable CloudTrail** for audit logging
4. **Encrypt data** at rest and in transit
5. **Regular security reviews** and updates
6. **Monitor for unusual activity**

## Cleanup

To delete all resources:

```bash
cd infrastructure
cdk destroy
```

**Warning**: This will delete all data. Make sure to backup important data before destroying the stack.
