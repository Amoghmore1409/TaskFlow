import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
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
  Card,
  CardContent,
  Fab,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  LinearProgress,
  Alert,
  Snackbar,
  CircularProgress,
  Backdrop,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Assignment as AssignmentIcon,
  CalendarToday as CalendarIcon,
  MoreVert as MoreVertIcon,
  CloudUpload as CloudUploadIcon,
  Visibility as ViewIcon,
  CheckCircle as CompleteIcon,
  Schedule as ScheduleIcon,
  Flag as FlagIcon,
  AttachFile as AttachFileIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useAuth, useNotification } from '../../context';
import { TaskService } from '../../services/taskService';
import { FileService } from '../../services/fileService';

// AWS SDK imports for production use
// import { DynamoDBClient, ScanCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
// import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface Task {
  taskId: string; // Primary Key
  title: string;
  description: string;
  assignedBy: string; // userId of the manager who created the task
  assignedTo?: string; // userId of the user assigned (if already chosen)
  status: 'pending' | 'in-progress' | 'completed';
  dueDate: string; // ISO 8601 format
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  Task_Complexity: number; // 1–5 scale complexity score
  Required_Skills: string[]; // e.g., ["Python", "SQL", "AWS"]
  attachments?: string[]; // (Optional) S3 file URLs
}

interface TaskFormData {
  title: string;
  description: string;
  assignedTo: string;
  status: 'pending' | 'in-progress' | 'completed';
  dueDate: string;
  Task_Complexity: number;
  Required_Skills: string[];
  attachments?: string[];
}

// Mock tasks data (in production, fetch from DynamoDB)
const mockTasks: Task[] = [
  {
    taskId: '1',
    title: 'Implement user authentication',
    description: 'Set up AWS Cognito for user authentication and authorization',
    assignedBy: 'manager1',
    assignedTo: 'user1',
    status: 'in-progress',
    dueDate: '2025-10-15T00:00:00Z',
    createdAt: '2025-10-01T09:00:00Z',
    updatedAt: '2025-10-11T14:30:00Z',
    Task_Complexity: 4,
    Required_Skills: ['AWS', 'Node.js', 'Security', 'Cognito'],
    attachments: [],
  },
  {
    taskId: '2',
    title: 'Design dashboard UI',
    description: 'Create responsive dashboard layout with Material-UI components',
    assignedBy: 'manager1',
    assignedTo: 'user2',
    status: 'completed',
    dueDate: '2025-10-12T00:00:00Z',
    createdAt: '2025-10-05T10:00:00Z',
    updatedAt: '2025-10-10T16:45:00Z',
    Task_Complexity: 3,
    Required_Skills: ['React', 'Material-UI', 'TypeScript', 'CSS'],
    attachments: ['https://s3.amazonaws.com/taskflow-attachments/dashboard-mockup.pdf'],
  },
  {
    taskId: '3',
    title: 'Set up CI/CD pipeline',
    description: 'Configure AWS CodePipeline for automated deployment',
    assignedBy: 'manager1',
    assignedTo: 'user1',
    status: 'pending',
    dueDate: '2025-10-20T00:00:00Z',
    createdAt: '2025-10-08T11:00:00Z',
    updatedAt: '2025-10-08T11:00:00Z',
    Task_Complexity: 5,
    Required_Skills: ['AWS', 'DevOps', 'CodePipeline', 'Docker'],
    attachments: [],
  },
];

