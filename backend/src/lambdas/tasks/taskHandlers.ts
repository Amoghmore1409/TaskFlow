import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const TASKS_TABLE = process.env.TASKS_TABLE || 'taskflow-tasks';

// Common CORS headers
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
  'Access-Control-Max-Age': '86400'
};

interface Task {
  taskId: string; // Primary Key
  title: string;
  description: string;
  assignedBy: string; // userId of the manager who created the task
  assignedTo?: string; // userId of the user assigned (if already chosen)
  status: 'pending' | 'in-progress' | 'completed';
  dueDate: string; // ISO 8601 format
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  Task_Complexity: number; // 1–5 scale complexity score
  Required_Skills: string[]; // e.g., ["Python", "SQL", "AWS"]
  attachments?: string[]; // (Optional) S3 file URLs
}

// GET /tasks - List all tasks
export const listTasks: APIGatewayProxyHandler = async (event) => {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TASKS_TABLE,
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        tasks: result.Items || [],
        count: result.Count || 0,
      }),
    };
  } catch (error) {
    console.error('Error listing tasks:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to list tasks' }),
    };
  }
};

// GET /tasks/{id} - Get task by ID
export const getTask: APIGatewayProxyHandler = async (event) => {
  try {
    const taskId = event.pathParameters?.id;
    if (!taskId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Task ID is required' }),
      };
    }

    const result = await docClient.send(new GetCommand({
      TableName: TASKS_TABLE,
      Key: { taskId: taskId },
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Task not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result.Item),
    };
  } catch (error) {
    console.error('Error getting task:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get task' }),
    };
  }
};

// POST /tasks - Create new task
export const createTask: APIGatewayProxyHandler = async (event) => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const taskData = JSON.parse(event.body);
    const now = new Date().toISOString();
    
    const task: Task = {
      taskId: uuidv4(),
      title: taskData.title,
      description: taskData.description || '',
      status: taskData.status || 'pending',
      assignedBy: taskData.assignedBy,
      assignedTo: taskData.assignedTo,
      createdAt: now,
      updatedAt: now,
      dueDate: taskData.dueDate || now,
      Task_Complexity: taskData.Task_Complexity || 1,
      Required_Skills: taskData.Required_Skills || [],
      attachments: taskData.attachments || [],
    };

    await docClient.send(new PutCommand({
      TableName: TASKS_TABLE,
      Item: task,
    }));

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify(task),
    };
  } catch (error) {
    console.error('Error creating task:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to create task' }),
    };
  }
};

// PUT /tasks/{id} - Update task
export const updateTask: APIGatewayProxyHandler = async (event) => {
  try {
    const taskId = event.pathParameters?.id;
    if (!taskId || !event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Task ID and request body are required' }),
      };
    }

    const updates = JSON.parse(event.body);
    const now = new Date().toISOString();

    const updateExpression = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Build dynamic update expression
    Object.keys(updates).forEach((key, index) => {
      if (key !== 'taskId' && key !== 'createdAt') {
        const attributeName = `#attr${index}`;
        const attributeValue = `:val${index}`;
        
        updateExpression.push(`${attributeName} = ${attributeValue}`);
        expressionAttributeNames[attributeName] = key;
        expressionAttributeValues[attributeValue] = updates[key];
      }
    });

    // Always update the updatedAt timestamp
    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = now;

    await docClient.send(new UpdateCommand({
      TableName: TASKS_TABLE,
      Key: { taskId: taskId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Task updated successfully' }),
    };
  } catch (error) {
    console.error('Error updating task:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update task' }),
    };
  }
};

// DELETE /tasks/{id} - Delete task
export const deleteTask: APIGatewayProxyHandler = async (event) => {
  try {
    const taskId = event.pathParameters?.id;
    if (!taskId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Task ID is required' }),
      };
    }

    await docClient.send(new DeleteCommand({
      TableName: TASKS_TABLE,
      Key: { taskId: taskId },
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Task deleted successfully' }),
    };
  } catch (error) {
    console.error('Error deleting task:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to delete task' }),
    };
  }
};

// GET /tasks/kanban - Get tasks organized for Kanban board
export const getKanbanBoard: APIGatewayProxyHandler = async (event) => {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TASKS_TABLE,
    }));

    const tasks = result.Items || [];
    
    // Organize tasks by status
    const kanbanData = {
      pending: tasks.filter(task => task.status === 'pending'),
      'in-progress': tasks.filter(task => task.status === 'in-progress'),
      completed: tasks.filter(task => task.status === 'completed'),
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(kanbanData),
    };
  } catch (error) {
    console.error('Error getting kanban board:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get kanban board' }),
    };
  }
};

// OPTIONS - Handle preflight requests for CORS
export const handleOptions: APIGatewayProxyHandler = async (event) => {
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: '',
  };
};
