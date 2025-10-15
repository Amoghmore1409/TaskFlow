import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Stack,
  Avatar,
  LinearProgress,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  Add as AddIcon,
  Check as ApproveIcon,
  Close as RejectIcon,
  Visibility as ViewIcon,
  CalendarToday as CalendarIcon,
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Schedule as ScheduleIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuth, useNotification } from '../../context';
import { getLeaveRequests, createLeaveRequest, updateLeaveRequestStatus } from '../../services/leaveApi';

// TODO: AWS SDK Configuration - Add your AWS credentials and region
// ================================================================
// STEP 1: Install AWS SDK packages
// npm install @aws-sdk/client-dynamodb @aws-sdk/client-sns @aws-sdk/client-s3 @aws-sdk/client-ses @aws-sdk/client-lambda

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
// import { DynamoDBClient, ScanCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
// import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
// import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
// import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
// import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

// TODO: AWS Configuration - Update these values for your environment
// ================================================================
// const AWS_CONFIG = {
//   region: 'us-east-1', // TODO: Change to your preferred AWS region
//   dynamoTableName: 'TaskFlow-LeaveRequests', // TODO: Change to your DynamoDB table name
//   s3BucketName: 'taskflow-leave-attachments', // TODO: Change to your S3 bucket name
//   snsTopicArn: 'arn:aws:sns:us-east-1:YOUR_ACCOUNT_ID:leave-notifications', // TODO: Add your SNS topic ARN
//   sesSourceEmail: 'noreply@yourdomain.com', // TODO: Add your verified SES email
//   lambdaFunctionName: 'taskflow-leave-workflow', // TODO: Add your Lambda function name
// };

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeDepartment: string;
  leaveType: 'vacation' | 'sick' | 'personal' | 'maternity' | 'paternity' | 'emergency';
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  submittedDate: string;
  lastUpdated: string;
  approvalWorkflow: ApprovalStep[];
  attachments: Attachment[];
  comments: Comment[];
  emergencyContact?: EmergencyContact;
  coveringEmployee?: string;
  coveringEmployeeName?: string;
}

interface ApprovalStep {
  id: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  status: 'pending' | 'approved' | 'rejected';
  decision: string;
  decidedDate?: string;
  order: number;
}

interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  s3Key: string;
  uploadedDate: string;
  uploadedBy: string;
}

interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: string;
  isInternal: boolean;
}

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

interface LeaveFormData {
  leaveType: LeaveRequest['leaveType'];
  startDate: Date | null;
  endDate: Date | null;
  reason: string;
  coveringEmployee: string;
  emergencyContact: EmergencyContact;
  attachments: File[];
}

// Mock employees data for covering employee selection
const mockEmployees = [
  { id: 'emp001', name: 'John Doe', department: 'Engineering', email: 'john.doe@company.com' },
  { id: 'emp002', name: 'Jane Smith', department: 'Design', email: 'jane.smith@company.com' },
  { id: 'emp003', name: 'Mike Johnson', department: 'Marketing', email: 'mike.johnson@company.com' },
  { id: 'emp004', name: 'Sarah Wilson', department: 'Engineering', email: 'sarah.wilson@company.com' },
];

