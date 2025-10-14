// Test script to verify task creation with CORS proxy
const API_BASE_URL = 'https://28zq8tmjl8.execute-api.us-east-1.amazonaws.com/dev';

const testTaskData = {
  title: 'Test CORS Fix Task',
  description: 'Testing if CORS proxy works for task creation',
  assignedBy: 'test-user-123',
  assignedTo: 'user1',
  status: 'pending',
  dueDate: new Date().toISOString(),
  Task_Complexity: 3,
  Required_Skills: ['Testing', 'CORS', 'API'],
  attachments: []
};

console.log('Testing task creation...');
console.log('Task data:', JSON.stringify(testTaskData, null, 2));

// Test direct API call (will likely fail with CORS)
fetch(`${API_BASE_URL}/tasks`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testTaskData),
})
.then(response => {
  console.log('✅ Direct API call succeeded:', response.status, response.statusText);
  return response.json();
})
.then(data => {
  console.log('✅ Created task:', data);
})
.catch(error => {
  console.log('❌ Direct API call failed (expected CORS error):', error.message);
  
  // Test CORS proxy as fallback
  console.log('\n🔄 Trying CORS proxy fallback...');
  
  const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(`${API_BASE_URL}/tasks`);
  
  fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(testTaskData),
  })
  .then(response => {
    console.log('🟡 CORS proxy response:', response.status, response.statusText);
    return response.json();
  })
  .then(data => {
    console.log('✅ Task created via CORS proxy:', data);
  })
  .catch(proxyError => {
    console.log('❌ CORS proxy also failed:', proxyError.message);
    console.log('\n📋 Next steps:');
    console.log('1. Configure CORS in AWS API Gateway Console');
    console.log('2. Enable CORS for POST method on /tasks resource');
    console.log('3. Deploy the API after CORS configuration');
    console.log('4. See FIX_API_GATEWAY_CORS.md for detailed instructions');
  });
});