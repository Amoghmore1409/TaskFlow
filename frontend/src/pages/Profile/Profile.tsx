import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Button,
  TextField,
  Grid,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  Chip,
  Alert,
  LinearProgress,
  Divider,
  Stack,
  Badge,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Edit as EditIcon,
  PhotoCamera as PhotoCameraIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Palette as PaletteIcon,
  Language as LanguageIcon,
  Timeline as TimelineIcon,
  CloudUpload as CloudUploadIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Work as WorkIcon,
  School as SchoolIcon,
  Badge as BadgeIcon,
} from '@mui/icons-material';
import { useAuth, useNotification } from '../../context';

// TODO: AWS SDK Configuration - Add your AWS credentials and region
// ================================================================
// STEP 1: Install AWS SDK packages (if not already installed)
// npm install @aws-sdk/client-s3 @aws-sdk/client-dynamodb @aws-sdk/client-cognito-identity-provider @aws-sdk/client-ses @aws-sdk/client-sns

// STEP 2: Configure AWS credentials in your environment
// Option A: Environment Variables (Recommended for production)
// export AWS_ACCESS_KEY_ID=your_access_key
// export AWS_SECRET_ACCESS_KEY=your_secret_key
// export AWS_DEFAULT_REGION=us-east-1

// Option B: AWS Credentials File (~/.aws/credentials)
// [default]
// aws_access_key_id = your_access_key
// aws_secret_access_key = your_secret_key

// Option C: IAM Roles (Recommended for EC2/Lambda deployment)
// Configure IAM roles with appropriate permissions

// STEP 3: Uncomment these imports when ready for production
// import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
// import { DynamoDBClient, UpdateItemCommand, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
// import { CognitoIdentityProviderClient, ChangePasswordCommand, UpdateUserAttributesCommand } from '@aws-sdk/client-cognito-identity-provider';
// import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
// import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

// TODO: AWS Configuration - Update these values for your environment
// ================================================================
// const AWS_CONFIG = {
//   region: 'us-east-1', // TODO: Change to your preferred AWS region
//   s3BucketName: 'taskflow-profile-photos', // TODO: Change to your S3 bucket name
//   dynamoTableName: 'TaskFlow-UserProfiles', // TODO: Change to your DynamoDB table name
//   cognitoUserPoolId: 'us-east-1_XXXXXXXXX', // TODO: Add your Cognito User Pool ID
//   sesSourceEmail: 'noreply@yourdomain.com', // TODO: Add your verified SES email
//   snsTopicArn: 'arn:aws:sns:us-east-1:YOUR_ACCOUNT_ID:profile-updates', // TODO: Add your SNS topic ARN
// };

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  jobTitle: string;
  department: string;
  location: string;
  phone: string;
  bio: string;
  profilePhotoUrl?: string;
  skills: string[];
  languages: string[];
  socialLinks: {
    linkedin?: string;
    github?: string;
    twitter?: string;
  };
  preferences: UserPreferences;
  createdDate: string;
  lastUpdated: string;
  lastLoginDate?: string;
  isActive: boolean;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  emailNotifications: {
    taskUpdates: boolean;
    leaveApprovals: boolean;
    systemAnnouncements: boolean;
    weeklyReports: boolean;
  };
  privacy: {
    profileVisible: boolean;
    showEmail: boolean;
    showPhone: boolean;
  };
}

