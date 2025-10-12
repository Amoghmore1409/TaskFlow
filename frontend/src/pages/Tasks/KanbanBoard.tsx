import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Button,
  Chip,
  Avatar,
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
  Tooltip,
  Badge,
  LinearProgress,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Flag as FlagIcon,
  CalendarToday as CalendarIcon,
  Assignment as AssignmentIcon,
  CloudUpload as CloudUploadIcon,
  Visibility as ViewIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CompleteIcon,
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { useNotification } from '../../context';

// AWS SDK imports for production use
// TODO: Uncomment these imports when deploying to production with AWS
// import { DynamoDBClient, ScanCommand, UpdateItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
// import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
// import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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
  estimatedHours?: number;
  actualHours?: number;
  department: string;
  category: string;
  attachments: number;
}

interface TaskFormData {
  title: string;
  description: string;
  assigneeId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate: string;
  tags: string[];
  estimatedHours: number;
  department: string;
  category: string;
}

interface Column {
  id: string;
  title: string;
  status: Task['status'];
  color: string;
  icon: React.ReactNode;
  maxItems?: number;
}

// Mock data - Replace with AWS DynamoDB queries in production
const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Implement AWS Cognito Authentication',
    description: 'Set up user authentication and authorization using AWS Cognito',
    assigneeId: '1',
    assigneeName: 'John Doe',
    priority: 'high',
    status: 'in-progress',
    dueDate: '2025-10-15',
    createdDate: '2025-10-01',
    updatedDate: '2025-10-11',
    tags: ['backend', 'security', 'aws'],
    estimatedHours: 16,
    actualHours: 8,
    department: 'Engineering',
    category: 'Development',
    attachments: 2,
  },
  {
    id: '2',
    title: 'Design System Setup',
    description: 'Create reusable components with Material-UI design system',
    assigneeId: '2',
    assigneeName: 'Jane Smith',
    priority: 'medium',
    status: 'review',
    dueDate: '2025-10-12',
    createdDate: '2025-10-05',
    updatedDate: '2025-10-10',
    tags: ['frontend', 'ui', 'design'],
    estimatedHours: 12,
    actualHours: 10,
    department: 'Design',
    category: 'UI/UX',
    attachments: 1,
  },
  {
    id: '3',
    title: 'AWS Lambda Functions',
    description: 'Implement serverless functions for task management APIs',
    assigneeId: '1',
    assigneeName: 'John Doe',
    priority: 'critical',
    status: 'todo',
    dueDate: '2025-10-20',
    createdDate: '2025-10-08',
    updatedDate: '2025-10-08',
    tags: ['backend', 'aws', 'serverless'],
    estimatedHours: 24,
    department: 'Engineering',
    category: 'Development',
    attachments: 0,
  },
  {
    id: '4',
    title: 'Code Review Process',
    description: 'Review and approve pull requests for the authentication module',
    assigneeId: '3',
    assigneeName: 'Mike Johnson',
    priority: 'medium',
    status: 'completed',
    dueDate: '2025-10-10',
    createdDate: '2025-10-02',
    updatedDate: '2025-10-09',
    tags: ['review', 'qa'],
    estimatedHours: 4,
    actualHours: 3,
    department: 'Engineering',
    category: 'QA',
    attachments: 0,
  },
  {
    id: '5',
    title: 'DynamoDB Schema Design',
    description: 'Design and implement database schema for task management',
    assigneeId: '4',
    assigneeName: 'Sarah Wilson',
    priority: 'high',
    status: 'in-progress',
    dueDate: '2025-10-18',
    createdDate: '2025-10-06',
    updatedDate: '2025-10-11',
    tags: ['database', 'aws', 'schema'],
    estimatedHours: 20,
    actualHours: 12,
    department: 'Engineering',
    category: 'Database',
    attachments: 3,
  },
];

const teamMembers = [
  { id: '1', name: 'John Doe', avatar: '', department: 'Engineering' },
  { id: '2', name: 'Jane Smith', avatar: '', department: 'Design' },
  { id: '3', name: 'Mike Johnson', avatar: '', department: 'Engineering' },
  { id: '4', name: 'Sarah Wilson', avatar: '', department: 'Engineering' },
];

