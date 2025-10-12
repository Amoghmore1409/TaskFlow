// AWS Configuration for TaskFlow
// This file will be generated automatically by AWS Amplify
// Update these values after deploying your infrastructure

const awsconfig = {
  aws_project_region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  aws_cognito_identity_pool_id: '', // Will be populated by Amplify
  aws_cognito_region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  aws_user_pools_id: process.env.REACT_APP_USER_POOL_ID || '',
  aws_user_pools_web_client_id: process.env.REACT_APP_USER_POOL_CLIENT_ID || '',
  oauth: {},
  aws_cognito_username_attributes: ['EMAIL'],
  aws_cognito_social_providers: [],
  aws_cognito_signup_attributes: ['EMAIL', 'NAME'],
  aws_cognito_mfa_configuration: 'OFF',
  aws_cognito_mfa_types: ['SMS'],
  aws_cognito_password_protection_settings: {
    passwordPolicyMinLength: 8,
    passwordPolicyCharacters: [
      'REQUIRES_LOWERCASE',
      'REQUIRES_UPPERCASE',
      'REQUIRES_NUMBERS',
      'REQUIRES_SYMBOLS'
    ]
  },
  aws_cognito_verification_mechanisms: ['EMAIL'],
  
  // API Configuration
  aws_cloud_logic_custom: [
    {
      name: 'TaskFlowAPI',
      endpoint: process.env.REACT_APP_API_URL || '',
      region: process.env.REACT_APP_AWS_REGION || 'us-east-1'
    }
  ],
  
  // Storage Configuration
  aws_user_files_s3_bucket: process.env.REACT_APP_S3_BUCKET || '',
  aws_user_files_s3_bucket_region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  
  // Analytics Configuration (optional)
  aws_mobile_analytics_app_id: '',
  aws_mobile_analytics_app_region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
};

export default awsconfig;