interface ActivityLog {
  id: string;
  action: string;
  description: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// Mock data - Replace with AWS DynamoDB queries in production
const mockProfile: UserProfile = {
  id: 'user001',
  email: 'john.doe@company.com',
  firstName: 'John',
  lastName: 'Doe',
  displayName: 'John Doe',
  jobTitle: 'Senior Software Engineer',
  department: 'Engineering',
  location: 'San Francisco, CA',
  phone: '+1 (555) 123-4567',
  bio: 'Passionate software engineer with 5+ years of experience in full-stack development. Love working with React, Node.js, and AWS services.',
  profilePhotoUrl: '',
  skills: ['React', 'TypeScript', 'Node.js', 'AWS', 'Python', 'Docker'],
  languages: ['English', 'Spanish'],
  socialLinks: {
    linkedin: 'https://linkedin.com/in/johndoe',
    github: 'https://github.com/johndoe',
  },
  preferences: {
    theme: 'light',
    language: 'en',
    timezone: 'America/Los_Angeles',
    emailNotifications: {
      taskUpdates: true,
      leaveApprovals: true,
      systemAnnouncements: false,
      weeklyReports: true,
    },
    privacy: {
      profileVisible: true,
      showEmail: true,
      showPhone: false,
    },
  },
  createdDate: '2024-01-15T00:00:00Z',
  lastUpdated: '2025-10-10T00:00:00Z',
  lastLoginDate: '2025-10-12T08:30:00Z',
  isActive: true,
};

const mockActivityLogs: ActivityLog[] = [
  {
    id: '1',
    action: 'LOGIN',
    description: 'User logged in successfully',
    timestamp: '2025-10-12T08:30:00Z',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
  {
    id: '2',
    action: 'PROFILE_UPDATE',
    description: 'Updated profile information',
    timestamp: '2025-10-10T14:22:00Z',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
  {
    id: '3',
    action: 'PASSWORD_CHANGE',
    description: 'Password changed successfully',
    timestamp: '2025-10-05T10:15:00Z',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
  {
    id: '4',
    action: 'PHOTO_UPLOAD',
    description: 'Profile photo updated',
    timestamp: '2025-10-01T16:45:00Z',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
];

const Profile: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  // Helper notification functions
  const showSuccess = useCallback((message: string) => showNotification(message, 'success'), [showNotification]);
  const showError = useCallback((message: string) => showNotification(message, 'error'), [showNotification]);
  const showInfo = useCallback((message: string) => showNotification(message, 'info'), [showNotification]);

  // State management
  const [profile, setProfile] = useState<UserProfile>(mockProfile);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [activityLogs] = useState<ActivityLog[]>(mockActivityLogs);
  const [newSkill, setNewSkill] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form state for editing
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // TODO: AWS DynamoDB Integration - Load user profile
  // ================================================================
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setLoading(true);

        // TODO: Replace with actual DynamoDB query in production
        // const dynamoClient = new DynamoDBClient({ region: AWS_CONFIG.region });
        // const getCommand = new GetItemCommand({
        //   TableName: AWS_CONFIG.dynamoTableName,
        //   Key: {
        //     id: { S: user?.id || '' }
        //   }
        // });
        // const response = await dynamoClient.send(getCommand);
        // 
        // if (response.Item) {
        //   const profileData: UserProfile = {
        //     // TODO: Map DynamoDB item to UserProfile interface
        //     id: response.Item.id.S || '',
        //     email: response.Item.email.S || '',
        //     firstName: response.Item.firstName.S || '',
        //     // ... complete the mapping
        //   };
        //   setProfile(profileData);
        // }

        // For demo purposes, use mock data
        setProfile(mockProfile);
        showInfo('Profile loaded successfully');
      } catch (error) {
        console.error('Error fetching profile:', error);
        showError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [showError, showInfo, user?.id]);

  // TODO: AWS S3 Integration - Upload profile photo
  // ================================================================
  const handlePhotoUpload = async (file: File) => {
    try {
      setLoading(true);
      setUploadProgress(0);

      // TODO: Upload to S3 in production
      // const s3Client = new S3Client({ region: AWS_CONFIG.region });
      // const key = `profile-photos/${profile.id}/${Date.now()}-${file.name}`;
      // const uploadCommand = new PutObjectCommand({
      //   Bucket: AWS_CONFIG.s3BucketName,
      //   Key: key,
      //   Body: file,
      //   ContentType: file.type,
      //   Metadata: {
      //     'uploaded-by': profile.id,
      //     'upload-date': new Date().toISOString()
      //   }
      // });
      // 
      // await s3Client.send(uploadCommand);
      // const photoUrl = `https://${AWS_CONFIG.s3BucketName}.s3.${AWS_CONFIG.region}.amazonaws.com/${key}`;
      
      // Simulate upload progress
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 200);

      // For demo purposes, create a local URL
      const photoUrl = URL.createObjectURL(file);
      
      // Update profile with new photo URL
      const updatedProfile = { ...profile, profilePhotoUrl: photoUrl };
      setProfile(updatedProfile);
      
      // TODO: Update DynamoDB record
      // await updateProfileInDynamoDB(updatedProfile);
      
      // TODO: Send notification via SNS
      // await sendProfileUpdateNotification('PHOTO_UPDATED');

      showSuccess('Profile photo updated successfully!');
      setPhotoDialogOpen(false);
      setUploadProgress(0);
    } catch (error) {
      console.error('Error uploading photo:', error);
      showError('Failed to upload photo');
    } finally {
      setLoading(false);
    }
  };

  // TODO: AWS DynamoDB Integration - Update profile
  // ================================================================
  const handleSaveProfile = async () => {
    try {
      setLoading(true);

      const updatedProfile = { ...profile, ...editForm, lastUpdated: new Date().toISOString() };

      // TODO: Update DynamoDB record in production
      // const dynamoClient = new DynamoDBClient({ region: AWS_CONFIG.region });
      // const updateCommand = new UpdateItemCommand({
      //   TableName: AWS_CONFIG.dynamoTableName,
      //   Key: { id: { S: profile.id } },
      //   UpdateExpression: 'SET firstName = :firstName, lastName = :lastName, jobTitle = :jobTitle, department = :department, #location = :location, phone = :phone, bio = :bio, skills = :skills, lastUpdated = :lastUpdated',
      //   ExpressionAttributeNames: { '#location': 'location' },
      //   ExpressionAttributeValues: {
      //     ':firstName': { S: updatedProfile.firstName },
      //     ':lastName': { S: updatedProfile.lastName },
      //     ':jobTitle': { S: updatedProfile.jobTitle },
      //     ':department': { S: updatedProfile.department },
      //     ':location': { S: updatedProfile.location },
      //     ':phone': { S: updatedProfile.phone },
      //     ':bio': { S: updatedProfile.bio },
      //     ':skills': { SS: updatedProfile.skills },
      //     ':lastUpdated': { S: updatedProfile.lastUpdated }
      //   }
      // });
      // await dynamoClient.send(updateCommand);

      setProfile(updatedProfile);
      setEditForm({});
      setEditingSection(null);

      // TODO: Send notification via SNS
      // await sendProfileUpdateNotification('PROFILE_UPDATED');

      showSuccess('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      showError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // TODO: AWS Cognito Integration - Change password
  // ================================================================
  const handlePasswordChange = async () => {
    try {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        showError('New passwords do not match');
        return;
      }

      if (passwordForm.newPassword.length < 8) {
        showError('Password must be at least 8 characters long');
        return;
      }

      setLoading(true);

      // TODO: Change password in Cognito in production
      // const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_CONFIG.region });
      // const changePasswordCommand = new ChangePasswordCommand({
      //   AccessToken: user?.accessToken, // TODO: Get from auth context
      //   PreviousPassword: passwordForm.currentPassword,
      //   ProposedPassword: passwordForm.newPassword
      // });
      // await cognitoClient.send(changePasswordCommand);

      // TODO: Send confirmation email via SES
      // const sesClient = new SESClient({ region: AWS_CONFIG.region });
      // const emailCommand = new SendEmailCommand({
      //   Source: AWS_CONFIG.sesSourceEmail,
      //   Destination: { ToAddresses: [profile.email] },
      //   Message: {
      //     Subject: { Data: 'Password Changed Successfully' },
      //     Body: {
      //       Html: {
      //         Data: `
      //           <h2>Password Changed</h2>
      //           <p>Your password has been successfully changed.</p>
      //           <p>If you did not make this change, please contact support immediately.</p>
      //           <p>Time: ${new Date().toLocaleString()}</p>
      //         `
      //       }
      //     }
      //   }
      // });
      // await sesClient.send(emailCommand);

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordDialogOpen(false);
      showSuccess('Password changed successfully!');
    } catch (error) {
      console.error('Error changing password:', error);
      showError('Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  // TODO: AWS DynamoDB Integration - Update preferences
  // ================================================================
  const handlePreferenceChange = async (section: keyof UserPreferences, key: string, value: any) => {
    try {
      const sectionValue = profile.preferences[section];
      const updatedSection = typeof sectionValue === 'object' && sectionValue !== null
        ? { ...sectionValue, [key]: value }
        : { [key]: value };

      const updatedPreferences = {
        ...profile.preferences,
        [section]: updatedSection
      };

      const updatedProfile = {
        ...profile,
        preferences: updatedPreferences,
        lastUpdated: new Date().toISOString()
      };

      // TODO: Update DynamoDB record in production
      // const dynamoClient = new DynamoDBClient({ region: AWS_CONFIG.region });
      // const updateCommand = new UpdateItemCommand({
      //   TableName: AWS_CONFIG.dynamoTableName,
      //   Key: { id: { S: profile.id } },
      //   UpdateExpression: 'SET preferences = :preferences, lastUpdated = :lastUpdated',
      //   ExpressionAttributeValues: {
      //     ':preferences': { S: JSON.stringify(updatedPreferences) },
      //     ':lastUpdated': { S: updatedProfile.lastUpdated }
      //   }
      // });
      // await dynamoClient.send(updateCommand);

      setProfile(updatedProfile);
      showSuccess('Preferences updated successfully!');
    } catch (error) {
      console.error('Error updating preferences:', error);
      showError('Failed to update preferences');
    }
  };

  // Handle skill management
  const handleAddSkill = () => {
    if (newSkill.trim() && !profile.skills.includes(newSkill.trim())) {
      const updatedSkills = [...profile.skills, newSkill.trim()];
      setEditForm(prev => ({ ...prev, skills: updatedSkills }));
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const updatedSkills = (editForm.skills || profile.skills).filter(skill => skill !== skillToRemove);
    setEditForm(prev => ({ ...prev, skills: updatedSkills }));
  };

  // Handle file input
  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showError('File size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        showError('Please select an image file');
        return;
      }
      handlePhotoUpload(file);
    }
  };

  if (loading && !profile.id) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>Profile</Typography>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading profile...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          My Profile
        </Typography>
        <Button
          variant="outlined"
          startIcon={<SettingsIcon />}
          onClick={() => setTabValue(2)}
        >
          Settings
        </Button>
      </Box>

      {/* Profile Header Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => setPhotoDialogOpen(true)}
                  sx={{
                    bgcolor: 'background.paper',
                    '&:hover': { bgcolor: 'background.paper' }
                  }}
                >
                  <PhotoCameraIcon fontSize="small" />
                </IconButton>
              }
            >
              <Avatar
                src={profile.profilePhotoUrl}
                sx={{ width: 120, height: 120, fontSize: 48 }}
              >
                {!profile.profilePhotoUrl && `${profile.firstName[0]}${profile.lastName[0]}`}
              </Avatar>
            </Badge>
            
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" gutterBottom>
                {profile.displayName}
              </Typography>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {profile.jobTitle}
              </Typography>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                {profile.department} • {profile.location}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Chip
                  icon={<EmailIcon />}
                  label={profile.email}
                  variant="outlined"
                  size="small"
                />
                {profile.phone && (
                  <Chip
                    icon={<PhoneIcon />}
                    label={profile.phone}
                    variant="outlined"
                    size="small"
                  />
                )}
              </Stack>
            </Box>

            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">
                Member since
              </Typography>
              <Typography variant="body2">
                {new Date(profile.createdDate).toLocaleDateString()}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Last login
              </Typography>
              <Typography variant="body2">
                {profile.lastLoginDate ? new Date(profile.lastLoginDate).toLocaleString() : 'Never'}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          aria-label="profile tabs"
        >
          <Tab label="Personal Info" icon={<PersonIcon />} />
          <Tab label="Activity" icon={<TimelineIcon />} />
          <Tab label="Preferences" icon={<SettingsIcon />} />
          <Tab label="Security" icon={<SecurityIcon />} />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {/* Personal Information Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Basic Information</Typography>
                  {editingSection !== 'basic' ? (
                    <Button
                      startIcon={<EditIcon />}
                      onClick={() => {
                        setEditingSection('basic');
                        setEditForm({
                          firstName: profile.firstName,
                          lastName: profile.lastName,
                          displayName: profile.displayName,
                          jobTitle: profile.jobTitle,
                          department: profile.department,
                          location: profile.location,
                          phone: profile.phone,
                          bio: profile.bio,
                        });
                      }}
                    >
                      Edit
                    </Button>
                  ) : (
                    <Stack direction="row" spacing={1}>
                      <Button
                        startIcon={<SaveIcon />}
                        variant="contained"
                        onClick={handleSaveProfile}
                        disabled={loading}
                      >
                        Save
                      </Button>
                      <Button
                        startIcon={<CancelIcon />}
                        onClick={() => {
                          setEditingSection(null);
                          setEditForm({});
                        }}
                      >
                        Cancel
                      </Button>
                    </Stack>
                  )}
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="First Name"
                      value={editingSection === 'basic' ? (editForm.firstName || '') : profile.firstName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                      disabled={editingSection !== 'basic'}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Last Name"
                      value={editingSection === 'basic' ? (editForm.lastName || '') : profile.lastName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                      disabled={editingSection !== 'basic'}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Display Name"
                      value={editingSection === 'basic' ? (editForm.displayName || '') : profile.displayName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
                      disabled={editingSection !== 'basic'}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Job Title"
                      value={editingSection === 'basic' ? (editForm.jobTitle || '') : profile.jobTitle}
                      onChange={(e) => setEditForm(prev => ({ ...prev, jobTitle: e.target.value }))}
                      disabled={editingSection !== 'basic'}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Department"
                      value={editingSection === 'basic' ? (editForm.department || '') : profile.department}
                      onChange={(e) => setEditForm(prev => ({ ...prev, department: e.target.value }))}
                      disabled={editingSection !== 'basic'}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Location"
                      value={editingSection === 'basic' ? (editForm.location || '') : profile.location}
                      onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                      disabled={editingSection !== 'basic'}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Phone"
                      value={editingSection === 'basic' ? (editForm.phone || '') : profile.phone}
                      onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                      disabled={editingSection !== 'basic'}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Bio"
                      multiline
                      rows={3}
                      value={editingSection === 'basic' ? (editForm.bio || '') : profile.bio}
                      onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                      disabled={editingSection !== 'basic'}
                      placeholder="Tell us about yourself..."
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Skills & Languages */}
          <Grid item xs={12} md={4}>
            <Stack spacing={3}>
              {/* Skills */}
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Skills</Typography>
                    {editingSection !== 'skills' ? (
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => {
                          setEditingSection('skills');
                          setEditForm({ skills: [...profile.skills] });
                        }}
                      >
                        Edit
                      </Button>
                    ) : (
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          startIcon={<SaveIcon />}
                          variant="contained"
                          onClick={handleSaveProfile}
                        >
                          Save
                        </Button>
                        <Button
                          size="small"
                          startIcon={<CancelIcon />}
                          onClick={() => {
                            setEditingSection(null);
                            setEditForm({});
                          }}
                        >
                          Cancel
                        </Button>
                      </Stack>
                    )}
                  </Box>

                  {editingSection === 'skills' && (
                    <Box sx={{ mb: 2 }}>
                      <Stack direction="row" spacing={1}>
                        <TextField
                          size="small"
                          placeholder="Add skill"
                          value={newSkill}
                          onChange={(e) => setNewSkill(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddSkill()}
                        />
                        <Button size="small" onClick={handleAddSkill}>Add</Button>
                      </Stack>
                    </Box>
                  )}

                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                    {(editingSection === 'skills' ? editForm.skills || [] : profile.skills).map((skill) => (
                      <Chip
                        key={skill}
                        label={skill}
                        color="primary"
                        variant="outlined"
                        onDelete={editingSection === 'skills' ? () => handleRemoveSkill(skill) : undefined}
                      />
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              {/* Languages */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Languages</Typography>
                  <Stack spacing={1}>
                    {profile.languages.map((language) => (
                      <Chip
                        key={language}
                        label={language}
                        icon={<LanguageIcon />}
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              {/* Social Links */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Social Links</Typography>
                  <Stack spacing={2}>
                    {profile.socialLinks.linkedin && (
                      <Button
                        variant="outlined"
                        startIcon={<WorkIcon />}
                        href={profile.socialLinks.linkedin}
                        target="_blank"
                        fullWidth
                      >
                        LinkedIn
                      </Button>
                    )}
                    {profile.socialLinks.github && (
                      <Button
                        variant="outlined"
                        startIcon={<SchoolIcon />}
                        href={profile.socialLinks.github}
                        target="_blank"
                        fullWidth
                      >
                        GitHub
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Activity Tab */}
      <TabPanel value={tabValue} index={1}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Recent Activity</Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Action</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>IP Address</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activityLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Chip
                          label={log.action}
                          size="small"
                          color={
                            log.action === 'LOGIN' ? 'success' :
                            log.action === 'PROFILE_UPDATE' ? 'info' :
                            log.action === 'PASSWORD_CHANGE' ? 'warning' :
                            'default'
                          }
                        />
                      </TableCell>
                      <TableCell>{log.description}</TableCell>
                      <TableCell>
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {log.ipAddress}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Preferences Tab */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          {/* Theme & Language */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <PaletteIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Appearance
                </Typography>
                <Stack spacing={3}>
                  <FormControl fullWidth>
                    <InputLabel>Theme</InputLabel>
                    <Select
                      value={profile.preferences.theme}
                      onChange={(e) => handlePreferenceChange('theme', 'theme', e.target.value)}
                      label="Theme"
                    >
                      <MenuItem value="light">Light</MenuItem>
                      <MenuItem value="dark">Dark</MenuItem>
                      <MenuItem value="auto">Auto</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <FormControl fullWidth>
                    <InputLabel>Language</InputLabel>
                    <Select
                      value={profile.preferences.language}
                      onChange={(e) => handlePreferenceChange('language', 'language', e.target.value)}
                      label="Language"
                    >
                      <MenuItem value="en">English</MenuItem>
                      <MenuItem value="es">Spanish</MenuItem>
                      <MenuItem value="fr">French</MenuItem>
                      <MenuItem value="de">German</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl fullWidth>
                    <InputLabel>Timezone</InputLabel>
                    <Select
                      value={profile.preferences.timezone}
                      onChange={(e) => handlePreferenceChange('timezone', 'timezone', e.target.value)}
                      label="Timezone"
                    >
                      <MenuItem value="America/Los_Angeles">Pacific Time (PT)</MenuItem>
                      <MenuItem value="America/Denver">Mountain Time (MT)</MenuItem>
                      <MenuItem value="America/Chicago">Central Time (CT)</MenuItem>
                      <MenuItem value="America/New_York">Eastern Time (ET)</MenuItem>
                      <MenuItem value="UTC">UTC</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Notifications */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <NotificationsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Email Notifications
                </Typography>
                <List>
                  <ListItem>
                    <ListItemText
                      primary="Task Updates"
                      secondary="Receive notifications when tasks are assigned or updated"
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={profile.preferences.emailNotifications.taskUpdates}
                        onChange={(e) => handlePreferenceChange('emailNotifications', 'taskUpdates', e.target.checked)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Leave Approvals"
                      secondary="Receive notifications for leave request approvals"
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={profile.preferences.emailNotifications.leaveApprovals}
                        onChange={(e) => handlePreferenceChange('emailNotifications', 'leaveApprovals', e.target.checked)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="System Announcements"
                      secondary="Receive important system announcements"
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={profile.preferences.emailNotifications.systemAnnouncements}
                        onChange={(e) => handlePreferenceChange('emailNotifications', 'systemAnnouncements', e.target.checked)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Weekly Reports"
                      secondary="Receive weekly activity reports"
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={profile.preferences.emailNotifications.weeklyReports}
                        onChange={(e) => handlePreferenceChange('emailNotifications', 'weeklyReports', e.target.checked)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Privacy Settings */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Privacy Settings
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={profile.preferences.privacy.profileVisible}
                          onChange={(e) => handlePreferenceChange('privacy', 'profileVisible', e.target.checked)}
                        />
                      }
                      label="Make profile visible to colleagues"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={profile.preferences.privacy.showEmail}
                          onChange={(e) => handlePreferenceChange('privacy', 'showEmail', e.target.checked)}
                        />
                      }
                      label="Show email address"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={profile.preferences.privacy.showPhone}
                          onChange={(e) => handlePreferenceChange('privacy', 'showPhone', e.target.checked)}
                        />
                      }
                      label="Show phone number"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Security Tab */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Password & Security
                </Typography>
                <Stack spacing={2}>
                  <Alert severity="info">
                    We recommend changing your password regularly to keep your account secure.
                  </Alert>
                  <Button
                    variant="outlined"
                    onClick={() => setPasswordDialogOpen(true)}
                    startIcon={<SecurityIcon />}
                  >
                    Change Password
                  </Button>
                  <Divider />
                  <Typography variant="subtitle2">Account Status</Typography>
                  <Box>
                    <Chip
                      label={profile.isActive ? 'Active' : 'Inactive'}
                      color={profile.isActive ? 'success' : 'error'}
                      icon={<BadgeIcon />}
                    />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <DownloadIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Data Export
                </Typography>
                <Stack spacing={2}>
                  <Alert severity="info">
                    Download a copy of your personal data stored in TaskFlow.
                  </Alert>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => {
                      // TODO: Implement data export functionality
                      showInfo('Data export functionality will be implemented');
                    }}
                  >
                    Export My Data
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Photo Upload Dialog */}
      <Dialog open={photoDialogOpen} onClose={() => setPhotoDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Update Profile Photo</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Alert severity="info">
              Upload a new profile photo. Recommended size: 300x300px. Max file size: 5MB.
            </Alert>
            
            {uploadProgress > 0 && uploadProgress < 100 && (
              <Box>
                <Typography variant="body2" gutterBottom>
                  Uploading... {uploadProgress}%
                </Typography>
                <LinearProgress variant="determinate" value={uploadProgress} />
              </Box>
            )}

            <Button
              variant="contained"
              component="label"
              startIcon={<CloudUploadIcon />}
              disabled={loading}
              fullWidth
            >
              Choose Photo
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={handleFileInput}
              />
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPhotoDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Current Password"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
            />
            <TextField
              fullWidth
              label="New Password"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
              helperText="Password must be at least 8 characters long"
            />
            <TextField
              fullWidth
              label="Confirm New Password"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handlePasswordChange}
            variant="contained"
            disabled={loading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
          >
            {loading ? 'Changing...' : 'Change Password'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Profile;
