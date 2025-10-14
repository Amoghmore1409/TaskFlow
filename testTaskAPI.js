// Test script to demonstrate API integration
// Run this script with: node testTaskAPI.js

const API_BASE_URL = 'https://28zq8tmjl8.execute-api.us-east-1.amazonaws.com/dev';

// Test data matching your curl example
const testTaskData = {
  "title": "Deploy New User Authentication Service",
  "description": "Update the legacy login system to use Cognito and JWT for enhanced security. Includes front-end and back-end changes.",
  "assignedBy": "user-manager-12345",
  "assignedTo": "user-dev-67890",
  "status": "pending",
  "dueDate": "2025-10-31T23:59:59Z",
  "Task_Complexity": 4,
  "Required_Skills": [
    "Python",
    "AWS Cognito",
    "React",
    "DynamoDB"
  ],
  "attachments": [
    "s3://project-docs-bucket/auth-service-specs.pdf",
    "s3://project-docs-bucket/api-design-v1.2.docx"
  ]
};

async function testAPI() {
  console.log('Testing TaskFlow API Integration...\n');

  try {
    // Test 1: Create a new task
    console.log('1. Creating a new task...');
    const createResponse = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testTaskData),
    });

    if (createResponse.ok) {
      const createdTask = await createResponse.json();
      console.log('✅ Task created successfully:', createdTask.taskId);
      
      // Test 2: Get all tasks
      console.log('\n2. Fetching all tasks...');
      const getAllResponse = await fetch(`${API_BASE_URL}/tasks`);
      
      if (getAllResponse.ok) {
        const allTasks = await getAllResponse.json();
        console.log(`✅ Retrieved ${allTasks.length} tasks`);
        
        // Test 3: Update task status
        console.log('\n3. Updating task status...');
        const updateResponse = await fetch(`${API_BASE_URL}/tasks/${createdTask.taskId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            taskId: createdTask.taskId,
            status: 'in-progress',
            updatedAt: new Date().toISOString(),
          }),
        });

        if (updateResponse.ok) {
          const updatedTask = await updateResponse.json();
          console.log('✅ Task status updated to:', updatedTask.status);
        } else {
          console.log('❌ Failed to update task status:', updateResponse.statusText);
        }

        // Test 4: Get specific task
        console.log('\n4. Fetching specific task...');
        const getTaskResponse = await fetch(`${API_BASE_URL}/tasks/${createdTask.taskId}`);
        
        if (getTaskResponse.ok) {
          const specificTask = await getTaskResponse.json();
          console.log('✅ Retrieved specific task:', specificTask.title);
        } else {
          console.log('❌ Failed to get specific task:', getTaskResponse.statusText);
        }

      } else {
        console.log('❌ Failed to get all tasks:', getAllResponse.statusText);
      }
    } else {
      const errorText = await createResponse.text();
      console.log('❌ Failed to create task:', createResponse.statusText, errorText);
    }

  } catch (error) {
    console.error('❌ API Test Error:', error.message);
  }

  console.log('\n🔧 API Integration Complete!');
  console.log('\nNext steps:');
  console.log('- Run "npm start" in the frontend directory');
  console.log('- Open http://localhost:3000 in your browser');
  console.log('- Create, edit, and manage tasks through the UI');
  console.log('- All operations will now use your Lambda API backend');
}

testAPI();