const LeaveRequests: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  // Helper notification functions
  const showSuccess = useCallback((message: string) => showNotification(message, 'success'), [showNotification]);
  const showError = useCallback((message: string) => showNotification(message, 'error'), [showNotification]);
  const showInfo = useCallback((message: string) => showNotification(message, 'info'), [showNotification]);

  // State management
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [openApprovalDialog, setOpenApprovalDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState<LeaveFormData>({
    leaveType: 'vacation',
    startDate: null,
    endDate: null,
    reason: '',
    coveringEmployee: '',
    emergencyContact: {
      name: '',
      relationship: '',
      phone: '',
      email: '',
    },
    attachments: [],
  });

  // Helper function to fetch leave requests
  const fetchLeaveRequests = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch data from API
      const apiData = await getLeaveRequests();
      console.log('Raw API data:', apiData);
      
      // Map API data to LeaveRequest interface
      const mappedRequests: LeaveRequest[] = apiData.map(item => ({
        id: item.leaveRequestId,
        employeeId: item.userId,
        employeeName: item.employeeName || 'Unknown Employee',
        employeeEmail: `${item.employeeName?.toLowerCase().replace(' ', '.')}@company.com` || 'unknown@company.com',
        employeeDepartment: 'Unknown Department', // Add when available in API
        leaveType: (item.leaveType || 'vacation') as LeaveRequest['leaveType'],
        startDate: item.startDate,
        endDate: item.endDate,
        totalDays: item.totalDays,
        reason: item.reason,
        status: (item.status || 'pending') as LeaveRequest['status'],
        submittedDate: item.createdAt,
        lastUpdated: item.updatedAt || item.createdAt,
        approvalWorkflow: [], // Default empty workflow
        attachments: [], // Default empty attachments
        comments: [], // Default empty comments
      }));
      
      console.log('Mapped requests:', mappedRequests);
      console.log('Setting leaveRequests to:', mappedRequests.length, 'items');
      
      setLeaveRequests(mappedRequests);
      showInfo(`Leave requests loaded successfully - ${mappedRequests.length} requests found`);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      showError('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  }, [showError, showInfo]);

  // TODO: AWS DynamoDB Integration - Load leave requests from DynamoDB
  // ================================================================
  useEffect(() => {
    fetchLeaveRequests();
  }, [fetchLeaveRequests, user?.id]);

  // Helper function to calculate days between dates
  const calculateDays = (startDate: Date | null, endDate: Date | null): number => {
    if (!startDate || !endDate) return 0;
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates
  };

  // TODO: AWS Lambda Integration - Submit leave request with workflow automation
  // ================================================================
  const handleSubmitLeaveRequest = async () => {
    try {
      if (!formData.startDate || !formData.endDate || !formData.reason.trim()) {
        showError('Please fill in all required fields');
        return;
      }

      if (formData.startDate && formData.endDate && formData.startDate >= formData.endDate) {
        showError('End date must be after start date');
        return;
      }

      setLoading(true);

      const totalDays = calculateDays(formData.startDate, formData.endDate);
      const requestId = Date.now().toString();

      // TODO: Upload attachments to S3 if any
      const attachmentPromises = formData.attachments.map(async (file) => {
        // const s3Client = new S3Client({ region: AWS_CONFIG.region });
        // const uploadCommand = new PutObjectCommand({
        //   Bucket: AWS_CONFIG.s3BucketName,
        //   Key: `leave-requests/${requestId}/${file.name}`,
        //   Body: file,
        //   ContentType: file.type,
        //   Metadata: {
        //     'uploaded-by': user?.id || '',
        //     'upload-date': new Date().toISOString()
        //   }
        // });
        // await s3Client.send(uploadCommand);
        
        return {
          id: Date.now().toString(),
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          s3Key: `leave-requests/${requestId}/${file.name}`,
          uploadedDate: new Date().toISOString(),
          uploadedBy: user?.name || 'Unknown',
        };
      });

      const attachments = await Promise.all(attachmentPromises);

      // TODO: Save to DynamoDB and trigger approval workflow via Lambda
      // const dynamoClient = new DynamoDBClient({ region: AWS_CONFIG.region });
      // const putCommand = new PutItemCommand({
      //   TableName: AWS_CONFIG.dynamoTableName,
      //   Item: {
      //     // TODO: Convert LeaveRequest object to DynamoDB item format
      //     id: { S: leaveRequest.id },
      //     employeeId: { S: leaveRequest.employeeId },
      //     // ... complete the mapping
      //   }
      // });
      // await dynamoClient.send(putCommand);

      // TODO: Trigger approval workflow via Lambda
      // const lambdaClient = new LambdaClient({ region: AWS_CONFIG.region });
      // const invokeCommand = new InvokeCommand({
      //   FunctionName: AWS_CONFIG.lambdaFunctionName,
      //   Payload: JSON.stringify({
      //     action: 'initiate-approval',
      //     leaveRequestId: requestId,
      //     employeeId: user?.id,
      //     leaveType: formData.leaveType,
      //     totalDays,
      //     department: user?.department
      //   })
      // });
      // await lambdaClient.send(invokeCommand);

      // TODO: Send notification emails via SES
      // const sesClient = new SESClient({ region: AWS_CONFIG.region });
      // const emailCommand = new SendEmailCommand({
      //   Source: AWS_CONFIG.sesSourceEmail,
      //   Destination: {
      //     ToAddresses: [user?.manager?.email] // TODO: Get manager email from user profile
      //   },
      //   Message: {
      //     Subject: { Data: `Leave Request Submitted - ${user?.name}` },
      //     Body: {
      //       Html: {
      //         Data: `
      //           <h2>New Leave Request Requires Your Approval</h2>
      //           <p><strong>Employee:</strong> ${user?.name}</p>
      //           <p><strong>Leave Type:</strong> ${formData.leaveType}</p>
      //           <p><strong>Dates:</strong> ${formData.startDate?.toDateString()} to ${formData.endDate?.toDateString()}</p>
      //           <p><strong>Reason:</strong> ${formData.reason}</p>
      //           <a href="https://taskflow.company.com/leave-requests/${requestId}">Review Request</a>
      //         `
      //       }
      //     }
      //   }
      // });
      // await sesClient.send(emailCommand);

      // TODO: Send SNS notification for real-time updates
      // const snsClient = new SNSClient({ region: AWS_CONFIG.region });
      // const publishCommand = new PublishCommand({
      //   TopicArn: AWS_CONFIG.snsTopicArn,
      //   Message: JSON.stringify({
      //     type: 'leave-request-submitted',
      //     requestId,
      //     employeeId: user?.id,
      //     employeeName: user?.name,
      //     leaveType: formData.leaveType,
      //     totalDays,
      //     submittedDate: new Date().toISOString()
      //   }),
      //   Subject: 'Leave Request Submitted'
      // });
      // await snsClient.send(publishCommand);

      // Create new request data for API
      const newRequestData = {
        userId: user?.id || '',
        employeeName: user?.name || '',
        leaveType: formData.leaveType,
        startDate: formData.startDate?.toISOString().split('T')[0] || '',
        endDate: formData.endDate?.toISOString().split('T')[0] || '',
        totalDays,
        reason: formData.reason,
      };

      console.log("Submitting this data to the API:", JSON.stringify(newRequestData, null, 2));

      // Submit request via API
      await createLeaveRequest(newRequestData);
      
      // Refresh the data
      await fetchLeaveRequests();
      
      showSuccess('Leave request submitted successfully!');
      handleCloseDialog();
    } catch (error) {
      console.error('Error submitting leave request:', error);
      showError('Failed to submit leave request');
    } finally {
      setLoading(false);
    }
  };

  // TODO: AWS DynamoDB Integration - Handle approval/rejection
  // ================================================================
  const handleApprovalDecision = async (request: LeaveRequest, decision: 'approved' | 'rejected', comments: string) => {
    try {
      setLoading(true);

      // TODO: Update approval workflow in DynamoDB
      // const dynamoClient = new DynamoDBClient({ region: AWS_CONFIG.region });
      // const updateCommand = new UpdateItemCommand({
      //   TableName: AWS_CONFIG.dynamoTableName,
      //   Key: { id: { S: request.id } },
      //   UpdateExpression: 'SET approvalWorkflow[0].#status = :status, approvalWorkflow[0].decision = :decision, approvalWorkflow[0].decidedDate = :decidedDate, lastUpdated = :lastUpdated',
      //   ExpressionAttributeNames: { '#status': 'status' },
      //   ExpressionAttributeValues: {
      //     ':status': { S: decision },
      //     ':decision': { S: comments },
      //     ':decidedDate': { S: new Date().toISOString() },
      //     ':lastUpdated': { S: new Date().toISOString() }
      //   }
      // });
      // await dynamoClient.send(updateCommand);

      // TODO: Send notification via SES
      // const sesClient = new SESClient({ region: AWS_CONFIG.region });
      // const emailCommand = new SendEmailCommand({
      //   Source: AWS_CONFIG.sesSourceEmail,
      //   Destination: { ToAddresses: [request.employeeEmail] },
      //   Message: {
      //     Subject: { Data: `Leave Request ${decision.toUpperCase()} - ${request.leaveType}` },
      //     Body: {
      //       Html: {
      //         Data: `
      //           <h2>Leave Request Update</h2>
      //           <p>Your leave request from ${request.startDate} to ${request.endDate} has been <strong>${decision}</strong>.</p>
      //           <p><strong>Comments:</strong> ${comments}</p>
      //           <p><strong>Approved by:</strong> ${user?.name}</p>
      //         `
      //       }
      //     }
      //   }
      // });
      // await sesClient.send(emailCommand);

      // Update request status via API
      await updateLeaveRequestStatus(request.id, decision);
      
      // Refresh the data
      await fetchLeaveRequests();

      showSuccess(`Leave request ${decision} successfully!`);
      setOpenApprovalDialog(false);
    } catch (error) {
      console.error('Error processing approval:', error);
      showError('Failed to process approval');
    } finally {
      setLoading(false);
    }
  };

  // File upload handler
  const handleFileUpload = (files: FileList | null) => {
    if (files) {
      const newFiles = Array.from(files);
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newFiles]
      }));
    }
  };

  // Filter leave requests
  const filteredRequests = leaveRequests.filter(request => {
    const matchesStatus = filterStatus === 'all' || request.status === filterStatus;
    const matchesType = filterType === 'all' || request.leaveType === filterType;
    return matchesStatus && matchesType;
  });

  // Get status color
  const getStatusColor = (status: string | undefined) => {
    if (!status) return 'default';
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'pending': return 'warning';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  // Get leave type color
  const getLeaveTypeColor = (type: string | undefined) => {
    if (!type) return 'default';
    switch (type) {
      case 'vacation': return 'primary';
      case 'sick': return 'error';
      case 'personal': return 'info';
      case 'maternity': return 'secondary';
      case 'paternity': return 'secondary';
      case 'emergency': return 'warning';
      default: return 'default';
    }
  };

  // Dialog handlers
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setFormData({
      leaveType: 'vacation',
      startDate: null,
      endDate: null,
      reason: '',
      coveringEmployee: '',
      emergencyContact: {
        name: '',
        relationship: '',
        phone: '',
        email: '',
      },
      attachments: [],
    });
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, request: LeaveRequest) => {
    setMenuAnchor(event.currentTarget);
    setSelectedRequest(request);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedRequest(null);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>Leave Requests</Typography>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading leave requests...</Typography>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Leave Management
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
            sx={{ borderRadius: 2 }}
          >
            Request Leave
          </Button>
        </Box>

        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <ScheduleIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4">
                      {leaveRequests.filter(r => r.status === 'pending').length}
                    </Typography>
                    <Typography color="textSecondary">Pending</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <ApproveIcon color="success" sx={{ mr: 2, fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4">
                      3
                    </Typography>
                    <Typography color="textSecondary">Approved</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <RejectIcon color="error" sx={{ mr: 2, fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4">
                      7
                    </Typography>
                    <Typography color="textSecondary">Rejected</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CalendarIcon color="info" sx={{ mr: 2, fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4">
                      10
                    </Typography>
                    <Typography color="textSecondary">Days Used</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Leave Type</InputLabel>
                <Select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  label="Leave Type"
                >
                  <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="vacation">Vacation</MenuItem>
                  <MenuItem value="sick">Sick</MenuItem>
                  <MenuItem value="personal">Personal</MenuItem>
                  <MenuItem value="maternity">Maternity</MenuItem>
                  <MenuItem value="paternity">Paternity</MenuItem>
                  <MenuItem value="emergency">Emergency</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="textSecondary">
                {filteredRequests.length} of {leaveRequests.length} requests
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Leave Requests Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Leave Type</TableCell>
                <TableCell>Dates</TableCell>
                <TableCell>Days</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRequests.map((request) => (
                <TableRow key={request.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar sx={{ width: 32, height: 32, mr: 1 }}>
                        {request.employeeName.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">
                          {request.employeeName}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {request.employeeDepartment}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={request.leaveType?.toUpperCase() || 'UNKNOWN'}
                      color={getLeaveTypeColor(request.leaveType) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {request.totalDays} days
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={request.status?.toUpperCase() || 'UNKNOWN'}
                      color={getStatusColor(request.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(request.submittedDate).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      onClick={(e) => handleMenuOpen(e, request)}
                      size="small"
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {filteredRequests.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <CalendarIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="textSecondary">
              No leave requests found
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              {filterStatus !== 'all' || filterType !== 'all'
                ? 'Try adjusting your filters'
                : 'Submit your first leave request to get started'
              }
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenDialog(true)}
            >
              Request Leave
            </Button>
          </Box>
        )}

        {/* Context Menu */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => { setOpenApprovalDialog(true); handleMenuClose(); }}>
            <ListItemIcon><ViewIcon fontSize="small" /></ListItemIcon>
            <ListItemText>View Details</ListItemText>
          </MenuItem>
          {selectedRequest?.status === 'pending' && (
            <>
              <MenuItem onClick={() => { /* Handle approve */ handleMenuClose(); }}>
                <ListItemIcon><ApproveIcon fontSize="small" color="success" /></ListItemIcon>
                <ListItemText>Approve</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => { /* Handle reject */ handleMenuClose(); }}>
                <ListItemIcon><RejectIcon fontSize="small" color="error" /></ListItemIcon>
                <ListItemText>Reject</ListItemText>
              </MenuItem>
            </>
          )}
          <Divider />
          <MenuItem onClick={() => { /* Handle download */ handleMenuClose(); }}>
            <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Download PDF</ListItemText>
          </MenuItem>
        </Menu>

        {/* Leave Request Form Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>Submit Leave Request</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Leave Type</InputLabel>
                  <Select
                    value={formData.leaveType}
                    onChange={(e) => setFormData(prev => ({ ...prev, leaveType: e.target.value as any }))}
                    label="Leave Type"
                  >
                    <MenuItem value="vacation">Vacation</MenuItem>
                    <MenuItem value="sick">Sick Leave</MenuItem>
                    <MenuItem value="personal">Personal</MenuItem>
                    <MenuItem value="maternity">Maternity</MenuItem>
                    <MenuItem value="paternity">Paternity</MenuItem>
                    <MenuItem value="emergency">Emergency</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Covering Employee</InputLabel>
                  <Select
                    value={formData.coveringEmployee}
                    onChange={(e) => setFormData(prev => ({ ...prev, coveringEmployee: e.target.value }))}
                    label="Covering Employee"
                  >
                    {mockEmployees.map((employee) => (
                      <MenuItem key={employee.id} value={employee.id}>
                        {employee.name} ({employee.department})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <DatePicker
                  label="Start Date"
                  value={formData.startDate}
                  onChange={(date) => setFormData(prev => ({ ...prev, startDate: date }))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DatePicker
                  label="End Date"
                  value={formData.endDate}
                  onChange={(date) => setFormData(prev => ({ ...prev, endDate: date }))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Reason for Leave"
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  multiline
                  rows={3}
                  required
                />
              </Grid>
              
              {/* Emergency Contact Section */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                  Emergency Contact (Optional)
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Contact Name"
                  value={formData.emergencyContact.name}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    emergencyContact: { ...prev.emergencyContact, name: e.target.value }
                  }))}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Relationship"
                  value={formData.emergencyContact.relationship}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    emergencyContact: { ...prev.emergencyContact, relationship: e.target.value }
                  }))}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={formData.emergencyContact.phone}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    emergencyContact: { ...prev.emergencyContact, phone: e.target.value }
                  }))}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.emergencyContact.email}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    emergencyContact: { ...prev.emergencyContact, email: e.target.value }
                  }))}
                />
              </Grid>

              {/* File Upload Section */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                  Supporting Documents (Optional)
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<UploadIcon />}
                  fullWidth
                >
                  Upload Files
                  <input
                    type="file"
                    multiple
                    hidden
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                </Button>
                {formData.attachments.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    {formData.attachments.map((file, index) => (
                      <Chip
                        key={index}
                        label={`${file.name} (${Math.round(file.size / 1024)}KB)`}
                        onDelete={() => setFormData(prev => ({
                          ...prev,
                          attachments: prev.attachments.filter((_, i) => i !== index)
                        }))}
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Box>
                )}
              </Grid>

              {/* Calculated Days Display */}
              {formData.startDate && formData.endDate && (
                <Grid item xs={12}>
                  <Alert severity="info">
                    Total Leave Days: {calculateDays(formData.startDate, formData.endDate)} days
                  </Alert>
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button 
              onClick={handleSubmitLeaveRequest} 
              variant="contained"
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Approval Dialog */}
        <Dialog open={openApprovalDialog} onClose={() => setOpenApprovalDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Leave Request Details</DialogTitle>
          <DialogContent>
            {selectedRequest && (
              <Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="textSecondary">Employee</Typography>
                    <Typography variant="body1">{selectedRequest.employeeName}</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="textSecondary">Department</Typography>
                    <Typography variant="body1">{selectedRequest.employeeDepartment}</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="textSecondary">Leave Type</Typography>
                    <Chip label={selectedRequest.leaveType?.toUpperCase() || 'UNKNOWN'} color={getLeaveTypeColor(selectedRequest.leaveType) as any} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                    <Chip label={selectedRequest.status?.toUpperCase() || 'UNKNOWN'} color={getStatusColor(selectedRequest.status) as any} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="textSecondary">Start Date</Typography>
                    <Typography variant="body1">{new Date(selectedRequest.startDate).toLocaleDateString()}</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="textSecondary">End Date</Typography>
                    <Typography variant="body1">{new Date(selectedRequest.endDate).toLocaleDateString()}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="textSecondary">Reason</Typography>
                    <Typography variant="body1">{selectedRequest.reason}</Typography>
                  </Grid>
                  
                  {/* Approval Workflow */}
                  <Grid item xs={12}>
                    <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Approval Workflow</Typography>
                    <Stepper orientation="vertical">
                      {selectedRequest.approvalWorkflow.map((step) => (
                        <Step key={step.id} active={step.status === 'pending'} completed={step.status === 'approved'}>
                          <StepLabel error={step.status === 'rejected'}>
                            {step.approverName} ({step.approverRole})
                          </StepLabel>
                          <StepContent>
                            <Typography variant="body2" color="textSecondary">
                              Status: {step.status}
                            </Typography>
                            {step.decision && (
                              <Typography variant="body2">
                                Decision: {step.decision}
                              </Typography>
                            )}
                            {step.decidedDate && (
                              <Typography variant="caption" color="textSecondary">
                                Decided on: {new Date(step.decidedDate).toLocaleDateString()}
                              </Typography>
                            )}
                          </StepContent>
                        </Step>
                      ))}
                    </Stepper>
                  </Grid>

                  {/* Attachments */}
                  {selectedRequest.attachments.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Attachments</Typography>
                      <Stack spacing={1}>
                        {selectedRequest.attachments.map((attachment) => (
                          <Chip
                            key={attachment.id}
                            label={`${attachment.fileName} (${Math.round(attachment.fileSize / 1024)}KB)`}
                            onClick={() => {
                              // TODO: Download from S3
                              showInfo('Download functionality will be implemented with S3 integration');
                            }}
                            clickable
                          />
                        ))}
                      </Stack>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            {selectedRequest?.status === 'pending' && (
              <>
                <Button 
                  onClick={() => handleApprovalDecision(selectedRequest, 'rejected', 'Rejected')}
                  color="error"
                  variant="outlined"
                >
                  Reject
                </Button>
                <Button 
                  onClick={() => handleApprovalDecision(selectedRequest, 'approved', 'Approved')}
                  color="success"
                  variant="contained"
                >
                  Approve
                </Button>
              </>
            )}
            <Button onClick={() => setOpenApprovalDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default LeaveRequests;