const KanbanBoard: React.FC = () => {
  const { showNotification } = useNotification();

  // Helper notification functions
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
  const [dragDisabled, setDragDisabled] = useState(false);

  // Form state
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    assigneeId: '',
    priority: 'medium',
    dueDate: '',
    tags: [],
    estimatedHours: 0,
    department: '',
    category: '',
  });

  // Define Kanban columns
  const columns: Column[] = [
    {
      id: 'todo',
      title: 'To Do',
      status: 'todo',
      color: '#f5f5f5',
      icon: <AssignmentIcon />,
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      status: 'in-progress',
      color: '#e3f2fd',
      icon: <ScheduleIcon />,
      maxItems: 3, // WIP limit
    },
    {
      id: 'review',
      title: 'Review',
      status: 'review',
      color: '#fff3e0',
      icon: <ViewIcon />,
    },
    {
      id: 'completed',
      title: 'Completed',
      status: 'completed',
      color: '#e8f5e8',
      icon: <CompleteIcon />,
    },
  ];

  // Load tasks on component mount
  useEffect(() => {
    // TODO: Replace with actual DynamoDB query in production
    // const fetchTasks = async () => {
    //   try {
    //     const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
    //     const command = new ScanCommand({ 
    //       TableName: 'TaskFlow-Tasks',
    //       FilterExpression: 'attribute_exists(#status)',
    //       ExpressionAttributeNames: { '#status': 'status' }
    //     });
    //     const response = await dynamoClient.send(command);
    //     setTasks(response.Items?.map(item => ({
    //       // Map DynamoDB item to Task interface
    //       id: item.id.S,
    //       title: item.title.S,
    //       // ... other mappings
    //     })) || []);
    //   } catch (error) {
    //     console.error('Error fetching tasks:', error);
    //     showError('Failed to load tasks');
    //   }
    // };
    // fetchTasks();

    // For demo purposes, use mock data
    setTasks(mockTasks);
  }, []);

  // Get tasks for a specific column
  const getTasksForColumn = (status: Task['status']) => {
    return tasks.filter(task => task.status === status);
  };

  // Handle drag end
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // If dropped outside droppable area
    if (!destination) return;

    // If dropped in the same position
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const newStatus = destination.droppableId as Task['status'];
    const taskId = draggableId;

    // Check WIP limits
    const targetColumn = columns.find(col => col.id === destination.droppableId);
    if (targetColumn?.maxItems) {
      const currentTasksInColumn = getTasksForColumn(newStatus).length;
      if (currentTasksInColumn >= targetColumn.maxItems && source.droppableId !== destination.droppableId) {
        showError(`Maximum ${targetColumn.maxItems} tasks allowed in ${targetColumn.title}`);
        return;
      }
    }

    try {
      setDragDisabled(true);

      // Update task status locally
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId 
            ? { ...task, status: newStatus, updatedDate: new Date().toISOString() }
            : task
        )
      );

      // TODO: Update task in DynamoDB in production
      // const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
      // const updateCommand = new UpdateItemCommand({
      //   TableName: 'TaskFlow-Tasks',
      //   Key: { id: { S: taskId } },
      //   UpdateExpression: 'SET #status = :status, updatedDate = :updatedDate',
      //   ExpressionAttributeNames: { '#status': 'status' },
      //   ExpressionAttributeValues: {
      //     ':status': { S: newStatus },
      //     ':updatedDate': { S: new Date().toISOString() }
      //   }
      // });
      // await dynamoClient.send(updateCommand);

      // TODO: Send notification via SNS in production
      // const snsClient = new SNSClient({ region: 'us-east-1' });
      // const publishCommand = new PublishCommand({
      //   TopicArn: 'arn:aws:sns:us-east-1:ACCOUNT:task-updates',
      //   Message: JSON.stringify({
      //     taskId,
      //     newStatus,
      //     updatedBy: user?.id,
      //     timestamp: new Date().toISOString()
      //   }),
      //   Subject: 'Task Status Updated'
      // });
      // await snsClient.send(publishCommand);

      showSuccess(`Task moved to ${targetColumn?.title}`);
    } catch (error) {
      console.error('Error updating task status:', error);
      showError('Failed to update task status');
      
      // Revert changes on error
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId 
            ? { ...task, status: source.droppableId as Task['status'] }
            : task
        )
      );
    } finally {
      setDragDisabled(false);
    }
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
        status: editingTask?.status || 'todo',
        createdDate: editingTask?.createdDate || now,
        updatedDate: now,
        actualHours: editingTask?.actualHours || 0,
        attachments: editingTask?.attachments || 0,
      };

      if (editingTask) {
        // TODO: Update in DynamoDB in production
        // const updateCommand = new UpdateItemCommand({ ... });
        setTasks(prev => prev.map(task => task.id === editingTask.id ? taskData : task));
        showSuccess('Task updated successfully');
      } else {
        // TODO: Create in DynamoDB in production
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
      // TODO: Delete from DynamoDB in production
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

  // Dialog handlers
  const handleOpenDialog = (task?: Task, defaultStatus?: Task['status']) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title,
        description: task.description,
        assigneeId: task.assigneeId,
        priority: task.priority,
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

  // File upload handler
  const handleFileUpload = async (file: File, taskId: string) => {
    try {
      // TODO: Upload to S3 in production
      // const s3Client = new S3Client({ region: 'us-east-1' });
      // const uploadCommand = new PutObjectCommand({
      //   Bucket: 'taskflow-attachments',
      //   Key: `tasks/${taskId}/${file.name}`,
      //   Body: file,
      //   ContentType: file.type,
      // });
      // await s3Client.send(uploadCommand);

      // Update attachment count
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, attachments: task.attachments + 1 }
          : task
      ));

      showSuccess('File uploaded successfully');
    } catch (error) {
      console.error('Error uploading file:', error);
      showError('Failed to upload file');
    }
  };

  return (
    <Box sx={{ p: 3, height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Kanban Board
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ borderRadius: 2 }}
        >
          Add Task
        </Button>
      </Box>

      {/* Statistics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {columns.map((column) => {
          const columnTasks = getTasksForColumn(column.status);
          return (
            <Grid item xs={12} sm={6} md={3} key={column.id}>
              <Card sx={{ backgroundColor: column.color, border: '1px solid #e0e0e0' }}>
                <CardContent sx={{ py: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {column.icon}
                      <Typography variant="h6" sx={{ ml: 1 }}>
                        {column.title}
                      </Typography>
                    </Box>
                    <Badge badgeContent={columnTasks.length} color="primary">
                      <Box />
                    </Badge>
                  </Box>
                  {column.maxItems && (
                    <Typography variant="caption" color="textSecondary">
                      WIP Limit: {columnTasks.length}/{column.maxItems}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Grid container spacing={2} sx={{ height: 'calc(100vh - 300px)', overflow: 'hidden' }}>
          {columns.map((column) => {
            const columnTasks = getTasksForColumn(column.status);
            return (
              <Grid item xs={12} sm={6} md={3} key={column.id}>
                <Paper 
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    backgroundColor: column.color,
                    border: '2px solid #e0e0e0',
                  }}
                >
                  {/* Column Header */}
                  <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {column.icon}
                        <Typography variant="h6" sx={{ ml: 1 }}>
                          {column.title}
                        </Typography>
                      </Box>
                      <Badge badgeContent={columnTasks.length} color="primary" />
                    </Box>
                    {column.maxItems && (
                      <LinearProgress 
                        variant="determinate" 
                        value={(columnTasks.length / column.maxItems) * 100}
                        sx={{ mt: 1 }}
                        color={columnTasks.length >= column.maxItems ? 'error' : 'primary'}
                      />
                    )}
                  </Box>

                  {/* Droppable Area */}
                  <Droppable droppableId={column.id} isDropDisabled={dragDisabled}>
                    {(provided, snapshot) => (
                      <Box
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        sx={{
                          flexGrow: 1,
                          p: 1,
                          minHeight: 200,
                          backgroundColor: snapshot.isDraggingOver ? '#f0f0f0' : 'transparent',
                          overflowY: 'auto',
                        }}
                      >
                        {columnTasks.map((task, index) => (
                          <Draggable 
                            key={task.id} 
                            draggableId={task.id} 
                            index={index}
                            isDragDisabled={dragDisabled}
                          >
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                sx={{
                                  mb: 1,
                                  cursor: 'pointer',
                                  transform: snapshot.isDragging ? 'rotate(5deg)' : 'none',
                                  boxShadow: snapshot.isDragging ? 4 : 1,
                                  backgroundColor: snapshot.isDragging ? '#fff' : 'white',
                                  border: '1px solid #e0e0e0',
                                  '&:hover': {
                                    boxShadow: 2,
                                  },
                                }}
                              >
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                  {/* Task Header */}
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                    <Typography variant="subtitle2" fontWeight="bold" noWrap>
                                      {task.title}
                                    </Typography>
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMenuOpen(e, task);
                                      }}
                                    >
                                      <MoreVertIcon fontSize="small" />
                                    </IconButton>
                                  </Box>

                                  {/* Task Description */}
                                  <Typography 
                                    variant="body2" 
                                    color="textSecondary" 
                                    sx={{ 
                                      mb: 2,
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {task.description}
                                  </Typography>

                                  {/* Tags */}
                                  <Stack direction="row" spacing={0.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
                                    {task.tags.slice(0, 2).map((tag) => (
                                      <Chip
                                        key={tag}
                                        label={tag}
                                        size="small"
                                        sx={{ fontSize: '0.7rem', height: 20 }}
                                      />
                                    ))}
                                    {task.tags.length > 2 && (
                                      <Chip
                                        label={`+${task.tags.length - 2}`}
                                        size="small"
                                        variant="outlined"
                                        sx={{ fontSize: '0.7rem', height: 20 }}
                                      />
                                    )}
                                  </Stack>

                                  {/* Task Footer */}
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Chip
                                        label={task.priority.toUpperCase()}
                                        color={getPriorityColor(task.priority) as any}
                                        size="small"
                                        icon={<FlagIcon />}
                                      />
                                      {task.attachments > 0 && (
                                        <Chip
                                          label={task.attachments}
                                          size="small"
                                          icon={<CloudUploadIcon />}
                                          variant="outlined"
                                        />
                                      )}
                                    </Box>
                                    <Tooltip title={task.assigneeName}>
                                      <Avatar sx={{ width: 24, height: 24 }}>
                                        {task.assigneeName.charAt(0)}
                                      </Avatar>
                                    </Tooltip>
                                  </Box>

                                  {/* Due Date */}
                                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                                    <CalendarIcon sx={{ fontSize: 14, color: 'text.secondary', mr: 0.5 }} />
                                    <Typography variant="caption" color="textSecondary">
                                      {new Date(task.dueDate).toLocaleDateString()}
                                    </Typography>
                                  </Box>

                                  {/* Progress Bar */}
                                  {task.estimatedHours && (
                                    <Box sx={{ mt: 1 }}>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant="caption">
                                          Progress
                                        </Typography>
                                        <Typography variant="caption">
                                          {task.actualHours || 0}h / {task.estimatedHours}h
                                        </Typography>
                                      </Box>
                                      <LinearProgress
                                        variant="determinate"
                                        value={((task.actualHours || 0) / task.estimatedHours) * 100}
                                        sx={{ height: 4, borderRadius: 2 }}
                                      />
                                    </Box>
                                  )}
                                </CardContent>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}

                        {/* Add Task Button for Column */}
                        <Button
                          fullWidth
                          variant="outlined"
                          startIcon={<AddIcon />}
                          onClick={() => handleOpenDialog(undefined, column.status)}
                          sx={{ 
                            mt: 1, 
                            borderStyle: 'dashed',
                            color: 'text.secondary',
                            borderColor: 'text.secondary',
                          }}
                        >
                          Add Task
                        </Button>
                      </Box>
                    )}
                  </Droppable>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </DragDropContext>

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
          <ListItemText>Upload File</ListItemText>
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
                label="Estimated Hours"
                type="number"
                value={formData.estimatedHours}
                onChange={(e) => setFormData(prev => ({ ...prev, estimatedHours: Number(e.target.value) }))}
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
            <Grid item xs={12}>
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

      {/* WIP Limit Warning */}
      {columns.some(col => {
        const count = getTasksForColumn(col.status).length;
        return col.maxItems && count >= col.maxItems;
      }) && (
        <Alert 
          severity="warning" 
          sx={{ 
            position: 'fixed', 
            bottom: 16, 
            right: 16, 
            minWidth: 300,
            zIndex: 1000,
          }}
        >
          WIP limit reached in one or more columns!
        </Alert>
      )}
    </Box>
  );
};

export default KanbanBoard;
