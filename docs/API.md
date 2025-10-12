# TaskFlow API Documentation

## Base URL
```
https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod
```

## Authentication
All endpoints require a valid JWT token from AWS Cognito in the `Authorization` header:
```
Authorization: Bearer <jwt-token>
```

## Response Format
All responses follow this format:
```json
{
  "success": true,
  "data": {},
  "error": null,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout  
- `POST /auth/refresh` - Refresh authentication token

### Tasks

#### List Tasks
```
GET /tasks
```
**Response:**
```json
{
  "tasks": [
    {
      "id": "uuid",
      "title": "Task Title",
      "description": "Task description",
      "status": "todo|in-progress|review|done",
      "priority": "low|medium|high",
      "assigneeId": "user-id",
      "createdBy": "user-id",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      "dueDate": "2024-01-01",
      "tags": ["tag1", "tag2"]
    }
  ],
  "count": 10
}
```

#### Create Task
```
POST /tasks
```
**Request Body:**
```json
{
  "title": "New Task",
  "description": "Task description",
  "priority": "medium",
  "assigneeId": "user-id",
  "createdBy": "user-id",
  "dueDate": "2024-01-01",
  "tags": ["frontend", "react"]
}
```

#### Get Task
```
GET /tasks/{id}
```

#### Update Task
```
PUT /tasks/{id}
```
**Request Body:**
```json
{
  "title": "Updated Task Title",
  "status": "in-progress",
  "priority": "high"
}
```

#### Delete Task
```
DELETE /tasks/{id}
```

#### Get Kanban Board
```
GET /tasks/kanban
```
**Response:**
```json
{
  "todo": [...tasks],
  "in-progress": [...tasks],
  "review": [...tasks],
  "done": [...tasks]
}
```

### Leave Requests

#### List Leave Requests
```
GET /leave-requests
```
**Response:**
```json
{
  "requests": [
    {
      "id": "uuid",
      "employeeId": "user-id",
      "employeeName": "John Doe",
      "leaveType": "vacation|sick|personal|emergency",
      "startDate": "2024-01-01",
      "endDate": "2024-01-05",
      "days": 5,
      "reason": "Family vacation",
      "status": "pending|approved|rejected",
      "approverLevels": [
        {
          "level": 0,
          "approverId": "manager-id",
          "approverName": "Manager Name",
          "status": "pending|approved|rejected",
          "comments": "Approved for vacation",
          "approvedAt": "2024-01-01T00:00:00Z"
        }
      ],
      "currentApprovalLevel": 0,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 5
}
```

#### Submit Leave Request
```
POST /leave-requests
```
**Request Body:**
```json
{
  "employeeId": "user-id",
  "employeeName": "John Doe",
  "leaveType": "vacation",
  "startDate": "2024-01-01",
  "endDate": "2024-01-05",
  "reason": "Family vacation",
  "approverLevels": [
    {
      "level": 0,
      "approverId": "manager-id",
      "approverName": "Manager Name",
      "status": "pending"
    }
  ]
}
```

#### Approve Leave Request
```
PUT /leave-requests/{id}/approve
```
**Request Body:**
```json
{
  "approverId": "manager-id",
  "comments": "Approved for vacation"
}
```

#### Reject Leave Request
```
PUT /leave-requests/{id}/reject
```
**Request Body:**
```json
{
  "approverId": "manager-id",
  "comments": "Cannot approve due to project deadlines"
}
```

### File Management

#### Generate Upload URL
```
POST /files/upload
```
**Request Body:**
```json
{
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "mimeType": "application/pdf",
  "uploadedBy": "user-id",
  "taskId": "task-id",
  "leaveRequestId": "leave-request-id"
}
```
**Response:**
```json
{
  "fileId": "uuid",
  "uploadUrl": "https://s3-presigned-url",
  "metadata": {
    "id": "uuid",
    "fileName": "document.pdf",
    "fileSize": 1024000,
    "mimeType": "application/pdf",
    "uploadedBy": "user-id",
    "uploadedAt": "2024-01-01T00:00:00Z",
    "s3Key": "uploads/user-id/uuid.pdf",
    "s3Bucket": "taskflow-uploads",
    "taskId": "task-id"
  }
}
```

#### Get File
```
GET /files/{id}
```
**Response:**
```json
{
  "metadata": {
    "id": "uuid",
    "fileName": "document.pdf",
    "fileSize": 1024000,
    "mimeType": "application/pdf",
    "uploadedBy": "user-id",
    "uploadedAt": "2024-01-01T00:00:00Z"
  },
  "downloadUrl": "https://s3-presigned-download-url"
}
```

#### Delete File
```
DELETE /files/{id}
```

### User Management

#### Get User Profile
```
GET /users/profile
```
**Response:**
```json
{
  "id": "user-id",
  "username": "john.doe",
  "email": "john.doe@company.com",
  "name": "John Doe",
  "role": "admin|manager|employee",
  "department": "Engineering",
  "skills": ["JavaScript", "React", "AWS"],
  "manager": "manager-id",
  "directReports": ["employee1-id", "employee2-id"],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### Update User Profile
```
PUT /users/profile
```
**Request Body:**
```json
{
  "name": "John Smith",
  "department": "Product",
  "skills": ["JavaScript", "React", "AWS", "Node.js"]
}
```

#### Get Dashboard Data
```
GET /users/dashboard
```
**Response:**
```json
{
  "stats": {
    "activeTasks": 5,
    "completedTasks": 12,
    "pendingLeaveRequests": 1,
    "approvedLeaveRequests": 3
  },
  "recentTasks": [...tasks],
  "upcomingDeadlines": [...tasks],
  "recentLeaveRequests": [...requests],
  "notifications": [
    {
      "id": "notification-id",
      "type": "task_assigned|leave_approved|deadline_reminder",
      "title": "New Task Assigned",
      "message": "You have been assigned a new task",
      "read": false,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### ML Recommendations

#### Get Task Recommendations
```
GET /recommendations/tasks?userId={userId}&limit=5
```
**Response:**
```json
{
  "recommendations": [
    {
      "taskId": "task-id",
      "title": "Implement user authentication",
      "score": 0.85,
      "reason": "Recommended because it matches your skills and high priority task."
    }
  ]
}
```

#### Get Resource Recommendations
```
GET /recommendations/resources?userId={userId}&limit=5
```
**Response:**
```json
{
  "recommendations": [
    {
      "type": "colleague|training|tool",
      "name": "Senior Developer",
      "reason": "Collaborate on high-priority task: API Development",
      "priority": "high|medium|low"
    }
  ]
}
```

### Notifications

#### List Notifications
```
GET /notifications
```

#### Mark Notification as Read
```
PUT /notifications/{id}/read
```

#### Send Notification
```
POST /notifications
```
**Request Body:**
```json
{
  "userId": "user-id",
  "type": "task_assigned",
  "title": "New Task Assigned",
  "message": "You have been assigned a new task",
  "data": {
    "taskId": "task-id"
  }
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Rate Limiting

- **Requests per minute**: 1000 per authenticated user
- **Burst limit**: 2000 requests
- **File upload limit**: 100MB per file
- **Concurrent uploads**: 5 per user

## WebSocket Events (Optional)

For real-time notifications:

```javascript
// Connect to WebSocket
const ws = new WebSocket('wss://your-websocket-url');

// Listen for events
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle notification, task update, etc.
};
```

## Integration Endpoints

### Google Calendar
- `POST /integrations/google/auth` - Start OAuth flow
- `POST /integrations/google/callback` - Handle OAuth callback
- `POST /integrations/google/sync-leave` - Sync leave request to calendar

### Slack
- `POST /integrations/slack/notify` - Send Slack notification
- `POST /integrations/slack/auth` - Start Slack OAuth flow
- `GET /integrations/slack/channels` - List available channels

## SDK Examples

### JavaScript/TypeScript
```javascript
// Configure API client
const apiClient = new TaskFlowAPI({
  baseURL: 'https://your-api-url',
  auth: {
    token: 'your-jwt-token'
  }
});

// Create a task
const task = await apiClient.tasks.create({
  title: 'New Feature',
  description: 'Implement new feature',
  priority: 'high',
  assigneeId: 'user-123'
});

// Get recommendations
const recommendations = await apiClient.recommendations.getTasks('user-123');
```

### Python
```python
import requests

# Create task
response = requests.post(
    'https://your-api-url/tasks',
    headers={'Authorization': f'Bearer {jwt_token}'},
    json={
        'title': 'New Feature',
        'description': 'Implement new feature',
        'priority': 'high',
        'assigneeId': 'user-123'
    }
)
task = response.json()
```

## Testing

### Postman Collection
Import the provided Postman collection for easy API testing.

### cURL Examples
```bash
# Login
curl -X POST https://your-api-url/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user@example.com","password":"password"}'

# Create task
curl -X POST https://your-api-url/tasks \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Task","description":"Test description","priority":"medium"}'
```
