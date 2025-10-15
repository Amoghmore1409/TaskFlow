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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFza2Zsb3ctc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ0YXNrZmxvdy1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFDbkMsaURBQWlEO0FBQ2pELHlEQUF5RDtBQUN6RCxxREFBcUQ7QUFDckQseUNBQXlDO0FBQ3pDLDJDQUEyQztBQUMzQyxtREFBbUQ7QUFDbkQsMkNBQTJDO0FBQzNDLDJDQUEyQztBQUczQyxNQUFhLGFBQWMsU0FBUSxHQUFHLENBQUMsS0FBSztJQUMxQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGtCQUFrQjtRQUNsQixNQUFNLFVBQVUsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUN4RCxTQUFTLEVBQUUsZ0JBQWdCO1lBQzNCLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2pFLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCxNQUFNLGtCQUFrQixHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDeEUsU0FBUyxFQUFFLHlCQUF5QjtZQUNwQyxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNqRSxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FB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QUErRDtRQUMvRCw4Q0FBOEM7UUFFOUMsVUFBVTtRQUNWLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFO1lBQ2hDLEtBQUssRUFBRSxHQUFHLENBQUMsR0FBRztZQUNkLFdBQVcsRUFBRSxpQkFBaUI7U0FDL0IsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDcEMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxVQUFVO1lBQzFCLFdBQVcsRUFBRSxzQkFBc0I7U0FDcEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsY0FBYyxDQUFDLGdCQUFnQjtZQUN0QyxXQUFXLEVBQUUsNkJBQTZCO1NBQzNDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3RDLEtBQUssRUFBRSxhQUFhLENBQUMsVUFBVTtZQUMvQixXQUFXLEVBQUUsNEJBQTRCO1NBQzFDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3JDLEtBQUssRUFBRSxrQkFBa0IsQ0FBQyxRQUFRO1lBQ2xDLFdBQVcsRUFBRSxpQ0FBaUM7U0FDL0MsQ0FBQyxDQUFDO1FBRUgsMkNBQTJDO1FBQzNDLHVDQUF1QztRQUN2QyxvQkFBb0I7UUFDcEIseUNBQXlDO0lBQzNDLENBQUM7Q0FDRjtBQXRkRCxzQ0FzZEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XHJcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xyXG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xyXG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xyXG5pbXBvcnQgKiBhcyBzbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucyc7XHJcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xyXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XHJcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XHJcblxyXG5leHBvcnQgY2xhc3MgVGFza0Zsb3dTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xyXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcblxyXG4gICAgLy8gRHluYW1vREIgVGFibGVzXHJcbiAgICBjb25zdCB0YXNrc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdUYXNrc1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICd0YXNrZmxvdy10YXNrcycsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgbGVhdmVSZXF1ZXN0c1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdMZWF2ZVJlcXVlc3RzVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogJ3Rhc2tmbG93LWxlYXZlLXJlcXVlc3RzJyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBmaWxlc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdGaWxlc1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICd0YXNrZmxvdy1maWxlcycsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgdXNlcnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnVXNlcnNUYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiAndGFza2Zsb3ctdXNlcnMnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFkZCBHU0kgdG8gdXNlcnMgdGFibGVcclxuICAgIHVzZXJzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdlbWFpbC1pbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZW1haWwnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gUzMgQnVja2V0IGZvciBmaWxlIHVwbG9hZHNcclxuICAgIGNvbnN0IHVwbG9hZHNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdVcGxvYWRzQnVja2V0Jywge1xyXG4gICAgICBidWNrZXROYW1lOiBgdGFza2Zsb3ctdXBsb2Fkcy0ke3RoaXMuYWNjb3VudH0tJHt0aGlzLnJlZ2lvbn1gLFxyXG4gICAgICBjb3JzOiBbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtzMy5IdHRwTWV0aG9kcy5HRVQsIHMzLkh0dHBNZXRob2RzLlBPU1QsIHMzLkh0dHBNZXRob2RzLlBVVCwgczMuSHR0cE1ldGhvZHMuREVMRVRFXSxcclxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcclxuICAgICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcclxuICAgICAgICB9LFxyXG4gICAgICBdLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFNOUyBUb3BpYyBmb3Igbm90aWZpY2F0aW9uc1xyXG4gICAgY29uc3Qgbm90aWZpY2F0aW9uc1RvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnTm90aWZpY2F0aW9uc1RvcGljJywge1xyXG4gICAgICB0b3BpY05hbWU6ICd0YXNrZmxvdy1ub3RpZmljYXRpb25zJyxcclxuICAgICAgZGlzcGxheU5hbWU6ICdUYXNrRmxvdyBOb3RpZmljYXRpb25zJyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENvZ25pdG8gVXNlciBQb29sXHJcbiAgICBjb25zdCB1c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdVc2VyUG9vbCcsIHtcclxuICAgICAgdXNlclBvb2xOYW1lOiAndGFza2Zsb3ctdXNlcnMnLFxyXG4gICAgICBzZWxmU2lnblVwRW5hYmxlZDogZmFsc2UsXHJcbiAgICAgIHNpZ25JbkFsaWFzZXM6IHtcclxuICAgICAgICBlbWFpbDogdHJ1ZSxcclxuICAgICAgICB1c2VybmFtZTogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgICAgYXV0b1ZlcmlmeToge1xyXG4gICAgICAgIGVtYWlsOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcclxuICAgICAgICBlbWFpbDoge1xyXG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXHJcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZ2l2ZW5OYW1lOiB7XHJcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcclxuICAgICAgICAgIG11dGFibGU6IHRydWUsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBmYW1pbHlOYW1lOiB7XHJcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcclxuICAgICAgICAgIG11dGFibGU6IHRydWUsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAgY3VzdG9tQXR0cmlidXRlczoge1xyXG4gICAgICAgIGRlcGFydG1lbnQ6IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7IG11dGFibGU6IHRydWUgfSksXHJcbiAgICAgICAgcm9sZTogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHsgbXV0YWJsZTogdHJ1ZSB9KSxcclxuICAgICAgfSxcclxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcclxuICAgICAgICBtaW5MZW5ndGg6IDgsXHJcbiAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcclxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxyXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXHJcbiAgICAgICAgcmVxdWlyZVN5bWJvbHM6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHVzZXJQb29sQ2xpZW50ID0gbmV3IGNvZ25pdG8uVXNlclBvb2xDbGllbnQodGhpcywgJ1VzZXJQb29sQ2xpZW50Jywge1xyXG4gICAgICB1c2VyUG9vbCxcclxuICAgICAgdXNlclBvb2xDbGllbnROYW1lOiAndGFza2Zsb3ctd2ViLWNsaWVudCcsXHJcbiAgICAgIGF1dGhGbG93czoge1xyXG4gICAgICAgIHVzZXJTcnA6IHRydWUsXHJcbiAgICAgICAgdXNlclBhc3N3b3JkOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBJQU0gUm9sZSBmb3IgTGFtYmRhIGZ1bmN0aW9uc1xyXG4gICAgY29uc3QgbGFtYmRhRXhlY3V0aW9uUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnTGFtYmRhRXhlY3V0aW9uUm9sZScsIHtcclxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXHJcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xyXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxyXG4gICAgICBdLFxyXG4gICAgICBpbmxpbmVQb2xpY2llczoge1xyXG4gICAgICAgIER5bmFtb0RCQWNjZXNzOiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcclxuICAgICAgICAgIHN0YXRlbWVudHM6IFtcclxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcclxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6R2V0SXRlbScsXHJcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6UHV0SXRlbScsXHJcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6VXBkYXRlSXRlbScsXHJcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6RGVsZXRlSXRlbScsXHJcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6U2NhbicsXHJcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6UXVlcnknLFxyXG4gICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXHJcbiAgICAgICAgICAgICAgICB0YXNrc1RhYmxlLnRhYmxlQXJuLFxyXG4gICAgICAgICAgICAgICAgbGVhdmVSZXF1ZXN0c1RhYmxlLnRhYmxlQXJuLFxyXG4gICAgICAgICAgICAgICAgZmlsZXNUYWJsZS50YWJsZUFybixcclxuICAgICAgICAgICAgICAgIHVzZXJzVGFibGUudGFibGVBcm4sXHJcbiAgICAgICAgICAgICAgICBgJHt1c2Vyc1RhYmxlLnRhYmxlQXJufS9pbmRleC8qYCxcclxuICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgUzNBY2Nlc3M6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xyXG4gICAgICAgICAgc3RhdGVtZW50czogW1xyXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgICAgICAgICdzMzpHZXRPYmplY3QnLFxyXG4gICAgICAgICAgICAgICAgJ3MzOlB1dE9iamVjdCcsXHJcbiAgICAgICAgICAgICAgICAnczM6RGVsZXRlT2JqZWN0JyxcclxuICAgICAgICAgICAgICAgICdzMzpHZXRPYmplY3RWZXJzaW9uJyxcclxuICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgIHJlc291cmNlczogW2Ake3VwbG9hZHNCdWNrZXQuYnVja2V0QXJufS8qYF0sXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgXSxcclxuICAgICAgICB9KSxcclxuICAgICAgICBTTlNBY2Nlc3M6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xyXG4gICAgICAgICAgc3RhdGVtZW50czogW1xyXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFsnc25zOlB1Ymxpc2gnXSxcclxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtub3RpZmljYXRpb25zVG9waWMudG9waWNBcm5dLFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgfSksXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBMYW1iZGEgTGF5ZXIgZm9yIHNoYXJlZCBkZXBlbmRlbmNpZXNcclxuICAgIGNvbnN0IHNoYXJlZExheWVyID0gbmV3IGxhbWJkYS5MYXllclZlcnNpb24odGhpcywgJ1NoYXJlZExheWVyJywge1xyXG4gICAgICBsYXllclZlcnNpb25OYW1lOiAndGFza2Zsb3ctc2hhcmVkLWxheWVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kL2xheWVycy9zaGFyZWQnKSxcclxuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1hdLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1NoYXJlZCB1dGlsaXRpZXMgYW5kIGRlcGVuZGVuY2llcyBmb3IgVGFza0Zsb3cgTGFtYmRhIGZ1bmN0aW9ucycsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBDb21tb24gTGFtYmRhIGZ1bmN0aW9uIGNvbmZpZ3VyYXRpb25cclxuICAgIGNvbnN0IGxhbWJkYUNvbmZpZyA9IHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIHJvbGU6IGxhbWJkYUV4ZWN1dGlvblJvbGUsXHJcbiAgICAgIGxheWVyczogW3NoYXJlZExheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBUQVNLU19UQUJMRTogdGFza3NUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgTEVBVkVfUkVRVUVTVFNfVEFCTEU6IGxlYXZlUmVxdWVzdHNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgRklMRVNfVEFCTEU6IGZpbGVzVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIFVTRVJTX1RBQkxFOiB1c2Vyc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBTM19CVUNLRVQ6IHVwbG9hZHNCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgICBTTlNfVE9QSUNfQVJOOiBub3RpZmljYXRpb25zVG9waWMudG9waWNBcm4sXHJcbiAgICAgICAgVVNFUl9QT09MX0lEOiB1c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICB9LFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIFRhc2sgTGFtYmRhIEZ1bmN0aW9uc1xyXG4gICAgY29uc3QgbGlzdFRhc2tzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdMaXN0VGFza3NGdW5jdGlvbicsIHtcclxuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxyXG4gICAgICBmdW5jdGlvbk5hbWU6ICd0YXNrZmxvdy1saXN0LXRhc2tzJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kL2Rpc3QvbGFtYmRhcy90YXNrcycpLFxyXG4gICAgICBoYW5kbGVyOiAndGFza0hhbmRsZXJzLmxpc3RUYXNrcycsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBjcmVhdGVUYXNrRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDcmVhdGVUYXNrRnVuY3Rpb24nLCB7XHJcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcclxuICAgICAgZnVuY3Rpb25OYW1lOiAndGFza2Zsb3ctY3JlYXRlLXRhc2snLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQvZGlzdC9sYW1iZGFzL3Rhc2tzJyksXHJcbiAgICAgIGhhbmRsZXI6ICd0YXNrSGFuZGxlcnMuY3JlYXRlVGFzaycsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBnZXRUYXNrRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHZXRUYXNrRnVuY3Rpb24nLCB7XHJcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcclxuICAgICAgZnVuY3Rpb25OYW1lOiAndGFza2Zsb3ctZ2V0LXRhc2snLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQvZGlzdC9sYW1iZGFzL3Rhc2tzJyksXHJcbiAgICAgIGhhbmRsZXI6ICd0YXNrSGFuZGxlcnMuZ2V0VGFzaycsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCB1cGRhdGVUYXNrRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdVcGRhdGVUYXNrRnVuY3Rpb24nLCB7XHJcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcclxuICAgICAgZnVuY3Rpb25OYW1lOiAndGFza2Zsb3ctdXBkYXRlLXRhc2snLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQvZGlzdC9sYW1iZGFzL3Rhc2tzJyksXHJcbiAgICAgIGhhbmRsZXI6ICd0YXNrSGFuZGxlcnMudXBkYXRlVGFzaycsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBkZWxldGVUYXNrRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdEZWxldGVUYXNrRnVuY3Rpb24nLCB7XHJcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcclxuICAgICAgZnVuY3Rpb25OYW1lOiAndGFza2Zsb3ctZGVsZXRlLXRhc2snLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQvZGlzdC9sYW1iZGFzL3Rhc2tzJyksXHJcbiAgICAgIGhhbmRsZXI6ICd0YXNrSGFuZGxlcnMuZGVsZXRlVGFzaycsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBnZXRLYW5iYW5Cb2FyZEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0S2FuYmFuQm9hcmRGdW5jdGlvbicsIHtcclxuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxyXG4gICAgICBmdW5jdGlvbk5hbWU6ICd0YXNrZmxvdy1nZXQta2FuYmFuLWJvYXJkJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kL2Rpc3QvbGFtYmRhcy90YXNrcycpLFxyXG4gICAgICBoYW5kbGVyOiAndGFza0hhbmRsZXJzLmdldEthbmJhbkJvYXJkJyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIExlYXZlIFJlcXVlc3QgTGFtYmRhIEZ1bmN0aW9uc1xyXG4gICAgY29uc3QgbGlzdExlYXZlUmVxdWVzdHNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0xpc3RMZWF2ZVJlcXVlc3RzRnVuY3Rpb24nLCB7XHJcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcclxuICAgICAgZnVuY3Rpb25OYW1lOiAndGFza2Zsb3ctbGlzdC1sZWF2ZS1yZXF1ZXN0cycsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC9kaXN0L2xhbWJkYXMvbGVhdmUnKSxcclxuICAgICAgaGFuZGxlcjogJ2xlYXZlSGFuZGxlcnMubGlzdExlYXZlUmVxdWVzdHMnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3Qgc3VibWl0TGVhdmVSZXF1ZXN0RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTdWJtaXRMZWF2ZVJlcXVlc3RGdW5jdGlvbicsIHtcclxuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxyXG4gICAgICBmdW5jdGlvbk5hbWU6ICd0YXNrZmxvdy1zdWJtaXQtbGVhdmUtcmVxdWVzdCcsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC9kaXN0L2xhbWJkYXMvbGVhdmUnKSxcclxuICAgICAgaGFuZGxlcjogJ2xlYXZlSGFuZGxlcnMuc3VibWl0TGVhdmVSZXF1ZXN0JyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGFwcHJvdmVMZWF2ZVJlcXVlc3RGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FwcHJvdmVMZWF2ZVJlcXVlc3RGdW5jdGlvbicsIHtcclxuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxyXG4gICAgICBmdW5jdGlvbk5hbWU6ICd0YXNrZmxvdy1hcHByb3ZlLWxlYXZlLXJlcXVlc3QnLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQvZGlzdC9sYW1iZGFzL2xlYXZlJyksXHJcbiAgICAgIGhhbmRsZXI6ICdsZWF2ZUhhbmRsZXJzLmFwcHJvdmVMZWF2ZVJlcXVlc3QnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgcmVqZWN0TGVhdmVSZXF1ZXN0RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdSZWplY3RMZWF2ZVJlcXVlc3RGdW5jdGlvbicsIHtcclxuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxyXG4gICAgICBmdW5jdGlvbk5hbWU6ICd0YXNrZmxvdy1yZWplY3QtbGVhdmUtcmVxdWVzdCcsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC9kaXN0L2xhbWJkYXMvbGVhdmUnKSxcclxuICAgICAgaGFuZGxlcjogJ2xlYXZlSGFuZGxlcnMucmVqZWN0TGVhdmVSZXF1ZXN0JyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEZpbGUgTWFuYWdlbWVudCBMYW1iZGEgRnVuY3Rpb25zXHJcbiAgICBjb25zdCBnZW5lcmF0ZVVwbG9hZFVybEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2VuZXJhdGVVcGxvYWRVcmxGdW5jdGlvbicsIHtcclxuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxyXG4gICAgICBmdW5jdGlvbk5hbWU6ICd0YXNrZmxvdy1nZW5lcmF0ZS11cGxvYWQtdXJsJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kL2Rpc3QvbGFtYmRhcy9maWxlcycpLFxyXG4gICAgICBoYW5kbGVyOiAnZmlsZUhhbmRsZXJzLmdlbmVyYXRlVXBsb2FkVXJsJyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGdldEZpbGVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldEZpbGVGdW5jdGlvbicsIHtcclxuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxyXG4gICAgICBmdW5jdGlvbk5hbWU6ICd0YXNrZmxvdy1nZXQtZmlsZScsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC9kaXN0L2xhbWJkYXMvZmlsZXMnKSxcclxuICAgICAgaGFuZGxlcjogJ2ZpbGVIYW5kbGVycy5nZXRGaWxlJyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGRlbGV0ZUZpbGVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0RlbGV0ZUZpbGVGdW5jdGlvbicsIHtcclxuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxyXG4gICAgICBmdW5jdGlvbk5hbWU6ICd0YXNrZmxvdy1kZWxldGUtZmlsZScsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC9kaXN0L2xhbWJkYXMvZmlsZXMnKSxcclxuICAgICAgaGFuZGxlcjogJ2ZpbGVIYW5kbGVycy5kZWxldGVGaWxlJyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFVzZXIgTWFuYWdlbWVudCBMYW1iZGEgRnVuY3Rpb25zXHJcbiAgICBjb25zdCBsaXN0VXNlcnNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0xpc3RVc2Vyc0Z1bmN0aW9uJywge1xyXG4gICAgICAuLi5sYW1iZGFDb25maWcsXHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3Rhc2tmbG93LWxpc3QtdXNlcnMnLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQvZGlzdC9sYW1iZGFzL3VzZXJzJyksXHJcbiAgICAgIGhhbmRsZXI6ICd1c2VySGFuZGxlcnMubGlzdFVzZXJzJyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGNyZWF0ZVVzZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NyZWF0ZVVzZXJGdW5jdGlvbicsIHtcclxuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxyXG4gICAgICBmdW5jdGlvbk5hbWU6ICd0YXNrZmxvdy1jcmVhdGUtdXNlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC9kaXN0L2xhbWJkYXMvdXNlcnMnKSxcclxuICAgICAgaGFuZGxlcjogJ3VzZXJIYW5kbGVycy5jcmVhdGVVc2VyJyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGdldFVzZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldFVzZXJGdW5jdGlvbicsIHtcclxuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxyXG4gICAgICBmdW5jdGlvbk5hbWU6ICd0YXNrZmxvdy1nZXQtdXNlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC9kaXN0L2xhbWJkYXMvdXNlcnMnKSxcclxuICAgICAgaGFuZGxlcjogJ3VzZXJIYW5kbGVycy5nZXRVc2VyJyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHVwZGF0ZVVzZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1VwZGF0ZVVzZXJGdW5jdGlvbicsIHtcclxuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxyXG4gICAgICBmdW5jdGlvbk5hbWU6ICd0YXNrZmxvdy11cGRhdGUtdXNlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC9kaXN0L2xhbWJkYXMvdXNlcnMnKSxcclxuICAgICAgaGFuZGxlcjogJ3VzZXJIYW5kbGVycy51cGRhdGVVc2VyJyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGRlbGV0ZVVzZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0RlbGV0ZVVzZXJGdW5jdGlvbicsIHtcclxuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxyXG4gICAgICBmdW5jdGlvbk5hbWU6ICd0YXNrZmxvdy1kZWxldGUtdXNlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC9kaXN0L2xhbWJkYXMvdXNlcnMnKSxcclxuICAgICAgaGFuZGxlcjogJ3VzZXJIYW5kbGVycy5kZWxldGVVc2VyJyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFQSSBHYXRld2F5XHJcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdUYXNrRmxvd0FwaScsIHtcclxuICAgICAgcmVzdEFwaU5hbWU6ICdUYXNrRmxvdyBBUEknLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1Rhc2tGbG93IEVtcGxveWVlIE1hbmFnZW1lbnQgU3lzdGVtIEFQSScsXHJcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xyXG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxyXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxyXG4gICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnWC1BbXotRGF0ZScsICdBdXRob3JpemF0aW9uJywgJ1gtQXBpLUtleScsICdYLUFtei1TZWN1cml0eS1Ub2tlbiddLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ29nbml0byBBdXRob3JpemVyXHJcbiAgICBjb25zdCBjb2duaXRvQXV0aG9yaXplciA9IG5ldyBhcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHRoaXMsICdDb2duaXRvQXV0aG9yaXplcicsIHtcclxuICAgICAgY29nbml0b1VzZXJQb29sczogW3VzZXJQb29sXSxcclxuICAgICAgYXV0aG9yaXplck5hbWU6ICdUYXNrRmxvd0F1dGhvcml6ZXInLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQVBJIFJvdXRlc1xyXG4gICAgXHJcbiAgICAvLyBUYXNrcyByb3V0ZXNcclxuICAgIGNvbnN0IHRhc2tzUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgndGFza3MnKTtcclxuICAgIHRhc2tzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihsaXN0VGFza3NGdW5jdGlvbiksIHtcclxuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXHJcbiAgICB9KTtcclxuICAgIHRhc2tzUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oY3JlYXRlVGFza0Z1bmN0aW9uKSwge1xyXG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHRhc2tSZXNvdXJjZSA9IHRhc2tzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tpZH0nKTtcclxuICAgIHRhc2tSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdldFRhc2tGdW5jdGlvbiksIHtcclxuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXHJcbiAgICB9KTtcclxuICAgIHRhc2tSZXNvdXJjZS5hZGRNZXRob2QoJ1BVVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHVwZGF0ZVRhc2tGdW5jdGlvbiksIHtcclxuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXHJcbiAgICB9KTtcclxuICAgIHRhc2tSZXNvdXJjZS5hZGRNZXRob2QoJ0RFTEVURScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGRlbGV0ZVRhc2tGdW5jdGlvbiksIHtcclxuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBrYW5iYW5SZXNvdXJjZSA9IHRhc2tzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2thbmJhbicpO1xyXG4gICAga2FuYmFuUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRLYW5iYW5Cb2FyZEZ1bmN0aW9uKSwge1xyXG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIExlYXZlIHJlcXVlc3RzIHJvdXRlc1xyXG4gICAgY29uc3QgbGVhdmVSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCdsZWF2ZS1yZXF1ZXN0cycpO1xyXG4gICAgbGVhdmVSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGxpc3RMZWF2ZVJlcXVlc3RzRnVuY3Rpb24pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxyXG4gICAgfSk7XHJcbiAgICBsZWF2ZVJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN1Ym1pdExlYXZlUmVxdWVzdEZ1bmN0aW9uKSwge1xyXG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGxlYXZlUmVxdWVzdFJlc291cmNlID0gbGVhdmVSZXNvdXJjZS5hZGRSZXNvdXJjZSgne2lkfScpO1xyXG4gICAgY29uc3QgYXBwcm92ZVJlc291cmNlID0gbGVhdmVSZXF1ZXN0UmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2FwcHJvdmUnKTtcclxuICAgIGFwcHJvdmVSZXNvdXJjZS5hZGRNZXRob2QoJ1BVVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwcHJvdmVMZWF2ZVJlcXVlc3RGdW5jdGlvbiksIHtcclxuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCByZWplY3RSZXNvdXJjZSA9IGxlYXZlUmVxdWVzdFJlc291cmNlLmFkZFJlc291cmNlKCdyZWplY3QnKTtcclxuICAgIHJlamVjdFJlc291cmNlLmFkZE1ldGhvZCgnUFVUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocmVqZWN0TGVhdmVSZXF1ZXN0RnVuY3Rpb24pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gRmlsZXMgcm91dGVzXHJcbiAgICBjb25zdCBmaWxlc1Jlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2ZpbGVzJyk7XHJcbiAgICBjb25zdCB1cGxvYWRSZXNvdXJjZSA9IGZpbGVzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3VwbG9hZCcpO1xyXG4gICAgdXBsb2FkUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2VuZXJhdGVVcGxvYWRVcmxGdW5jdGlvbiksIHtcclxuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBmaWxlUmVzb3VyY2UgPSBmaWxlc1Jlc291cmNlLmFkZFJlc291cmNlKCd7aWR9Jyk7XHJcbiAgICBmaWxlUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRGaWxlRnVuY3Rpb24pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxyXG4gICAgfSk7XHJcbiAgICBmaWxlUmVzb3VyY2UuYWRkTWV0aG9kKCdERUxFVEUnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihkZWxldGVGaWxlRnVuY3Rpb24pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gVXNlcnMgcm91dGVzXHJcbiAgICBjb25zdCB1c2Vyc1Jlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3VzZXJzJyk7XHJcbiAgICB1c2Vyc1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obGlzdFVzZXJzRnVuY3Rpb24pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxyXG4gICAgfSk7XHJcbiAgICB1c2Vyc1Jlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGNyZWF0ZVVzZXJGdW5jdGlvbiksIHtcclxuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCB1c2VyUmVzb3VyY2UgPSB1c2Vyc1Jlc291cmNlLmFkZFJlc291cmNlKCd7aWR9Jyk7XHJcbiAgICB1c2VyUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRVc2VyRnVuY3Rpb24pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxyXG4gICAgfSk7XHJcbiAgICB1c2VyUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1cGRhdGVVc2VyRnVuY3Rpb24pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxyXG4gICAgfSk7XHJcbiAgICB1c2VyUmVzb3VyY2UuYWRkTWV0aG9kKCdERUxFVEUnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihkZWxldGVVc2VyRnVuY3Rpb24pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gRUMyIGluc3RhbmNlIGZvciBNTCBzZXJ2aWNlcyAob3B0aW9uYWwpXHJcbiAgICBjb25zdCB2cGMgPSBuZXcgZWMyLlZwYyh0aGlzLCAnVGFza0Zsb3dWcGMnLCB7XHJcbiAgICAgIG1heEF6czogMixcclxuICAgICAgbmF0R2F0ZXdheXM6IDEsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBtbFNlY3VyaXR5R3JvdXAgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ01MU2VjdXJpdHlHcm91cCcsIHtcclxuICAgICAgdnBjLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBNTCBBUEkgc2VydmVyJyxcclxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSxcclxuICAgIH0pO1xyXG5cclxuICAgIG1sU2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShcclxuICAgICAgZWMyLlBlZXIuYW55SXB2NCgpLFxyXG4gICAgICBlYzIuUG9ydC50Y3AoODAwMCksXHJcbiAgICAgICdBbGxvdyBIVFRQIHRyYWZmaWMgdG8gTUwgQVBJJ1xyXG4gICAgKTtcclxuXHJcbiAgICAvLyBOb3RlOiBBbXBsaWZ5IEFwcCBjYW4gYmUgc2V0IHVwIG1hbnVhbGx5IHRocm91Z2ggQVdTIENvbnNvbGVcclxuICAgIC8vIG9yIHVzaW5nIEFtcGxpZnkgQ0xJIGZvciBlYXNpZXIgaW50ZWdyYXRpb25cclxuXHJcbiAgICAvLyBPdXRwdXRzXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpVXJsJywge1xyXG4gICAgICB2YWx1ZTogYXBpLnVybCxcclxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBVUkwnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sSWQnLCB7XHJcbiAgICAgIHZhbHVlOiB1c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIElEJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbENsaWVudElkJywge1xyXG4gICAgICB2YWx1ZTogdXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcclxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBDbGllbnQgSUQnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1MzQnVja2V0TmFtZScsIHtcclxuICAgICAgdmFsdWU6IHVwbG9hZHNCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdTMyBCdWNrZXQgZm9yIGZpbGUgdXBsb2FkcycsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU05TVG9waWNBcm4nLCB7XHJcbiAgICAgIHZhbHVlOiBub3RpZmljYXRpb25zVG9waWMudG9waWNBcm4sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnU05TIFRvcGljIEFSTiBmb3Igbm90aWZpY2F0aW9ucycsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBOb3RlOiBGb3IgZnJvbnRlbmQgaG9zdGluZywgeW91IGNhbiB1c2U6XHJcbiAgICAvLyAtIEFXUyBBbXBsaWZ5IENvbnNvbGUgKG1hbnVhbCBzZXR1cClcclxuICAgIC8vIC0gUzMgKyBDbG91ZEZyb250XHJcbiAgICAvLyAtIFZlcmNlbC9OZXRsaWZ5IGZvciBlYXNpZXIgZGVwbG95bWVudFxyXG4gIH1cclxufVxyXG4iXX0=