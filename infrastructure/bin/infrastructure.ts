#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TaskFlowStack } from '../lib/taskflow-stack.js';

const app = new cdk.App();

new TaskFlowStack(app, 'TaskFlowStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'TaskFlow Employee Management System Infrastructure',
});
