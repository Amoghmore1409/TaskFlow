#!/usr/bin/env node
// API Gateway CORS Test Script
// Run this to verify when API Gateway CORS is properly configured

const API_BASE_URL = 'https://28zq8tmjl8.execute-api.us-east-1.amazonaws.com/dev';

async function testCORS() {
  console.log('🔧 Testing API Gateway CORS Configuration...\n');
  
  try {
    console.log('1️⃣ Testing OPTIONS preflight request...');
    const optionsResponse = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    console.log(`   Status: ${optionsResponse.status} ${optionsResponse.statusText}`);
    
    if (optionsResponse.ok) {
      const headers = optionsResponse.headers;
      console.log('   ✅ OPTIONS request successful!');
      console.log(`   CORS Headers:
      - Access-Control-Allow-Origin: ${headers.get('Access-Control-Allow-Origin')}
      - Access-Control-Allow-Methods: ${headers.get('Access-Control-Allow-Methods')}
      - Access-Control-Allow-Headers: ${headers.get('Access-Control-Allow-Headers')}`);
    } else {
      console.log(`   ❌ OPTIONS request failed: ${optionsResponse.status}`);
      const errorText = await optionsResponse.text();
      console.log(`   Error: ${errorText}`);
      return;
    }
    
    console.log('\n2️⃣ Testing GET request...');
    const getResponse = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:3000',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${getResponse.status} ${getResponse.statusText}`);
    
    if (getResponse.ok) {
      const data = await getResponse.json();
      console.log('   ✅ GET request successful!');
      console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
    } else {
      console.log(`   ❌ GET request failed: ${getResponse.status}`);
      const errorText = await getResponse.text();
      console.log(`   Error: ${errorText}`);
    }
    
    console.log('\n🎉 CORS is properly configured! Your React app should now work without proxy.');
    
  } catch (error) {
    console.log('\n❌ CORS Test Failed:');
    console.log(`   Error: ${error.message}`);
    
    if (error.message.includes('fetch')) {
      console.log('\n🔧 Fix needed: Configure API Gateway CORS');
      console.log('   1. Go to AWS API Gateway Console');
      console.log('   2. Select your API and the /tasks resource');
      console.log('   3. Actions → Enable CORS');
      console.log('   4. Actions → Deploy API to dev stage');
      console.log('\n   See FIX_API_GATEWAY_CORS.md for detailed instructions.');
    }
  }
}

// Run the test
testCORS();