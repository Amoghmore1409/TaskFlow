# TaskFlow - Employee Management System

A centralized employee management system built with React frontend and AWS serverless backend architecture.

## 🏗️ Architecture

### Frontend
- **React** with TypeScript for the web application
- **AWS Amplify** for hosting and deployment
- **Material-UI** for modern UI components
- **React Query** for state management and caching

### Backend
- **AWS Lambda** for serverless functions
- **API Gateway** for REST API endpoints
- **DynamoDB** for NoSQL data storage
- **AWS Cognito** for user authentication
- **S3** for file storage and uploads
- **SNS** for notifications
- **EC2** for ML model hosting

### Infrastructure
- **AWS CDK** for Infrastructure as Code
- **CloudFormation** for resource management

## 🚀 Features

### Core Features
- ✅ **Task Management**: Full CRUD operations with Kanban board view
- ✅ **Leave Workflows**: Multi-level approval system
- ✅ **Role-based Dashboards**: Admin, Manager, Employee views
- ✅ **File Uploads**: S3 integration for documents and attachments
- ✅ **Notifications**: Real-time updates via SNS
- ✅ **Authentication**: Secure login with AWS Cognito
- ✅ **ML Recommendations**: AI-powered task and resource suggestions

### Optional Integrations
- 🔄 **Google Calendar**: Sync leave requests and meetings
- 🔄 **Slack**: Team notifications and bot interactions

## 📁 Project Structure

```
TaskFlow/
├── frontend/                    # React application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/             # Page components
│   │   ├── services/          # API services
│   │   ├── hooks/             # Custom React hooks
│   │   ├── context/           # React context providers
│   │   └── utils/             # Utility functions
│   ├── public/
│   └── package.json
├── backend/                     # AWS Lambda functions
│   ├── src/
│   │   ├── lambdas/           # Lambda function handlers
│   │   ├── layers/            # Lambda layers for shared code
│   │   └── schemas/           # Data validation schemas
│   └── package.json
├── infrastructure/              # AWS CDK infrastructure code
│   ├── lib/                   # CDK stack definitions
│   ├── bin/                   # CDK app entry point
│   └── package.json
├── ml-services/                 # Machine Learning services
│   ├── models/                # ML model definitions
│   ├── training/              # Training scripts
│   └── api/                   # ML API server
├── integrations/                # Third-party integrations
│   ├── google-calendar/       # Google Calendar integration
│   └── slack/                 # Slack bot integration
└── docs/                       # Documentation
```

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- AWS CLI configured
- AWS CDK CLI installed
- Python 3.9+ (for ML services)

### Installation

1. **Clone and install dependencies:**
```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install

# Install infrastructure dependencies
cd ../infrastructure
npm install
```

2. **Deploy infrastructure:**
```bash
cd infrastructure
cdk bootstrap
cdk deploy
```

3. **Configure AWS Amplify:**
```bash
cd frontend
npx amplify init
npx amplify push
```

4. **Start development servers:**
```bash
# Frontend
cd frontend
npm start

# ML Services (if using)
cd ml-services
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python api/server.py
```

## 🔐 Environment Variables

Create `.env` files in respective directories:

### Frontend (.env)
```
REACT_APP_API_URL=your-api-gateway-url
REACT_APP_AWS_REGION=us-east-1
REACT_APP_USER_POOL_ID=your-cognito-user-pool-id
REACT_APP_USER_POOL_CLIENT_ID=your-cognito-client-id
REACT_APP_S3_BUCKET=your-s3-bucket-name
```

### Backend (.env)
```
AWS_REGION=us-east-1
DYNAMODB_TABLE_PREFIX=taskflow
SNS_TOPIC_ARN=your-sns-topic-arn
ML_API_ENDPOINT=your-ec2-ml-api-url
```

## 📡 API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh token

### Tasks
- `GET /tasks` - List tasks
- `POST /tasks` - Create task
- `PUT /tasks/{id}` - Update task
- `DELETE /tasks/{id}` - Delete task
- `GET /tasks/kanban` - Get Kanban board data

### Leave Management
- `GET /leave-requests` - List leave requests
- `POST /leave-requests` - Submit leave request
- `PUT /leave-requests/{id}/approve` - Approve leave
- `PUT /leave-requests/{id}/reject` - Reject leave

### File Management
- `POST /files/upload` - Upload file to S3
- `GET /files/{id}` - Get file metadata
- `DELETE /files/{id}` - Delete file

### Users
- `GET /users/profile` - Get user profile
- `PUT /users/profile` - Update profile
- `GET /users/dashboard` - Get dashboard data

### ML Recommendations
- `GET /recommendations/tasks` - Get task recommendations
- `GET /recommendations/resources` - Get resource suggestions

## 🧪 Testing

```bash
# Frontend tests
cd frontend
npm test

# Backend tests
cd backend
npm test

# Integration tests
npm run test:integration
```

## 🚀 Deployment

### Production Deployment
```bash
# Deploy infrastructure
cd infrastructure
cdk deploy --profile production

# Deploy frontend
cd frontend
npm run build
npx amplify publish

# Deploy ML services
cd ml-services
docker build -t taskflow-ml .
# Deploy to EC2 or ECS
```

## 📊 Monitoring and Observability

- **CloudWatch** for logs and metrics
- **X-Ray** for distributed tracing
- **AWS Config** for compliance monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [React Documentation](https://reactjs.org/docs/)
- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
