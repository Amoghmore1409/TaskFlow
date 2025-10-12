"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskFlowStack = void 0;
const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const s3 = require("aws-cdk-lib/aws-s3");
const sns = require("aws-cdk-lib/aws-sns");
const cognito = require("aws-cdk-lib/aws-cognito");
const iam = require("aws-cdk-lib/aws-iam");
const ec2 = require("aws-cdk-lib/aws-ec2");
class TaskFlowStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        mlSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8000), 'Allow HTTP traffic to ML API');
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
exports.TaskFlowStack = TaskFlowStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFza2Zsb3ctc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ0YXNrZmxvdy1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFDbkMsaURBQWlEO0FBQ2pELHlEQUF5RDtBQUN6RCxxREFBcUQ7QUFDckQseUNBQXlDO0FBQ3pDLDJDQUEyQztBQUMzQyxtREFBbUQ7QUFDbkQsMkNBQTJDO0FBQzNDLDJDQUEyQztBQUczQyxNQUFhLGFBQWMsU0FBUSxHQUFHLENBQUMsS0FBSztJQUMxQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGtCQUFrQjtRQUNsQixNQUFNLFVBQVUsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUN4RCxTQUFTLEVBQUUsZ0JBQWdCO1lBQzNCLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2pFLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCxNQUFNLGtCQUFrQixHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDeEUsU0FBUyxFQUFFLHlCQUF5QjtZQUNwQyxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNqRSxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FB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QUcsQ0FBQyxJQUFJLENBQUMsRUFDbEIsOEJBQThCLENBQy9CLENBQUM7UUFFRiwrREFBK0Q7UUFDL0QsOENBQThDO1FBRTlDLFVBQVU7UUFDVixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRTtZQUNoQyxLQUFLLEVBQUUsR0FBRyxDQUFDLEdBQUc7WUFDZCxXQUFXLEVBQUUsaUJBQWlCO1NBQy9CLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3BDLEtBQUssRUFBRSxRQUFRLENBQUMsVUFBVTtZQUMxQixXQUFXLEVBQUUsc0JBQXNCO1NBQ3BDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDMUMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxnQkFBZ0I7WUFDdEMsV0FBVyxFQUFFLDZCQUE2QjtTQUMzQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN0QyxLQUFLLEVBQUUsYUFBYSxDQUFDLFVBQVU7WUFDL0IsV0FBVyxFQUFFLDRCQUE0QjtTQUMxQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUNyQyxLQUFLLEVBQUUsa0JBQWtCLENBQUMsUUFBUTtZQUNsQyxXQUFXLEVBQUUsaUNBQWlDO1NBQy9DLENBQUMsQ0FBQztRQUVILDJDQUEyQztRQUMzQyx1Q0FBdUM7UUFDdkMsb0JBQW9CO1FBQ3BCLHlDQUF5QztJQUMzQyxDQUFDO0NBQ0Y7QUE5WkQsc0NBOFpDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xyXG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcclxuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcclxuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcclxuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xyXG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcclxuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xyXG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5cclxuZXhwb3J0IGNsYXNzIFRhc2tGbG93U3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIC8vIER5bmFtb0RCIFRhYmxlc1xyXG4gICAgY29uc3QgdGFza3NUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnVGFza3NUYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiAndGFza2Zsb3ctdGFza3MnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGxlYXZlUmVxdWVzdHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnTGVhdmVSZXF1ZXN0c1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICd0YXNrZmxvdy1sZWF2ZS1yZXF1ZXN0cycsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgZmlsZXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnRmlsZXNUYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiAndGFza2Zsb3ctZmlsZXMnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHVzZXJzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1VzZXJzVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogJ3Rhc2tmbG93LXVzZXJzJyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBZGQgR1NJIHRvIHVzZXJzIHRhYmxlXHJcbiAgICB1c2Vyc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnZW1haWwtaW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2VtYWlsJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFMzIEJ1Y2tldCBmb3IgZmlsZSB1cGxvYWRzXHJcbiAgICBjb25zdCB1cGxvYWRzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnVXBsb2Fkc0J1Y2tldCcsIHtcclxuICAgICAgYnVja2V0TmFtZTogYHRhc2tmbG93LXVwbG9hZHMtJHt0aGlzLmFjY291bnR9LSR7dGhpcy5yZWdpb259YCxcclxuICAgICAgY29yczogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5QT1NULCBzMy5IdHRwTWV0aG9kcy5QVVQsIHMzLkh0dHBNZXRob2RzLkRFTEVURV0sXHJcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXHJcbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXHJcbiAgICAgICAgfSxcclxuICAgICAgXSxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTTlMgVG9waWMgZm9yIG5vdGlmaWNhdGlvbnNcclxuICAgIGNvbnN0IG5vdGlmaWNhdGlvbnNUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ05vdGlmaWNhdGlvbnNUb3BpYycsIHtcclxuICAgICAgdG9waWNOYW1lOiAndGFza2Zsb3ctbm90aWZpY2F0aW9ucycsXHJcbiAgICAgIGRpc3BsYXlOYW1lOiAnVGFza0Zsb3cgTm90aWZpY2F0aW9ucycsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBDb2duaXRvIFVzZXIgUG9vbFxyXG4gICAgY29uc3QgdXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbCh0aGlzLCAnVXNlclBvb2wnLCB7XHJcbiAgICAgIHVzZXJQb29sTmFtZTogJ3Rhc2tmbG93LXVzZXJzJyxcclxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IGZhbHNlLFxyXG4gICAgICBzaWduSW5BbGlhc2VzOiB7XHJcbiAgICAgICAgZW1haWw6IHRydWUsXHJcbiAgICAgICAgdXNlcm5hbWU6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICAgIGF1dG9WZXJpZnk6IHtcclxuICAgICAgICBlbWFpbDogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgICAgc3RhbmRhcmRBdHRyaWJ1dGVzOiB7XHJcbiAgICAgICAgZW1haWw6IHtcclxuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxyXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIGdpdmVuTmFtZToge1xyXG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXHJcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZmFtaWx5TmFtZToge1xyXG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXHJcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIGN1c3RvbUF0dHJpYnV0ZXM6IHtcclxuICAgICAgICBkZXBhcnRtZW50OiBuZXcgY29nbml0by5TdHJpbmdBdHRyaWJ1dGUoeyBtdXRhYmxlOiB0cnVlIH0pLFxyXG4gICAgICAgIHJvbGU6IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7IG11dGFibGU6IHRydWUgfSksXHJcbiAgICAgIH0sXHJcbiAgICAgIHBhc3N3b3JkUG9saWN5OiB7XHJcbiAgICAgICAgbWluTGVuZ3RoOiA4LFxyXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXHJcbiAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcclxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxyXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCB1c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KHRoaXMsICdVc2VyUG9vbENsaWVudCcsIHtcclxuICAgICAgdXNlclBvb2wsXHJcbiAgICAgIHVzZXJQb29sQ2xpZW50TmFtZTogJ3Rhc2tmbG93LXdlYi1jbGllbnQnLFxyXG4gICAgICBhdXRoRmxvd3M6IHtcclxuICAgICAgICB1c2VyU3JwOiB0cnVlLFxyXG4gICAgICAgIHVzZXJQYXNzd29yZDogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgICAgZ2VuZXJhdGVTZWNyZXQ6IGZhbHNlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gSUFNIFJvbGUgZm9yIExhbWJkYSBmdW5jdGlvbnNcclxuICAgIGNvbnN0IGxhbWJkYUV4ZWN1dGlvblJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0xhbWJkYUV4ZWN1dGlvblJvbGUnLCB7XHJcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxyXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcclxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcclxuICAgICAgXSxcclxuICAgICAgaW5saW5lUG9saWNpZXM6IHtcclxuICAgICAgICBEeW5hbW9EQkFjY2VzczogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XHJcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXHJcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXHJcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOkdldEl0ZW0nLFxyXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlB1dEl0ZW0nLFxyXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlVwZGF0ZUl0ZW0nLFxyXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOkRlbGV0ZUl0ZW0nLFxyXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlNjYW4nLFxyXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlF1ZXJ5JyxcclxuICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1xyXG4gICAgICAgICAgICAgICAgdGFza3NUYWJsZS50YWJsZUFybixcclxuICAgICAgICAgICAgICAgIGxlYXZlUmVxdWVzdHNUYWJsZS50YWJsZUFybixcclxuICAgICAgICAgICAgICAgIGZpbGVzVGFibGUudGFibGVBcm4sXHJcbiAgICAgICAgICAgICAgICB1c2Vyc1RhYmxlLnRhYmxlQXJuLFxyXG4gICAgICAgICAgICAgICAgYCR7dXNlcnNUYWJsZS50YWJsZUFybn0vaW5kZXgvKmAsXHJcbiAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIFMzQWNjZXNzOiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcclxuICAgICAgICAgIHN0YXRlbWVudHM6IFtcclxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcclxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICAgICAgICAnczM6R2V0T2JqZWN0JyxcclxuICAgICAgICAgICAgICAgICdzMzpQdXRPYmplY3QnLFxyXG4gICAgICAgICAgICAgICAgJ3MzOkRlbGV0ZU9iamVjdCcsXHJcbiAgICAgICAgICAgICAgICAnczM6R2V0T2JqZWN0VmVyc2lvbicsXHJcbiAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtgJHt1cGxvYWRzQnVja2V0LmJ1Y2tldEFybn0vKmBdLFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgU05TQWNjZXNzOiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcclxuICAgICAgICAgIHN0YXRlbWVudHM6IFtcclxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcclxuICAgICAgICAgICAgICBhY3Rpb25zOiBbJ3NuczpQdWJsaXNoJ10sXHJcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbbm90aWZpY2F0aW9uc1RvcGljLnRvcGljQXJuXSxcclxuICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgIH0pLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gTGFtYmRhIExheWVyIGZvciBzaGFyZWQgZGVwZW5kZW5jaWVzXHJcbiAgICBjb25zdCBzaGFyZWRMYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdTaGFyZWRMYXllcicsIHtcclxuICAgICAgbGF5ZXJWZXJzaW9uTmFtZTogJ3Rhc2tmbG93LXNoYXJlZC1sYXllcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC9sYXllcnMvc2hhcmVkJyksXHJcbiAgICAgIGNvbXBhdGlibGVSdW50aW1lczogW2xhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YXSxcclxuICAgICAgZGVzY3JpcHRpb246ICdTaGFyZWQgdXRpbGl0aWVzIGFuZCBkZXBlbmRlbmNpZXMgZm9yIFRhc2tGbG93IExhbWJkYSBmdW5jdGlvbnMnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ29tbW9uIExhbWJkYSBmdW5jdGlvbiBjb25maWd1cmF0aW9uXHJcbiAgICBjb25zdCBsYW1iZGFDb25maWcgPSB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICByb2xlOiBsYW1iZGFFeGVjdXRpb25Sb2xlLFxyXG4gICAgICBsYXllcnM6IFtzaGFyZWRMYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgVEFTS1NfVEFCTEU6IHRhc2tzVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIExFQVZFX1JFUVVFU1RTX1RBQkxFOiBsZWF2ZVJlcXVlc3RzVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIEZJTEVTX1RBQkxFOiBmaWxlc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBVU0VSU19UQUJMRTogdXNlcnNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgUzNfQlVDS0VUOiB1cGxvYWRzQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgICAgU05TX1RPUElDX0FSTjogbm90aWZpY2F0aW9uc1RvcGljLnRvcGljQXJuLFxyXG4gICAgICAgIFVTRVJfUE9PTF9JRDogdXNlclBvb2wudXNlclBvb2xJZCxcclxuICAgICAgfSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBUYXNrIExhbWJkYSBGdW5jdGlvbnNcclxuICAgIGNvbnN0IGxpc3RUYXNrc0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTGlzdFRhc2tzRnVuY3Rpb24nLCB7XHJcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcclxuICAgICAgZnVuY3Rpb25OYW1lOiAndGFza2Zsb3ctbGlzdC10YXNrcycsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC9kaXN0L2xhbWJkYXMvdGFza3MnKSxcclxuICAgICAgaGFuZGxlcjogJ3Rhc2tIYW5kbGVycy5saXN0VGFza3MnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgY3JlYXRlVGFza0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ3JlYXRlVGFza0Z1bmN0aW9uJywge1xyXG4gICAgICAuLi5sYW1iZGFDb25maWcsXHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3Rhc2tmbG93LWNyZWF0ZS10YXNrJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kL2Rpc3QvbGFtYmRhcy90YXNrcycpLFxyXG4gICAgICBoYW5kbGVyOiAndGFza0hhbmRsZXJzLmNyZWF0ZVRhc2snLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgZ2V0VGFza0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0VGFza0Z1bmN0aW9uJywge1xyXG4gICAgICAuLi5sYW1iZGFDb25maWcsXHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3Rhc2tmbG93LWdldC10YXNrJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kL2Rpc3QvbGFtYmRhcy90YXNrcycpLFxyXG4gICAgICBoYW5kbGVyOiAndGFza0hhbmRsZXJzLmdldFRhc2snLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgdXBkYXRlVGFza0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVXBkYXRlVGFza0Z1bmN0aW9uJywge1xyXG4gICAgICAuLi5sYW1iZGFDb25maWcsXHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3Rhc2tmbG93LXVwZGF0ZS10YXNrJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kL2Rpc3QvbGFtYmRhcy90YXNrcycpLFxyXG4gICAgICBoYW5kbGVyOiAndGFza0hhbmRsZXJzLnVwZGF0ZVRhc2snLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgZGVsZXRlVGFza0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRGVsZXRlVGFza0Z1bmN0aW9uJywge1xyXG4gICAgICAuLi5sYW1iZGFDb25maWcsXHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3Rhc2tmbG93LWRlbGV0ZS10YXNrJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kL2Rpc3QvbGFtYmRhcy90YXNrcycpLFxyXG4gICAgICBoYW5kbGVyOiAndGFza0hhbmRsZXJzLmRlbGV0ZVRhc2snLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgZ2V0S2FuYmFuQm9hcmRGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldEthbmJhbkJvYXJkRnVuY3Rpb24nLCB7XHJcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcclxuICAgICAgZnVuY3Rpb25OYW1lOiAndGFza2Zsb3ctZ2V0LWthbmJhbi1ib2FyZCcsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC9kaXN0L2xhbWJkYXMvdGFza3MnKSxcclxuICAgICAgaGFuZGxlcjogJ3Rhc2tIYW5kbGVycy5nZXRLYW5iYW5Cb2FyZCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBMZWF2ZSBSZXF1ZXN0IExhbWJkYSBGdW5jdGlvbnNcclxuICAgIGNvbnN0IGxpc3RMZWF2ZVJlcXVlc3RzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdMaXN0TGVhdmVSZXF1ZXN0c0Z1bmN0aW9uJywge1xyXG4gICAgICAuLi5sYW1iZGFDb25maWcsXHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3Rhc2tmbG93LWxpc3QtbGVhdmUtcmVxdWVzdHMnLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQvZGlzdC9sYW1iZGFzL2xlYXZlJyksXHJcbiAgICAgIGhhbmRsZXI6ICdsZWF2ZUhhbmRsZXJzLmxpc3RMZWF2ZVJlcXVlc3RzJyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHN1Ym1pdExlYXZlUmVxdWVzdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU3VibWl0TGVhdmVSZXF1ZXN0RnVuY3Rpb24nLCB7XHJcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcclxuICAgICAgZnVuY3Rpb25OYW1lOiAndGFza2Zsb3ctc3VibWl0LWxlYXZlLXJlcXVlc3QnLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQvZGlzdC9sYW1iZGFzL2xlYXZlJyksXHJcbiAgICAgIGhhbmRsZXI6ICdsZWF2ZUhhbmRsZXJzLnN1Ym1pdExlYXZlUmVxdWVzdCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBhcHByb3ZlTGVhdmVSZXF1ZXN0RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBcHByb3ZlTGVhdmVSZXF1ZXN0RnVuY3Rpb24nLCB7XHJcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcclxuICAgICAgZnVuY3Rpb25OYW1lOiAndGFza2Zsb3ctYXBwcm92ZS1sZWF2ZS1yZXF1ZXN0JyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kL2Rpc3QvbGFtYmRhcy9sZWF2ZScpLFxyXG4gICAgICBoYW5kbGVyOiAnbGVhdmVIYW5kbGVycy5hcHByb3ZlTGVhdmVSZXF1ZXN0JyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHJlamVjdExlYXZlUmVxdWVzdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUmVqZWN0TGVhdmVSZXF1ZXN0RnVuY3Rpb24nLCB7XHJcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcclxuICAgICAgZnVuY3Rpb25OYW1lOiAndGFza2Zsb3ctcmVqZWN0LWxlYXZlLXJlcXVlc3QnLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQvZGlzdC9sYW1iZGFzL2xlYXZlJyksXHJcbiAgICAgIGhhbmRsZXI6ICdsZWF2ZUhhbmRsZXJzLnJlamVjdExlYXZlUmVxdWVzdCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBGaWxlIE1hbmFnZW1lbnQgTGFtYmRhIEZ1bmN0aW9uc1xyXG4gICAgY29uc3QgZ2VuZXJhdGVVcGxvYWRVcmxGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dlbmVyYXRlVXBsb2FkVXJsRnVuY3Rpb24nLCB7XHJcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcclxuICAgICAgZnVuY3Rpb25OYW1lOiAndGFza2Zsb3ctZ2VuZXJhdGUtdXBsb2FkLXVybCcsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC9kaXN0L2xhbWJkYXMvZmlsZXMnKSxcclxuICAgICAgaGFuZGxlcjogJ2ZpbGVIYW5kbGVycy5nZW5lcmF0ZVVwbG9hZFVybCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBnZXRGaWxlRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHZXRGaWxlRnVuY3Rpb24nLCB7XHJcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcclxuICAgICAgZnVuY3Rpb25OYW1lOiAndGFza2Zsb3ctZ2V0LWZpbGUnLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQvZGlzdC9sYW1iZGFzL2ZpbGVzJyksXHJcbiAgICAgIGhhbmRsZXI6ICdmaWxlSGFuZGxlcnMuZ2V0RmlsZScsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBkZWxldGVGaWxlRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdEZWxldGVGaWxlRnVuY3Rpb24nLCB7XHJcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcclxuICAgICAgZnVuY3Rpb25OYW1lOiAndGFza2Zsb3ctZGVsZXRlLWZpbGUnLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQvZGlzdC9sYW1iZGFzL2ZpbGVzJyksXHJcbiAgICAgIGhhbmRsZXI6ICdmaWxlSGFuZGxlcnMuZGVsZXRlRmlsZScsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBUEkgR2F0ZXdheVxyXG4gICAgY29uc3QgYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnVGFza0Zsb3dBcGknLCB7XHJcbiAgICAgIHJlc3RBcGlOYW1lOiAnVGFza0Zsb3cgQVBJJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdUYXNrRmxvdyBFbXBsb3llZSBNYW5hZ2VtZW50IFN5c3RlbSBBUEknLFxyXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcclxuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcclxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcclxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ1gtQW16LURhdGUnLCAnQXV0aG9yaXphdGlvbicsICdYLUFwaS1LZXknLCAnWC1BbXotU2VjdXJpdHktVG9rZW4nXSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENvZ25pdG8gQXV0aG9yaXplclxyXG4gICAgY29uc3QgY29nbml0b0F1dGhvcml6ZXIgPSBuZXcgYXBpZ2F0ZXdheS5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplcih0aGlzLCAnQ29nbml0b0F1dGhvcml6ZXInLCB7XHJcbiAgICAgIGNvZ25pdG9Vc2VyUG9vbHM6IFt1c2VyUG9vbF0sXHJcbiAgICAgIGF1dGhvcml6ZXJOYW1lOiAnVGFza0Zsb3dBdXRob3JpemVyJyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFQSSBSb3V0ZXNcclxuICAgIFxyXG4gICAgLy8gVGFza3Mgcm91dGVzXHJcbiAgICBjb25zdCB0YXNrc1Jlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3Rhc2tzJyk7XHJcbiAgICB0YXNrc1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obGlzdFRhc2tzRnVuY3Rpb24pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxyXG4gICAgfSk7XHJcbiAgICB0YXNrc1Jlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGNyZWF0ZVRhc2tGdW5jdGlvbiksIHtcclxuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCB0YXNrUmVzb3VyY2UgPSB0YXNrc1Jlc291cmNlLmFkZFJlc291cmNlKCd7aWR9Jyk7XHJcbiAgICB0YXNrUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRUYXNrRnVuY3Rpb24pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxyXG4gICAgfSk7XHJcbiAgICB0YXNrUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1cGRhdGVUYXNrRnVuY3Rpb24pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxyXG4gICAgfSk7XHJcbiAgICB0YXNrUmVzb3VyY2UuYWRkTWV0aG9kKCdERUxFVEUnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihkZWxldGVUYXNrRnVuY3Rpb24pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3Qga2FuYmFuUmVzb3VyY2UgPSB0YXNrc1Jlc291cmNlLmFkZFJlc291cmNlKCdrYW5iYW4nKTtcclxuICAgIGthbmJhblJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0S2FuYmFuQm9hcmRGdW5jdGlvbiksIHtcclxuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBMZWF2ZSByZXF1ZXN0cyByb3V0ZXNcclxuICAgIGNvbnN0IGxlYXZlUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnbGVhdmUtcmVxdWVzdHMnKTtcclxuICAgIGxlYXZlUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihsaXN0TGVhdmVSZXF1ZXN0c0Z1bmN0aW9uKSwge1xyXG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcclxuICAgIH0pO1xyXG4gICAgbGVhdmVSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdWJtaXRMZWF2ZVJlcXVlc3RGdW5jdGlvbiksIHtcclxuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBsZWF2ZVJlcXVlc3RSZXNvdXJjZSA9IGxlYXZlUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tpZH0nKTtcclxuICAgIGNvbnN0IGFwcHJvdmVSZXNvdXJjZSA9IGxlYXZlUmVxdWVzdFJlc291cmNlLmFkZFJlc291cmNlKCdhcHByb3ZlJyk7XHJcbiAgICBhcHByb3ZlUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcHByb3ZlTGVhdmVSZXF1ZXN0RnVuY3Rpb24pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgcmVqZWN0UmVzb3VyY2UgPSBsZWF2ZVJlcXVlc3RSZXNvdXJjZS5hZGRSZXNvdXJjZSgncmVqZWN0Jyk7XHJcbiAgICByZWplY3RSZXNvdXJjZS5hZGRNZXRob2QoJ1BVVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHJlamVjdExlYXZlUmVxdWVzdEZ1bmN0aW9uKSwge1xyXG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEZpbGVzIHJvdXRlc1xyXG4gICAgY29uc3QgZmlsZXNSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCdmaWxlcycpO1xyXG4gICAgY29uc3QgdXBsb2FkUmVzb3VyY2UgPSBmaWxlc1Jlc291cmNlLmFkZFJlc291cmNlKCd1cGxvYWQnKTtcclxuICAgIHVwbG9hZFJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdlbmVyYXRlVXBsb2FkVXJsRnVuY3Rpb24pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgZmlsZVJlc291cmNlID0gZmlsZXNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne2lkfScpO1xyXG4gICAgZmlsZVJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0RmlsZUZ1bmN0aW9uKSwge1xyXG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcclxuICAgIH0pO1xyXG4gICAgZmlsZVJlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZGVsZXRlRmlsZUZ1bmN0aW9uKSwge1xyXG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEVDMiBpbnN0YW5jZSBmb3IgTUwgc2VydmljZXMgKG9wdGlvbmFsKVxyXG4gICAgY29uc3QgdnBjID0gbmV3IGVjMi5WcGModGhpcywgJ1Rhc2tGbG93VnBjJywge1xyXG4gICAgICBtYXhBenM6IDIsXHJcbiAgICAgIG5hdEdhdGV3YXlzOiAxLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgbWxTZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdNTFNlY3VyaXR5R3JvdXAnLCB7XHJcbiAgICAgIHZwYyxcclxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgTUwgQVBJIHNlcnZlcicsXHJcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXHJcbiAgICB9KTtcclxuXHJcbiAgICBtbFNlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUoXHJcbiAgICAgIGVjMi5QZWVyLmFueUlwdjQoKSxcclxuICAgICAgZWMyLlBvcnQudGNwKDgwMDApLFxyXG4gICAgICAnQWxsb3cgSFRUUCB0cmFmZmljIHRvIE1MIEFQSSdcclxuICAgICk7XHJcblxyXG4gICAgLy8gTm90ZTogQW1wbGlmeSBBcHAgY2FuIGJlIHNldCB1cCBtYW51YWxseSB0aHJvdWdoIEFXUyBDb25zb2xlXHJcbiAgICAvLyBvciB1c2luZyBBbXBsaWZ5IENMSSBmb3IgZWFzaWVyIGludGVncmF0aW9uXHJcblxyXG4gICAgLy8gT3V0cHV0c1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaVVybCcsIHtcclxuICAgICAgdmFsdWU6IGFwaS51cmwsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgVVJMJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbElkJywge1xyXG4gICAgICB2YWx1ZTogdXNlclBvb2wudXNlclBvb2xJZCxcclxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBJRCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xDbGllbnRJZCcsIHtcclxuICAgICAgdmFsdWU6IHVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29nbml0byBVc2VyIFBvb2wgQ2xpZW50IElEJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTM0J1Y2tldE5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiB1cGxvYWRzQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgQnVja2V0IGZvciBmaWxlIHVwbG9hZHMnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1NOU1RvcGljQXJuJywge1xyXG4gICAgICB2YWx1ZTogbm90aWZpY2F0aW9uc1RvcGljLnRvcGljQXJuLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1NOUyBUb3BpYyBBUk4gZm9yIG5vdGlmaWNhdGlvbnMnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gTm90ZTogRm9yIGZyb250ZW5kIGhvc3RpbmcsIHlvdSBjYW4gdXNlOlxyXG4gICAgLy8gLSBBV1MgQW1wbGlmeSBDb25zb2xlIChtYW51YWwgc2V0dXApXHJcbiAgICAvLyAtIFMzICsgQ2xvdWRGcm9udFxyXG4gICAgLy8gLSBWZXJjZWwvTmV0bGlmeSBmb3IgZWFzaWVyIGRlcGxveW1lbnRcclxuICB9XHJcbn1cclxuIl19