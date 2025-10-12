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
} from '@mui/icons-material';
import { useAuth, useNotification } from '../../context';

// AWS SDK imports for production use
// import { DynamoDBClient, ScanCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
// import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  assigneeName: string;
  assigneeAvatar?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'todo' | 'in-progress' | 'review' | 'completed';
  dueDate: string;
  createdDate: string;
  updatedDate: string;
  tags: string[];
  attachments: Attachment[];
  estimatedHours?: number;
  actualHours?: number;
  department: string;
  category: string;
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedBy: string;
  uploadedDate: string;
}

interface TaskFormData {
  title: string;
  description: string;
  assigneeId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'todo' | 'in-progress' | 'review' | 'completed';
  dueDate: string;
  tags: string[];
  estimatedHours: number;
  department: string;
  category: string;
}

// Mock tasks data (in production, fetch from DynamoDB)
const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Implement user authentication',
    description: 'Set up AWS Cognito for user authentication and authorization',
    assigneeId: '1',
    assigneeName: 'John Doe',
    priority: 'high',
    status: 'in-progress',
    dueDate: '2025-10-15',
    createdDate: '2025-10-01',
    updatedDate: '2025-10-11',
    tags: ['backend', 'security', 'aws'],
    attachments: [],
    estimatedHours: 16,
    actualHours: 8,
    department: 'Engineering',
    category: 'Development',
  },
  {
    id: '2',
    title: 'Design dashboard UI',
    description: 'Create responsive dashboard layout with Material-UI components',
    assigneeId: '2',
    assigneeName: 'Jane Smith',
    priority: 'medium',
    status: 'review',
    dueDate: '2025-10-12',
    createdDate: '2025-10-05',
    updatedDate: '2025-10-10',
    tags: ['frontend', 'ui', 'design'],
    attachments: [
      {
        id: 'att1',
        name: 'dashboard-mockup.pdf',
        url: '#',
        size: 2048576,
        type: 'application/pdf',
        uploadedBy: 'Jane Smith',
        uploadedDate: '2025-10-10',
      },
    ],
    estimatedHours: 12,
    actualHours: 10,
    department: 'Design',
    category: 'UI/UX',
  },
  {
    id: '3',
    title: 'Set up CI/CD pipeline',
    description: 'Configure AWS CodePipeline for automated deployment',
    assigneeId: '1',
    assigneeName: 'John Doe',
    priority: 'critical',
    status: 'todo',
    dueDate: '2025-10-20',
    createdDate: '2025-10-08',
    updatedDate: '2025-10-08',
    tags: ['devops', 'aws', 'automation'],
    attachments: [],
    estimatedHours: 24,
    department: 'Engineering',
    category: 'DevOps',
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
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    assigneeId: '',
    priority: 'medium',
    status: 'todo',
    dueDate: '',
    tags: [],
    estimatedHours: 0,
    department: '',
    category: '',
  });

  // Mock team members (in production, fetch from DynamoDB Users table)
  const teamMembers = [
    { id: '1', name: 'John Doe', avatar: '', department: 'Engineering' },
    { id: '2', name: 'Jane Smith', avatar: '', department: 'Design' },
    { id: '3', name: 'Mike Johnson', avatar: '', department: 'Marketing' },
    { id: '4', name: 'Sarah Wilson', avatar: '', department: 'Engineering' },
  ];

  // Initialize tasks (in production, fetch from DynamoDB)
  useEffect(() => {
    // For demo purposes, set data immediately
    setTasks(mockTasks);
    
    // In production, use this async function:
    // const fetchTasks = async () => {
    //   try {
    //     const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
    //     const command = new ScanCommand({ TableName: 'TaskFlow-Tasks' });
    //     const response = await dynamoClient.send(command);
    //     setTasks(response.Items || []);
    //   } catch (error) {
    //     console.error('Error fetching tasks:', error);
    //     showError('Failed to load tasks');
    //   }
    // };
    // fetchTasks();
  }, []); // Removed dependencies to prevent re-execution

  // Filter and search tasks (memoized to prevent unnecessary re-calculations)
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           task.assigneeName.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesStatus && matchesPriority && matchesSearch;
    });
  }, [tasks, filterStatus, filterPriority, searchTerm]);

  // Create or update task
  const handleSaveTask = async () => {
    try {
      if (!formData.title.trim()) {
        showError('Task title is required');
        return;
      }

      const now = new Date().toISOString();
      const taskData: Task = {
        id: editingTask?.id || Date.now().toString(),
        ...formData,
        assigneeName: teamMembers.find(m => m.id === formData.assigneeId)?.name || 'Unassigned',
        createdDate: editingTask?.createdDate || now,
        updatedDate: now,
        attachments: editingTask?.attachments || [],
        actualHours: editingTask?.actualHours || 0,
      };

      if (editingTask) {
        // TODO: Replace with DynamoDB UpdateItem
        // const updateCommand = new UpdateItemCommand({ ... });
        setTasks(prev => prev.map(task => task.id === editingTask.id ? taskData : task));
        showSuccess('Task updated successfully');
      } else {
        // TODO: Replace with DynamoDB PutItem
        // const putCommand = new PutItemCommand({ ... });
        setTasks(prev => [...prev, taskData]);
        showSuccess('Task created successfully');
      }

      handleCloseDialog();
    } catch (error) {
      console.error('Error saving task:', error);
      showError('Failed to save task');
    }
  };

  // Delete task
  const handleDeleteTask = async (task: Task) => {
    try {
      // TODO: Replace with DynamoDB DeleteItem
      // const deleteCommand = new DeleteItemCommand({ ... });
      setTasks(prev => prev.filter(t => t.id !== task.id));
      showSuccess('Task deleted successfully');
      setDeleteConfirmOpen(false);
      setTaskToDelete(null);
    } catch (error) {
      console.error('Error deleting task:', error);
      showError('Failed to delete task');
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

      const attachment: Attachment = {
        id: Date.now().toString(),
        name: file.name,
        url: `https://taskflow-attachments.s3.amazonaws.com/tasks/${taskId}/${file.name}`,
        size: file.size,
        type: file.type,
        uploadedBy: user?.name || 'Unknown',
        uploadedDate: new Date().toISOString(),
      };

      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, attachments: [...task.attachments, attachment] }
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
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, status: newStatus, updatedDate: new Date().toISOString() }
          : task
      ));
      showSuccess(`Task status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating task status:', error);
      showError('Failed to update task status');
    }
  };

  // Dialog handlers
  const handleOpenDialog = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title,
        description: task.description,
        assigneeId: task.assigneeId,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
        tags: task.tags,
        estimatedHours: task.estimatedHours || 0,
        department: task.department,
        category: task.category,
      });
    } else {
      setEditingTask(null);
      setFormData({
        title: '',
        description: '',
        assigneeId: '',
        priority: 'medium',
        status: 'todo',
        dueDate: '',
        tags: [],
        estimatedHours: 0,
        department: '',
        category: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTask(null);
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

  // Priority color mapping
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  // Status color mapping
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in-progress': return 'primary';
      case 'review': return 'warning';
      case 'todo': return 'default';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
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
                    {tasks.filter(t => t.priority === 'critical' || t.priority === 'high').length}
                  </Typography>
                  <Typography color="textSecondary">High Priority</Typography>
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
                <MenuItem value="todo">To Do</MenuItem>
                <MenuItem value="in-progress">In Progress</MenuItem>
                <MenuItem value="review">Review</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Priority</InputLabel>
              <Select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                label="Priority"
              >
                <MenuItem value="all">All Priority</MenuItem>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
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
              <TableCell>Priority</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Progress</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTasks.map((task) => (
              <TableRow key={task.id} hover>
                <TableCell>
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {task.title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" noWrap>
                      {task.description}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      {task.tags.map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ width: 32, height: 32, mr: 1 }}>
                      {task.assigneeName.charAt(0)}
                    </Avatar>
                    <Typography variant="body2">
                      {task.assigneeName}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={task.priority.toUpperCase()}
                    color={getPriorityColor(task.priority) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={task.status.replace('-', ' ').toUpperCase()}
                    color={getStatusColor(task.status) as any}
                    size="small"
                    onClick={() => {
                      const statuses: Task['status'][] = ['todo', 'in-progress', 'review', 'completed'];
                      const currentIndex = statuses.indexOf(task.status);
                      const nextStatus = statuses[(currentIndex + 1) % statuses.length];
                      handleStatusChange(task.id, nextStatus);
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
                  <Box sx={{ width: 100 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption">
                        {task.actualHours || 0}h / {task.estimatedHours || 0}h
                      </Typography>
                      <Typography variant="caption">
                        {task.estimatedHours ? Math.round(((task.actualHours || 0) / task.estimatedHours) * 100) : 0}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={task.estimatedHours ? ((task.actualHours || 0) / task.estimatedHours) * 100 : 0}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
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
                  handleFileUpload(file, selectedTask.id);
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
                <InputLabel>Assignee</InputLabel>
                <Select
                  value={formData.assigneeId}
                  onChange={(e) => setFormData(prev => ({ ...prev, assigneeId: e.target.value }))}
                  label="Assignee"
                >
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
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                  label="Priority"
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
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
                  <MenuItem value="todo">To Do</MenuItem>
                  <MenuItem value="in-progress">In Progress</MenuItem>
                  <MenuItem value="review">Review</MenuItem>
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
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Department"
                value={formData.department}
                onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Estimated Hours"
                type="number"
                value={formData.estimatedHours}
                onChange={(e) => setFormData(prev => ({ ...prev, estimatedHours: Number(e.target.value) }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Tags (comma separated)"
                value={formData.tags.join(', ')}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                }))}
                placeholder="frontend, urgent, bug"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveTask} variant="contained">
            {editingTask ? 'Update' : 'Create'} Task
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
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => taskToDelete && handleDeleteTask(taskToDelete)} 
            color="error"
            variant="contained"
          >
            Delete
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
    </Box>
  );
};

export default Tasks;
