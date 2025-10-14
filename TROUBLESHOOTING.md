# API Connection Troubleshooting Guide

## Current Issue: "Failed to load tasks from server"

Your React frontend is unable to connect to the Lambda API. Here are the most likely causes and solutions:

## 1. CORS Configuration (Most Common)

**Problem**: Your API Gateway doesn't allow requests from `http://localhost:3000`

**Solution**: Configure CORS in your API Gateway:

```bash
# If using AWS CLI
aws apigateway put-method-response \
  --rest-api-id YOUR_API_ID \
  --resource-id YOUR_RESOURCE_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters method.response.header.Access-Control-Allow-Origin=true,method.response.header.Access-Control-Allow-Methods=true,method.response.header.Access-Control-Allow-Headers=true
```

**Or in Lambda function**, add these headers to your response:

```javascript
const response = {
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': '*', // or 'http://localhost:3000'
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  },
  body: JSON.stringify(data)
};
```

## 2. API Gateway Not Deployed

**Problem**: You created the API but didn't deploy it

**Solution**: Deploy your API:
```bash
aws apigateway create-deployment \
  --rest-api-id YOUR_API_ID \
  --stage-name dev
```

## 3. Lambda Function Issues

**Problem**: Lambda function is not responding or has errors

**Solution**: Check CloudWatch logs:
```bash
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/your-function-name"
```

## 4. URL/Endpoint Issues

**Current endpoint**: `https://28zq8tmjl8.execute-api.us-east-1.amazonaws.com/dev/tasks`

**Verify**:
- API Gateway ID: `28zq8tmjl8`
- Region: `us-east-1`
- Stage: `dev`
- Resource: `/tasks`

## 5. Quick Test Commands

Test your API directly:

```bash
# Test GET /tasks
curl -X GET "https://28zq8tmjl8.execute-api.us-east-1.amazonaws.com/dev/tasks" \
  -H "Content-Type: application/json" \
  -v

# Test OPTIONS (CORS preflight)
curl -X OPTIONS "https://28zq8tmjl8.execute-api.us-east-1.amazonaws.com/dev/tasks" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

## 6. Temporary Workaround

If you need to bypass CORS for development, you can:

1. **Use a CORS proxy** (temporary):
```javascript
// Update API_BASE_URL in taskService.ts
const API_BASE_URL = 'https://cors-anywhere.herokuapp.com/https://28zq8tmjl8.execute-api.us-east-1.amazonaws.com/dev';
```

2. **Disable CORS in browser** (Chrome):
```bash
chrome.exe --user-data-dir=/tmp/chrome_dev_session --disable-web-security
```

## 7. Frontend Debugging

Open your browser's Developer Tools (F12) and check:

1. **Console tab**: Look for specific error messages
2. **Network tab**: See if the request is being made and what the response is
3. **Application tab**: Check if service workers are interfering

## 8. API Gateway Console Check

1. Go to AWS Console → API Gateway
2. Find your API (`28zq8tmjl8`)
3. Check:
   - Method configuration
   - CORS settings
   - Deployment status
   - Test the endpoint directly from console

## 9. Lambda Function Check

1. Go to AWS Console → Lambda
2. Find your function
3. Check:
   - Function is deployed
   - Environment variables
   - CloudWatch logs for errors
   - Test function directly with sample event

## Expected Error Messages and Solutions

- **"NetworkError"** → CORS or connectivity issue
- **"404 Not Found"** → API not deployed or wrong endpoint
- **"403 Forbidden"** → Authentication/authorization issue
- **"500 Internal Server Error"** → Lambda function error
- **"TypeError: Failed to fetch"** → CORS or network issue

## Next Steps

1. Use the API Tester in your frontend to get specific error details
2. Check the browser console for exact error messages
3. Test the API endpoint directly using curl or Postman
4. Check AWS CloudWatch logs for Lambda function errors
5. Verify API Gateway CORS configuration