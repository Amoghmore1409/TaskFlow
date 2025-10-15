#!/bin/bash

# Build and deploy the backend with user handlers

echo "🔄 Building backend..."
cd backend
npm run build

echo "🚀 Deploying infrastructure..."
cd ../infrastructure
npm run deploy

echo "✅ Backend built and infrastructure deployed successfully!"
echo "🎯 You can now use the users API endpoints"