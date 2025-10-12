import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const TASKS_TABLE = process.env.TASKS_TABLE || 'taskflow-tasks';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  assigneeId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  tags: string[];
}

// GET /tasks - List all tasks
export const listTasks: APIGatewayProxyHandler = async (event) => {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TASKS_TABLE,
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        tasks: result.Items || [],
        count: result.Count || 0,
      }),
    };
  } catch (error) {
    console.error('Error listing tasks:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Task ID is required' }),
      };
    }

    const result = await docClient.send(new GetCommand({
      TableName: TASKS_TABLE,
      Key: { id: taskId },
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Task not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result.Item),
    };
  } catch (error) {
    console.error('Error getting task:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const taskData = JSON.parse(event.body);
    const now = new Date().toISOString();
    
    const task: Task = {
      id: uuidv4(),
      title: taskData.title,
      description: taskData.description || '',
      status: taskData.status || 'todo',
      priority: taskData.priority || 'medium',
      assigneeId: taskData.assigneeId,
      createdBy: taskData.createdBy,
      createdAt: now,
      updatedAt: now,
      dueDate: taskData.dueDate,
      tags: taskData.tags || [],
    };

    await docClient.send(new PutCommand({
      TableName: TASKS_TABLE,
      Item: task,
    }));

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(task),
    };
  } catch (error) {
    console.error('Error creating task:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
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
      if (key !== 'id' && key !== 'createdAt') {
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
      Key: { id: taskId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Task updated successfully' }),
    };
  } catch (error) {
    console.error('Error updating task:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Task ID is required' }),
      };
    }

    await docClient.send(new DeleteCommand({
      TableName: TASKS_TABLE,
      Key: { id: taskId },
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Task deleted successfully' }),
    };
  } catch (error) {
    console.error('Error deleting task:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
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
      todo: tasks.filter(task => task.status === 'todo'),
      'in-progress': tasks.filter(task => task.status === 'in-progress'),
      review: tasks.filter(task => task.status === 'review'),
      done: tasks.filter(task => task.status === 'done'),
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(kanbanData),
    };
  } catch (error) {
    console.error('Error getting kanban board:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Failed to get kanban board' }),
    };
  }
};
