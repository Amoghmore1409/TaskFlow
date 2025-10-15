import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class TaskFlowStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    const tasksTable = new dynamodb.Table(this, 'TasksTable', {
      tableName: 'taskflow-tasks',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const leaveRequestsTable = new dynamodb.Table(this, 'LeaveRequestsTable', {
      tableName: 'taskflow-leave-requests',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const filesTable = new dynamodb.Table(this, 'FilesTable', {
      tableName: 'taskflow-files',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'taskflow-users',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI to users table
    usersTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
    });

    // S3 Bucket for file uploads
    const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: `taskflow-uploads-${this.account}-${this.region}`,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT, s3.HttpMethods.DELETE],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // SNS Topic for notifications
    const notificationsTopic = new sns.Topic(this, 'NotificationsTopic', {
      topicName: 'taskflow-notifications',
      displayName: 'TaskFlow Notifications',
    });

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'taskflow-users',
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
        username: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        department: new cognito.StringAttribute({ mutable: true }),
        role: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: 'taskflow-web-client',
      authFlows: {
        userSrp: true,
        userPassword: true,
      },
      generateSecret: false,
    });

    // IAM Role for Lambda functions
    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Scan',
                'dynamodb:Query',
              ],
              resources: [
                tasksTable.tableArn,
                leaveRequestsTable.tableArn,
                filesTable.tableArn,
                usersTable.tableArn,
                `${usersTable.tableArn}/index/*`,
              ],
            }),
          ],
        }),
        S3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:GetObjectVersion',
              ],
              resources: [`${uploadsBucket.bucketArn}/*`],
            }),
          ],
        }),
        SNSAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['sns:Publish'],
              resources: [notificationsTopic.topicArn],
            }),
          ],
        }),
      },
    });

    // Lambda Layer for shared dependencies
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      layerVersionName: 'taskflow-shared-layer',
      code: lambda.Code.fromAsset('../backend/layers/shared'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Shared utilities and dependencies for TaskFlow Lambda functions',
    });

    // Common Lambda function configuration
    const lambdaConfig = {
      runtime: lambda.Runtime.NODEJS_18_X,
      role: lambdaExecutionRole,
      layers: [sharedLayer],
      environment: {
        TASKS_TABLE: tasksTable.tableName,
        LEAVE_REQUESTS_TABLE: leaveRequestsTable.tableName,
        FILES_TABLE: filesTable.tableName,
        USERS_TABLE: usersTable.tableName,
        S3_BUCKET: uploadsBucket.bucketName,
        SNS_TOPIC_ARN: notificationsTopic.topicArn,
        USER_POOL_ID: userPool.userPoolId,
      },
      timeout: cdk.Duration.seconds(30),
    };

    // Task Lambda Functions
    const listTasksFunction = new lambda.Function(this, 'ListTasksFunction', {
      ...lambdaConfig,
      functionName: 'taskflow-list-tasks',
      code: lambda.Code.fromAsset('../backend/dist/lambdas/tasks'),
      handler: 'taskHandlers.listTasks',
    });

    const createTaskFunction = new lambda.Function(this, 'CreateTaskFunction', {
      ...lambdaConfig,
      functionName: 'taskflow-create-task',
      code: lambda.Code.fromAsset('../backend/dist/lambdas/tasks'),
      handler: 'taskHandlers.createTask',
    });

    const getTaskFunction = new lambda.Function(this, 'GetTaskFunction', {
      ...lambdaConfig,
      functionName: 'taskflow-get-task',
      code: lambda.Code.fromAsset('../backend/dist/lambdas/tasks'),
      handler: 'taskHandlers.getTask',
    });

    const updateTaskFunction = new lambda.Function(this, 'UpdateTaskFunction', {
      ...lambdaConfig,
      functionName: 'taskflow-update-task',
      code: lambda.Code.fromAsset('../backend/dist/lambdas/tasks'),
      handler: 'taskHandlers.updateTask',
    });

    const deleteTaskFunction = new lambda.Function(this, 'DeleteTaskFunction', {
      ...lambdaConfig,
      functionName: 'taskflow-delete-task',
      code: lambda.Code.fromAsset('../backend/dist/lambdas/tasks'),
      handler: 'taskHandlers.deleteTask',
    });

    const getKanbanBoardFunction = new lambda.Function(this, 'GetKanbanBoardFunction', {
      ...lambdaConfig,
      functionName: 'taskflow-get-kanban-board',
      code: lambda.Code.fromAsset('../backend/dist/lambdas/tasks'),
      handler: 'taskHandlers.getKanbanBoard',
    });

    // Leave Request Lambda Functions
    const listLeaveRequestsFunction = new lambda.Function(this, 'ListLeaveRequestsFunction', {
      ...lambdaConfig,
      functionName: 'taskflow-list-leave-requests',
      code: lambda.Code.fromAsset('../backend/dist/lambdas/leave'),
      handler: 'leaveHandlers.listLeaveRequests',
    });

    const submitLeaveRequestFunction = new lambda.Function(this, 'SubmitLeaveRequestFunction', {
      ...lambdaConfig,
      functionName: 'taskflow-submit-leave-request',
      code: lambda.Code.fromAsset('../backend/dist/lambdas/leave'),
      handler: 'leaveHandlers.submitLeaveRequest',
    });

    const approveLeaveRequestFunction = new lambda.Function(this, 'ApproveLeaveRequestFunction', {
      ...lambdaConfig,
      functionName: 'taskflow-approve-leave-request',
      code: lambda.Code.fromAsset('../backend/dist/lambdas/leave'),
      handler: 'leaveHandlers.approveLeaveRequest',
    });

    const rejectLeaveRequestFunction = new lambda.Function(this, 'RejectLeaveRequestFunction', {
      ...lambdaConfig,
      functionName: 'taskflow-reject-leave-request',
      code: lambda.Code.fromAsset('../backend/dist/lambdas/leave'),
      handler: 'leaveHandlers.rejectLeaveRequest',
    });

    // File Management Lambda Functions
    const generateUploadUrlFunction = new lambda.Function(this, 'GenerateUploadUrlFunction', {
      ...lambdaConfig,
      functionName: 'taskflow-generate-upload-url',
      code: lambda.Code.fromAsset('../backend/dist/lambdas/files'),
      handler: 'fileHandlers.generateUploadUrl',
    });

    const getFileFunction = new lambda.Function(this, 'GetFileFunction', {
      ...lambdaConfig,
      functionName: 'taskflow-get-file',
      code: lambda.Code.fromAsset('../backend/dist/lambdas/files'),
      handler: 'fileHandlers.getFile',
    });

    const deleteFileFunction = new lambda.Function(this, 'DeleteFileFunction', {
      ...lambdaConfig,
      functionName: 'taskflow-delete-file',
      code: lambda.Code.fromAsset('../backend/dist/lambdas/files'),
      handler: 'fileHandlers.deleteFile',
    });

    // User Management Lambda Functions
    const listUsersFunction = new lambda.Function(this, 'ListUsersFunction', {
      ...lambdaConfig,
      functionName: 'taskflow-list-users',
      code: lambda.Code.fromAsset('../backend/dist/lambdas/users'),
      handler: 'userHandlers.listUsers',
    });

    const createUserFunction = new lambda.Function(this, 'CreateUserFunction', {
      ...lambdaConfig,
      functionName: 'taskflow-create-user',
      code: lambda.Code.fromAsset('../backend/dist/lambdas/users'),
      handler: 'userHandlers.createUser',
    });

    const getUserFunction = new lambda.Function(this, 'GetUserFunction', {
      ...lambdaConfig,
      functionName: 'taskflow-get-user',
      code: lambda.Code.fromAsset('../backend/dist/lambdas/users'),
      handler: 'userHandlers.getUser',
    });

    const updateUserFunction = new lambda.Function(this, 'UpdateUserFunction', {
      ...lambdaConfig,
      functionName: 'taskflow-update-user',
      code: lambda.Code.fromAsset('../backend/dist/lambdas/users'),
      handler: 'userHandlers.updateUser',
    });

    const deleteUserFunction = new lambda.Function(this, 'DeleteUserFunction', {
      ...lambdaConfig,
      functionName: 'taskflow-delete-user',
      code: lambda.Code.fromAsset('../backend/dist/lambdas/users'),
      handler: 'userHandlers.deleteUser',
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'TaskFlowApi', {
      restApiName: 'TaskFlow API',
      description: 'TaskFlow Employee Management System API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
    });

    // Cognito Authorizer
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'TaskFlowAuthorizer',
    });

    // API Routes
    
    // Tasks routes
    const tasksResource = api.root.addResource('tasks');
    tasksResource.addMethod('GET', new apigateway.LambdaIntegration(listTasksFunction), {
      authorizer: cognitoAuthorizer,
    });
    tasksResource.addMethod('POST', new apigateway.LambdaIntegration(createTaskFunction), {
      authorizer: cognitoAuthorizer,
    });

    const taskResource = tasksResource.addResource('{id}');
    taskResource.addMethod('GET', new apigateway.LambdaIntegration(getTaskFunction), {
      authorizer: cognitoAuthorizer,
    });
    taskResource.addMethod('PUT', new apigateway.LambdaIntegration(updateTaskFunction), {
      authorizer: cognitoAuthorizer,
    });
    taskResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteTaskFunction), {
      authorizer: cognitoAuthorizer,
    });

    const kanbanResource = tasksResource.addResource('kanban');
    kanbanResource.addMethod('GET', new apigateway.LambdaIntegration(getKanbanBoardFunction), {
      authorizer: cognitoAuthorizer,
    });

    // Leave requests routes
    const leaveResource = api.root.addResource('leave-requests');
    leaveResource.addMethod('GET', new apigateway.LambdaIntegration(listLeaveRequestsFunction), {
      authorizer: cognitoAuthorizer,
    });
    leaveResource.addMethod('POST', new apigateway.LambdaIntegration(submitLeaveRequestFunction), {
      authorizer: cognitoAuthorizer,
    });

    const leaveRequestResource = leaveResource.addResource('{id}');
    const approveResource = leaveRequestResource.addResource('approve');
    approveResource.addMethod('PUT', new apigateway.LambdaIntegration(approveLeaveRequestFunction), {
      authorizer: cognitoAuthorizer,
    });

    const rejectResource = leaveRequestResource.addResource('reject');
    rejectResource.addMethod('PUT', new apigateway.LambdaIntegration(rejectLeaveRequestFunction), {
      authorizer: cognitoAuthorizer,
    });

    // Files routes
    const filesResource = api.root.addResource('files');
    const uploadResource = filesResource.addResource('upload');
    uploadResource.addMethod('POST', new apigateway.LambdaIntegration(generateUploadUrlFunction), {
      authorizer: cognitoAuthorizer,
    });

    const fileResource = filesResource.addResource('{id}');
    fileResource.addMethod('GET', new apigateway.LambdaIntegration(getFileFunction), {
      authorizer: cognitoAuthorizer,
    });
    fileResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteFileFunction), {
      authorizer: cognitoAuthorizer,
    });

    // Users routes
    const usersResource = api.root.addResource('users');
    usersResource.addMethod('GET', new apigateway.LambdaIntegration(listUsersFunction), {
      authorizer: cognitoAuthorizer,
    });
    usersResource.addMethod('POST', new apigateway.LambdaIntegration(createUserFunction), {
      authorizer: cognitoAuthorizer,
    });

    const userResource = usersResource.addResource('{id}');
    userResource.addMethod('GET', new apigateway.LambdaIntegration(getUserFunction), {
      authorizer: cognitoAuthorizer,
    });
    userResource.addMethod('PUT', new apigateway.LambdaIntegration(updateUserFunction), {
      authorizer: cognitoAuthorizer,
    });
    userResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteUserFunction), {
      authorizer: cognitoAuthorizer,
    });

    // EC2 instance for ML services (optional)
    const vpc = new ec2.Vpc(this, 'TaskFlowVpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    const mlSecurityGroup = new ec2.SecurityGroup(this, 'MLSecurityGroup', {
      vpc,
      description: 'Security group for ML API server',
      allowAllOutbound: true,
    });

    mlSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8000),
      'Allow HTTP traffic to ML API'
    );

    // Note: Amplify App can be set up manually through AWS Console
    // or using Amplify CLI for easier integration

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: uploadsBucket.bucketName,
      description: 'S3 Bucket for file uploads',
    });

    new cdk.CfnOutput(this, 'SNSTopicArn', {
      value: notificationsTopic.topicArn,
      description: 'SNS Topic ARN for notifications',
    });

    // Note: For frontend hosting, you can use:
    // - AWS Amplify Console (manual setup)
    // - S3 + CloudFront
    // - Vercel/Netlify for easier deployment
  }
}
