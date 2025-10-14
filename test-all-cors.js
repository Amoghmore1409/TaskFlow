#!/usr/bin/env node
// Comprehensive CORS Test - All HTTP Methods
// Tests all methods that TaskFlow uses: GET, POST, PUT, DELETE, OPTIONS

const API_BASE_URL = 'https://28zq8tmjl8.execute-api.us-east-1.amazonaws.com/dev';

async function testAllMethods() {
  console.log('🔧 Testing ALL HTTP Methods for CORS...\n');
  
  const methods = [
    { method: 'GET', url: `${API_BASE_URL}/tasks`, hasBody: false },
    { method: 'POST', url: `${API_BASE_URL}/tasks`, hasBody: true },
    { method: 'PUT', url: `${API_BASE_URL}/tasks/test-id`, hasBody: true },
    { method: 'DELETE', url: `${API_BASE_URL}/tasks/test-id`, hasBody: false },
  ];
  
  for (const testCase of methods) {
    console.log(`🧪 Testing ${testCase.method} method...`);
    
    try {
      // First test OPTIONS preflight for this method
      console.log(`   📋 OPTIONS preflight for ${testCase.method}...`);
      const optionsResponse = await fetch(testCase.url, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': testCase.method,
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });
      
      if (!optionsResponse.ok) {
        console.log(`   ❌ OPTIONS failed for ${testCase.method}: ${optionsResponse.status}`);
        const errorText = await optionsResponse.text();
        console.log(`   Error: ${errorText}`);
        continue;
      }
      
      console.log(`   ✅ OPTIONS successful for ${testCase.method}`);
      
      // Then test the actual method
      console.log(`   📡 Testing actual ${testCase.method} request...`);
      
      const requestOptions = {
        method: testCase.method,
        headers: {
          'Origin': 'http://localhost:3000',
          'Content-Type': 'application/json'
        }
      };
      
      if (testCase.hasBody) {
        requestOptions.body = JSON.stringify({
          title: 'Test Task',
          description: 'Test Description',
          assignedBy: 'test-user',
          status: 'pending',
          dueDate: new Date().toISOString(),
          Task_Complexity: 1,
          Required_Skills: ['Testing']
        });
      }
      
      const actualResponse = await fetch(testCase.url, requestOptions);
      
      if (actualResponse.ok) {
        console.log(`   ✅ ${testCase.method} request successful!`);
      } else {
        console.log(`   ⚠️  ${testCase.method} request failed: ${actualResponse.status} (but CORS might still be OK)`);
        if (testCase.method === 'PUT' || testCase.method === 'DELETE') {
          console.log(`   ℹ️  404/400 errors for PUT/DELETE are normal if the resource doesn't exist`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ ${testCase.method} CORS failed: ${error.message}`);
      
      if (error.message.includes('CORS') || error.message.includes('fetch')) {
        console.log(`   🔧 CORS not configured for ${testCase.method} method`);
      }
    }
    
    console.log(''); // Empty line for readability
  }
  
  console.log('🎯 CORS Test Complete');
  console.log('');
  console.log('💡 If any method shows CORS failures:');
  console.log('   1. Go to AWS API Gateway Console');
  console.log('   2. Select your API and /tasks resource');
  console.log('   3. Actions → Enable CORS');
  console.log('   4. Ensure ALL methods (GET,POST,PUT,DELETE,OPTIONS) are enabled');
  console.log('   5. Actions → Deploy API to dev stage');
}

// Run the comprehensive test
testAllMethods();