const Tasks: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  
  // Helper methods for different notification types (memoized to prevent re-renders)
  const showSuccess = useCallback((message: string) => showNotification(message, 'success'), [showNotification]);
  const showError = useCallback((message: string) => showNotification(message, 'error'), [showNotification]);
  
  // State management
  const [tasks, setTasks] = useState<Task[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    assignedTo: '',
    status: 'pending',
    dueDate: '',
    Task_Complexity: 1,
    Required_Skills: [],
  });

  // Mock team members (in production, fetch from DynamoDB Users table)
  const teamMembers = useMemo(() => [
    { id: 'user1', name: 'John Doe', avatar: '', department: 'Engineering' },
    { id: 'user2', name: 'Jane Smith', avatar: '', department: 'Design' },
    { id: 'user3', name: 'Mike Johnson', avatar: '', department: 'Marketing' },
    { id: 'user4', name: 'Sarah Wilson', avatar: '', department: 'Engineering' },
  ], []);

  // Initialize tasks - fetch from Lambda API
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setInitialLoading(true);
        console.log('Attempting to fetch tasks from API...');
        const fetchedTasks = await TaskService.getAllTasks();
        console.log('API Response:', fetchedTasks);
        setTasks(fetchedTasks);
        
        // If no tasks exist in the API, you can optionally load mock data
        if (fetchedTasks.length === 0) {
          console.log('No tasks found in API, using mock data for development');
          setTasks(mockTasks);
        }
      } catch (error) {
        console.error('Detailed API Error:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          error: error,
          stack: error instanceof Error ? error.stack : undefined
        });
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('CORS')) {
          showError('CORS Issue: Your API needs to allow requests from localhost:3000. Configure CORS in API Gateway or check the troubleshooting guide.');
        } else {
          showError(`API Connection Failed: ${errorMessage}. Using mock data for development.`);
        }
        
        // Fallback to mock data if API fails
        setTasks(mockTasks);
      } finally {
        setInitialLoading(false);
      }
    };
    
    fetchTasks();
  }, [showError]); // Added showError to dependencies

  // Filter and search tasks (memoized to prevent unnecessary re-calculations)
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesComplexity = filterPriority === 'all' || 
        (filterPriority === 'low' && task.Task_Complexity <= 2) ||
        (filterPriority === 'medium' && task.Task_Complexity === 3) ||
        (filterPriority === 'high' && task.Task_Complexity >= 4);
      const assigneeName = teamMembers.find(m => m.id === task.assignedTo)?.name || 'Unassigned';
      
      // Safe string operations with null checks
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = (task.title || '').toLowerCase().includes(searchLower) ||
                           (task.description || '').toLowerCase().includes(searchLower) ||
                           (assigneeName || '').toLowerCase().includes(searchLower) ||
                           (task.Required_Skills || []).some(skill => (skill || '').toLowerCase().includes(searchLower));
      
      return matchesStatus && matchesComplexity && matchesSearch;
    });
  }, [tasks, filterStatus, filterPriority, searchTerm, teamMembers]);

  // Create or update task
  const handleSaveTask = async () => {
    try {
      if (!formData.title.trim()) {
        showError('Task title is required');
        return;
      }

      setLoading(true);

      // Upload files if any are selected
      let uploadedFileUrls: string[] = formData.attachments || [];
      if (selectedFiles.length > 0) {
        setUploading(true);
        try {
          console.log(`Uploading ${selectedFiles.length} files...`);
          const userId = user?.id || 'user-manager-12345';
          const fileUrls = await FileService.uploadFiles(selectedFiles, userId);
          uploadedFileUrls = [...uploadedFileUrls, ...fileUrls];
          console.log('Files uploaded successfully:', fileUrls);
        } catch (uploadError) {
          console.error('File upload failed:', uploadError);
          showError(`File upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
          setLoading(false);
          setUploading(false);
          return;
        } finally {
          setUploading(false);
        }
      }

      const taskRequestData = {
        title: formData.title,
        description: formData.description,
        assignedBy: user?.id || 'user-manager-12345', // Use actual user ID from auth context
        assignedTo: formData.assignedTo || undefined,
        status: formData.status,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : new Date().toISOString(),
        Task_Complexity: formData.Task_Complexity,
        Required_Skills: formData.Required_Skills,
        attachments: uploadedFileUrls,
      };

      let updatedTask: Task;

      if (editingTask) {
        // Update existing task via API
        updatedTask = await TaskService.updateTask(editingTask.taskId, taskRequestData);
        setTasks(prev => prev.map(task => task.taskId === editingTask.taskId ? updatedTask : task));
        showSuccess('Task updated successfully');
      } else {
        // Create new task via API
        updatedTask = await TaskService.createTask(taskRequestData);
        setTasks(prev => [...prev, updatedTask]);
        
        // Show different message for mock tasks vs real API tasks
        if (updatedTask && updatedTask.taskId && updatedTask.taskId.startsWith('mock-')) {
          showSuccess('Task created successfully (offline mode - configure API Gateway CORS for full functionality)');
        } else {
          showSuccess('Task created successfully');
        }
      }

      handleCloseDialog();
    } catch (error) {
      console.error('Error saving task:', error);
      showError(`Failed to ${editingTask ? 'update' : 'create'} task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete task
  const handleDeleteTask = async (task: Task) => {
    try {
      setLoading(true);
      
      // Delete task via API
      await TaskService.deleteTask(task.taskId);
      
      // Update local state
      setTasks(prev => prev.filter(t => t.taskId !== task.taskId));
      showSuccess('Task deleted successfully');
      setDeleteConfirmOpen(false);
      setTaskToDelete(null);
    } catch (error) {
      console.error('Error deleting task:', error);
      showError(`Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // File upload to S3
  const handleFileUpload = async (file: File, taskId: string) => {
    try {
      setUploading(true);
      
      // TODO: Replace with actual S3 upload
      // const s3Client = new S3Client({ region: 'us-east-1' });
      // const uploadCommand = new PutObjectCommand({
      //   Bucket: 'taskflow-attachments',
      //   Key: `tasks/${taskId}/${file.name}`,
      //   Body: file,
      //   ContentType: file.type,
      // });
      // await s3Client.send(uploadCommand);

      // Mock upload delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      const attachmentUrl = `https://taskflow-attachments.s3.amazonaws.com/tasks/${taskId}/${file.name}`;

      setTasks(prev => prev.map(task => 
        task.taskId === taskId 
          ? { ...task, attachments: [...(task.attachments || []), attachmentUrl] }
          : task
      ));

      showSuccess('File uploaded successfully');
    } catch (error) {
      console.error('Error uploading file:', error);
      showError('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  // Update task status quickly
  const handleStatusChange = async (taskId: string, newStatus: Task['status']) => {
    try {
      // Optimistically update the UI first for better UX
      setTasks(prev => prev.map(task => 
        task.taskId === taskId 
          ? { ...task, status: newStatus, updatedAt: new Date().toISOString() }
          : task
      ));
      
      // Update via API
      const updatedTask = await TaskService.updateTaskStatus(taskId, newStatus);
      
      // Sync with API response (in case there are server-side modifications)
      setTasks(prev => prev.map(task => 
        task.taskId === taskId ? updatedTask : task
      ));
      
      showSuccess(`Task status updated to ${(newStatus || 'pending').replace('-', ' ')}`);
    } catch (error) {
      console.error('Error updating task status:', error);
      
      // Revert optimistic update on error
      const originalTask = tasks.find(t => t.taskId === taskId);
      if (originalTask) {
        setTasks(prev => prev.map(task => 
          task.taskId === taskId ? originalTask : task
        ));
      }
      
      showError(`Failed to update task status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Dialog handlers
  const handleOpenDialog = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title || '',
        description: task.description || '',
        assignedTo: task.assignedTo || '',
        status: task.status || 'pending',
        dueDate: (task.dueDate || new Date().toISOString()).split('T')[0], // Extract date part for input field
        Task_Complexity: task.Task_Complexity || 1,
        Required_Skills: Array.isArray(task.Required_Skills) ? task.Required_Skills : [],
      });
    } else {
      setEditingTask(null);
      setFormData({
        title: '',
        description: '',
        assignedTo: '',
        status: 'pending',
        dueDate: '',
        Task_Complexity: 1,
        Required_Skills: [],
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTask(null);
    setSelectedFiles([]);
  };

  // Menu handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, task: Task) => {
    setMenuAnchor(event.currentTarget);
    setSelectedTask(task);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedTask(null);
  };

  // Complexity color mapping
  const getComplexityColor = (complexity: number) => {
    if (complexity >= 4) return 'error'; // High complexity (4-5)
    if (complexity === 3) return 'warning'; // Medium complexity (3)
    if (complexity <= 2) return 'success'; // Low complexity (1-2)
    return 'default';
  };

  // Status color mapping
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in-progress': return 'primary';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Initial Loading State */}
      {initialLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ ml: 2 }}>
            Loading tasks...
          </Typography>
        </Box>
      ) : (
        <>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" component="h1">
              Tasks Management
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{ borderRadius: 2 }}
            >
              Create Task
            </Button>
          </Box>

          {/* API Tester removed - issue identified as API Gateway CORS configuration */}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AssignmentIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{tasks.length}</Typography>
                  <Typography color="textSecondary">Total Tasks</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ScheduleIcon color="warning" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">
                    {tasks.filter(t => t.status === 'in-progress').length}
                  </Typography>
                  <Typography color="textSecondary">In Progress</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CompleteIcon color="success" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">
                    {tasks.filter(t => t.status === 'completed').length}
                  </Typography>
                  <Typography color="textSecondary">Completed</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FlagIcon color="error" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">
                    {tasks.filter(t => t.Task_Complexity >= 4).length}
                  </Typography>
                  <Typography color="textSecondary">High Complexity</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="in-progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Complexity</InputLabel>
              <Select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                label="Complexity"
              >
                <MenuItem value="all">All Complexity</MenuItem>
                <MenuItem value="low">Low (1-2)</MenuItem>
                <MenuItem value="medium">Medium (3)</MenuItem>
                <MenuItem value="high">High (4-5)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Typography variant="body2" color="textSecondary">
              {filteredTasks.length} of {tasks.length} tasks
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Tasks Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Task</TableCell>
              <TableCell>Assignee</TableCell>
              <TableCell>Complexity</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTasks.map((task) => (
              <TableRow key={task.taskId} hover>
                <TableCell>
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {task.title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" noWrap>
                      {task.description}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      {(Array.isArray(task.Required_Skills) ? task.Required_Skills : []).map((skill) => (
                        <Chip
                          key={skill}
                          label={skill}
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {task.assignedTo ? (
                      <>
                        <Avatar sx={{ width: 32, height: 32, mr: 1 }}>
                          {teamMembers.find(m => m.id === task.assignedTo)?.name?.charAt(0) || 'U'}
                        </Avatar>
                        <Typography variant="body2">
                          {teamMembers.find(m => m.id === task.assignedTo)?.name || 'Unknown'}
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body2" color="textSecondary">
                        Unassigned
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={`Level ${task.Task_Complexity}`}
                    color={getComplexityColor(task.Task_Complexity) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={(task.status || 'pending').replace('-', ' ').toUpperCase()}
                    color={getStatusColor(task.status || 'pending') as any}
                    size="small"
                    onClick={() => {
                      const statuses: Task['status'][] = ['pending', 'in-progress', 'completed'];
                      const currentIndex = statuses.indexOf(task.status || 'pending');
                      const nextStatus = statuses[(currentIndex + 1) % statuses.length];
                      handleStatusChange(task.taskId, nextStatus);
                    }}
                    sx={{ cursor: 'pointer' }}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CalendarIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      {new Date(task.dueDate).toLocaleDateString()}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {new Date(task.createdAt).toLocaleDateString()}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {new Date(task.createdAt).toLocaleTimeString()}
                  </Typography>
                </TableCell>
                <TableCell>
                  <IconButton
                    onClick={(e) => handleMenuOpen(e, task)}
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

      {filteredTasks.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <AssignmentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="textSecondary">
            No tasks found
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            {searchTerm || filterStatus !== 'all' || filterPriority !== 'all'
              ? 'Try adjusting your filters or search terms'
              : 'Create your first task to get started'
            }
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Create Task
          </Button>
        </Box>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { handleOpenDialog(selectedTask!); handleMenuClose(); }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit Task</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleOpenDialog(selectedTask!); handleMenuClose(); }}>
          <ListItemIcon><ViewIcon fontSize="small" /></ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { 
          if (selectedTask) {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.onchange = (e) => {
              const files = (e.target as HTMLInputElement).files;
              if (files) {
                Array.from(files).forEach(file => {
                  handleFileUpload(file, selectedTask.taskId);
                });
              }
            };
            input.click();
          }
          handleMenuClose();
        }}>
          <ListItemIcon><CloudUploadIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Upload Attachment</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={() => {
            setTaskToDelete(selectedTask);
            setDeleteConfirmOpen(true);
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete Task</ListItemText>
        </MenuItem>
      </Menu>

      {/* Task Form Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTask ? 'Edit Task' : 'Create New Task'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Task Title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Assign To</InputLabel>
                <Select
                  value={formData.assignedTo}
                  onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                  label="Assign To"
                >
                  <MenuItem value="">
                    <Typography color="textSecondary">Unassigned</Typography>
                  </MenuItem>
                  {teamMembers.map((member) => (
                    <MenuItem key={member.id} value={member.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ width: 24, height: 24, mr: 1 }}>
                          {member.name.charAt(0)}
                        </Avatar>
                        {member.name} ({member.department})
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Task Complexity</InputLabel>
                <Select
                  value={formData.Task_Complexity}
                  onChange={(e) => setFormData(prev => ({ ...prev, Task_Complexity: Number(e.target.value) }))}
                  label="Task Complexity"
                >
                  <MenuItem value={1}>Level 1 - Very Easy</MenuItem>
                  <MenuItem value={2}>Level 2 - Easy</MenuItem>
                  <MenuItem value={3}>Level 3 - Medium</MenuItem>
                  <MenuItem value={4}>Level 4 - Hard</MenuItem>
                  <MenuItem value={5}>Level 5 - Very Hard</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  label="Status"
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in-progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Due Date"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Required Skills (comma separated)"
                value={Array.isArray(formData.Required_Skills) ? formData.Required_Skills.join(', ') : ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  Required_Skills: e.target.value.split(',').map(skill => skill.trim()).filter(Boolean)
                }))}
                placeholder="Python, SQL, AWS, React"
                helperText="Enter the skills required for this task, separated by commas"
              />
            </Grid>
            
            {/* File Upload Section */}
            <Grid item xs={12}>
              <Box sx={{ border: '1px dashed #ccc', borderRadius: 1, p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Attachments
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AttachFileIcon />}
                    component="label"
                  >
                    Upload Files
                    <input
                      type="file"
                      multiple
                      hidden
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setSelectedFiles((prev: File[]) => [...prev, ...files]);
                      }}
                    />
                  </Button>
                </Box>
                
                {/* Display selected files */}
                {selectedFiles.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="textSecondary">
                      Selected files ({selectedFiles.length}):
                    </Typography>
                    {selectedFiles.map((file: File, index: number) => (
                      <Box
                        key={index}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          mt: 1,
                          p: 1,
                          bgcolor: 'grey.100',
                          borderRadius: 1,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AttachFileIcon fontSize="small" />
                          <Typography variant="body2">{file.name}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            ({(file.size / 1024).toFixed(2)} KB)
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedFiles((prev: File[]) => prev.filter((_: File, i: number) => i !== index));
                          }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}
                
                {/* Display existing attachments for editing */}
                {editingTask && formData.attachments && formData.attachments.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="textSecondary">
                      Existing attachments:
                    </Typography>
                    {formData.attachments.map((url, index) => (
                      <Box
                        key={index}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          mt: 1,
                          p: 1,
                          bgcolor: 'grey.50',
                          borderRadius: 1,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AttachFileIcon fontSize="small" />
                          <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                            {url.split('/').pop()}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              attachments: prev.attachments?.filter((_, i) => i !== index)
                            }));
                          }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>Cancel</Button>
          <Button 
            onClick={handleSaveTask} 
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            {loading ? 'Saving...' : `${editingTask ? 'Update' : 'Create'} Task`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Task</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{taskToDelete?.title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={loading}>Cancel</Button>
          <Button 
            onClick={() => taskToDelete && handleDeleteTask(taskToDelete)} 
            color="error"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Progress */}
      {uploading && (
        <Snackbar open={uploading}>
          <Alert severity="info" sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography sx={{ mr: 2 }}>Uploading file...</Typography>
              <LinearProgress sx={{ flexGrow: 1 }} />
            </Box>
          </Alert>
        </Snackbar>
      )}

          {/* Floating Action Button for Quick Task Creation */}
          <Tooltip title="Create Task">
            <Fab
              color="primary"
              aria-label="add task"
              sx={{ position: 'fixed', bottom: 24, right: 24 }}
              onClick={() => handleOpenDialog()}
            >
              <AddIcon />
            </Fab>
          </Tooltip>
        </>
      )}

      {/* Loading Backdrop */}
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={loading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </Box>
  );
};

export default Tasks;
