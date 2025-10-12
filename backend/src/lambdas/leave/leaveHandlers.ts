import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);
const snsClient = new SNSClient({ region: process.env.AWS_REGION });

const LEAVE_REQUESTS_TABLE = process.env.LEAVE_REQUESTS_TABLE || 'taskflow-leave-requests';
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: 'vacation' | 'sick' | 'personal' | 'emergency';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approverLevels: ApprovalLevel[];
  currentApprovalLevel: number;
  createdAt: string;
  updatedAt: string;
}

interface ApprovalLevel {
  level: number;
  approverId: string;
  approverName: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  approvedAt?: string;
}

// GET /leave-requests - List leave requests
export const listLeaveRequests: APIGatewayProxyHandler = async (event) => {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: LEAVE_REQUESTS_TABLE,
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        requests: result.Items || [],
        count: result.Count || 0,
      }),
    };
  } catch (error) {
    console.error('Error listing leave requests:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Failed to list leave requests' }),
    };
  }
};

// POST /leave-requests - Submit leave request
export const submitLeaveRequest: APIGatewayProxyHandler = async (event) => {
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

    const requestData = JSON.parse(event.body);
    const now = new Date().toISOString();
    
    // Calculate days between start and end date
    const startDate = new Date(requestData.startDate);
    const endDate = new Date(requestData.endDate);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;

    const leaveRequest: LeaveRequest = {
      id: uuidv4(),
      employeeId: requestData.employeeId,
      employeeName: requestData.employeeName,
      leaveType: requestData.leaveType,
      startDate: requestData.startDate,
      endDate: requestData.endDate,
      days,
      reason: requestData.reason,
      status: 'pending',
      approverLevels: requestData.approverLevels || [],
      currentApprovalLevel: 0,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(new PutCommand({
      TableName: LEAVE_REQUESTS_TABLE,
      Item: leaveRequest,
    }));

    // Send notification to first approver
    if (SNS_TOPIC_ARN && leaveRequest.approverLevels.length > 0) {
      await snsClient.send(new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Message: JSON.stringify({
          type: 'leave-request-submitted',
          requestId: leaveRequest.id,
          employeeName: leaveRequest.employeeName,
          approverName: leaveRequest.approverLevels[0].approverName,
        }),
        Subject: 'New Leave Request Submitted',
      }));
    }

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(leaveRequest),
    };
  } catch (error) {
    console.error('Error submitting leave request:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Failed to submit leave request' }),
    };
  }
};

// PUT /leave-requests/{id}/approve - Approve leave request
export const approveLeaveRequest: APIGatewayProxyHandler = async (event) => {
  try {
    const requestId = event.pathParameters?.id;
    if (!requestId || !event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Request ID and body are required' }),
      };
    }

    const { approverId, comments } = JSON.parse(event.body);
    const now = new Date().toISOString();

    // Get current leave request
    const getResult = await docClient.send(new GetCommand({
      TableName: LEAVE_REQUESTS_TABLE,
      Key: { id: requestId },
    }));

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Leave request not found' }),
      };
    }

    const leaveRequest = getResult.Item as LeaveRequest;
    const currentLevel = leaveRequest.currentApprovalLevel;
    
    // Update approval level
    leaveRequest.approverLevels[currentLevel].status = 'approved';
    leaveRequest.approverLevels[currentLevel].comments = comments;
    leaveRequest.approverLevels[currentLevel].approvedAt = now;
    
    // Check if this is the final approval
    const isLastLevel = currentLevel === leaveRequest.approverLevels.length - 1;
    
    if (isLastLevel) {
      leaveRequest.status = 'approved';
    } else {
      leaveRequest.currentApprovalLevel++;
    }
    
    leaveRequest.updatedAt = now;

    await docClient.send(new UpdateCommand({
      TableName: LEAVE_REQUESTS_TABLE,
      Key: { id: requestId },
      UpdateExpression: 'SET #status = :status, #approverLevels = :approverLevels, #currentApprovalLevel = :currentApprovalLevel, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#approverLevels': 'approverLevels',
        '#currentApprovalLevel': 'currentApprovalLevel',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':status': leaveRequest.status,
        ':approverLevels': leaveRequest.approverLevels,
        ':currentApprovalLevel': leaveRequest.currentApprovalLevel,
        ':updatedAt': now,
      },
    }));

    // Send notification
    if (SNS_TOPIC_ARN) {
      const messageType = isLastLevel ? 'leave-request-approved' : 'leave-request-next-approval';
      await snsClient.send(new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Message: JSON.stringify({
          type: messageType,
          requestId: leaveRequest.id,
          employeeName: leaveRequest.employeeName,
          approverName: leaveRequest.approverLevels[currentLevel].approverName,
        }),
        Subject: isLastLevel ? 'Leave Request Approved' : 'Leave Request - Next Approval Needed',
      }));
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Leave request approved successfully' }),
    };
  } catch (error) {
    console.error('Error approving leave request:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Failed to approve leave request' }),
    };
  }
};

// PUT /leave-requests/{id}/reject - Reject leave request
export const rejectLeaveRequest: APIGatewayProxyHandler = async (event) => {
  try {
    const requestId = event.pathParameters?.id;
    if (!requestId || !event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Request ID and body are required' }),
      };
    }

    const { approverId, comments } = JSON.parse(event.body);
    const now = new Date().toISOString();

    await docClient.send(new UpdateCommand({
      TableName: LEAVE_REQUESTS_TABLE,
      Key: { id: requestId },
      UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':status': 'rejected',
        ':updatedAt': now,
      },
    }));

    // Send notification
    if (SNS_TOPIC_ARN) {
      await snsClient.send(new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Message: JSON.stringify({
          type: 'leave-request-rejected',
          requestId,
          reason: comments,
        }),
        Subject: 'Leave Request Rejected',
      }));
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Leave request rejected successfully' }),
    };
  } catch (error) {
    console.error('Error rejecting leave request:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Failed to reject leave request' }),
    };
  }
};
