import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { TaskService } from '../services/taskService';

const APITester: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  const testAPI = async () => {
    setLoading(true);
    setResult('');
    setError('');

    try {
      console.log('Testing API connection...');
      
      // Test basic connectivity
      const response = await fetch('https://28zq8tmjl8.execute-api.us-east-1.amazonaws.com/dev/tasks', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Direct fetch response:', response);
      
      if (response.ok) {
        const data = await response.text();
        setResult(`✅ API Connection Successful!\nStatus: ${response.status}\nResponse: ${data}`);
      } else {
        setError(`❌ API returned error: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      console.error('API Test Error:', err);
      if (err instanceof Error) {
        if (err.message.includes('CORS')) {
          setError(`❌ CORS Error: ${err.message}\n\nThis usually means the API needs to allow requests from http://localhost:3000`);
        } else if (err.message.includes('NetworkError') || err.message.includes('fetch')) {
          setError(`❌ Network Error: ${err.message}\n\nPossible causes:\n- API endpoint is not accessible\n- API is not running\n- Network connectivity issues`);
        } else {
          setError(`❌ Unknown Error: ${err.message}`);
        }
      } else {
        setError(`❌ Unknown Error: ${String(err)}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const testTaskService = async () => {
    setLoading(true);
    setResult('');
    setError('');

    try {
      console.log('Testing TaskService...');
      const tasks = await TaskService.getAllTasks();
      setResult(`✅ TaskService works!\nFound ${Array.isArray(tasks) ? tasks.length : 0} tasks: ${JSON.stringify(tasks, null, 2)}`);
    } catch (err) {
      console.error('TaskService Test Error:', err);
      setError(`❌ TaskService Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const testCreateTask = async () => {
    setLoading(true);
    setResult('');
    setError('');

    const testTask = {
      title: 'Test Task from Frontend',
      description: 'This is a test task created from the React frontend',
      assignedBy: 'test-user-123',
      assignedTo: 'test-assignee-456',
      status: 'pending' as const,
      dueDate: '2025-10-31T23:59:59Z',
      Task_Complexity: 3,
      Required_Skills: ['React', 'Testing'],
      attachments: [],
    };

    try {
      console.log('Testing task creation...');
      const createdTask = await TaskService.createTask(testTask);
      setResult(`✅ Task Created Successfully!\nTask ID: ${createdTask.taskId}\nResponse: ${JSON.stringify(createdTask, null, 2)}`);
    } catch (err) {
      console.error('Create Task Test Error:', err);
      setError(`❌ Create Task Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ m: 2, p: 2 }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          🔧 API Connection Tester
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Button 
            variant="contained" 
            onClick={testAPI} 
            disabled={loading}
            size="small"
          >
            Test Direct API
          </Button>
          <Button 
            variant="contained" 
            onClick={testTaskService} 
            disabled={loading}
            size="small"
          >
            Test TaskService
          </Button>
          <Button 
            variant="contained" 
            onClick={testCreateTask} 
            disabled={loading}
            size="small"
          >
            Test Create Task
          </Button>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <CircularProgress size={20} />
            <Typography>Testing API...</Typography>
          </Box>
        )}

        {result && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
              {result}
            </Typography>
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
              {error}
            </Typography>
          </Alert>
        )}

        <Divider sx={{ my: 2 }} />
        
        <Typography variant="body2" color="textSecondary">
          <strong>API Endpoint:</strong> https://28zq8tmjl8.execute-api.us-east-1.amazonaws.com/dev/tasks
        </Typography>
        
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          <strong>Expected Issues:</strong>
        </Typography>
        <ul>
          <li><Typography variant="body2" color="textSecondary">CORS not configured for localhost:3000</Typography></li>
          <li><Typography variant="body2" color="textSecondary">API Gateway not deployed</Typography></li>
          <li><Typography variant="body2" color="textSecondary">Lambda function not responding</Typography></li>
          <li><Typography variant="body2" color="textSecondary">Network connectivity issues</Typography></li>
        </ul>
      </CardContent>
    </Card>
  );
};

export default APITester;