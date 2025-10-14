# Fix API Gateway CORS Configuration

## Problem
Your Lambda functions have correct CORS headers, but API Gateway is not configured to handle OPTIONS preflight requests. This causes the browser to receive "Missing Authentication Token" for OPTIONS requests.

## Solution 1: Enable CORS in API Gateway Console (Quick Fix)

### Steps:
1. **Go to AWS API Gateway Console**
   - Navigate to your API: `28zq8tmjl8.execute-api.us-east-1.amazonaws.com`

2. **Enable CORS for the /tasks resource:**
   - Select the `/tasks` resource
   - Click **Actions** → **Enable CORS**
   - Configure CORS settings:
     ```
     Access-Control-Allow-Origin: *
     Access-Control-Allow-Headers: Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With
     Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
     ```
   - Click **Enable CORS and replace existing CORS headers**

3. **Deploy the API:**
   - Click **Actions** → **Deploy API**
   - Select deployment stage (usually `dev`)
   - Click **Deploy**

### Verify the fix:
```powershell
# Test OPTIONS request (should return 200)
Invoke-WebRequest -Uri "https://28zq8tmjl8.execute-api.us-east-1.amazonaws.com/dev/tasks" -Method OPTIONS -Headers @{"Origin"="http://localhost:3000"}

# Test GET request (should return your tasks)
Invoke-WebRequest -Uri "https://28zq8tmjl8.execute-api.us-east-1.amazonaws.com/dev/tasks" -Method GET -Headers @{"Origin"="http://localhost:3000"}
```

## Solution 2: Add OPTIONS method to Lambda (If Solution 1 doesn't work)

If API Gateway CORS enablement doesn't work, you need to add an OPTIONS method that routes to your Lambda function:

1. **In API Gateway Console:**
   - Select `/tasks` resource
   - Click **Actions** → **Create Method**
   - Select **OPTIONS** from dropdown
   - Set Integration type to **Lambda Function**
   - Select your Lambda function
   - Click **Save**

2. **Deploy the API again**

## Solution 3: Temporary Workaround (Development Only)

If you can't access AWS Console right now, re-enable the CORS proxy temporarily:

In `frontend/src/services/taskService.ts`:
```typescript
// Temporary workaround - re-enable CORS proxy until API Gateway is fixed
const USE_DEVELOPMENT_CORS_PROXY = true;
```

## Production Notes

- Never use `*` for `Access-Control-Allow-Origin` in production
- Use specific domains like `https://yourdomain.com`
- Consider using AWS Cognito headers if implementing authentication