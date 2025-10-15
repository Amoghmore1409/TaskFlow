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
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { useNotification } from '../../context';
import { TaskService } from '../../services/taskService';

// AWS SDK imports for production use
// TODO: Uncomment these imports when deploying to production with AWS
// import { DynamoDBClient, ScanCommand, UpdateItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
// import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
// import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

interface Task {
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
    taskId: 'kanban_1',
    title: 'Implement AWS Cognito Authentication',
    description: 'Set up user authentication and authorization using AWS Cognito',
    assignedBy: 'manager1',
    assignedTo: 'user1',
    status: 'in-progress',
    dueDate: '2025-10-15T00:00:00Z',
    createdAt: '2025-10-01T09:00:00Z',
    updatedAt: '2025-10-11T14:30:00Z',
    Task_Complexity: 4,
    Required_Skills: ['AWS', 'Cognito', 'Node.js', 'Security'],
    attachments: ['https://s3.amazonaws.com/taskflow-attachments/auth-spec.pdf', 'https://s3.amazonaws.com/taskflow-attachments/cognito-setup.md'],
  },
  {
    taskId: 'kanban_2',
    title: 'Design System Setup',
    description: 'Create reusable components with Material-UI design system',
    assignedBy: 'manager1',
    assignedTo: 'user2',
    status: 'completed',
    dueDate: '2025-10-12T00:00:00Z',
    createdAt: '2025-10-05T10:00:00Z',
    updatedAt: '2025-10-10T16:45:00Z',
    Task_Complexity: 3,
    Required_Skills: ['React', 'Material-UI', 'TypeScript', 'Design Systems'],
    attachments: ['https://s3.amazonaws.com/taskflow-attachments/design-tokens.json'],
  },
  {
    taskId: 'kanban_3',
    title: 'AWS Lambda Functions',
    description: 'Implement serverless functions for task management APIs',
    assignedBy: 'manager1',
    assignedTo: 'user1',
    status: 'pending',
    dueDate: '2025-10-20T00:00:00Z',
    createdAt: '2025-10-08T11:00:00Z',
    updatedAt: '2025-10-08T11:00:00Z',
    Task_Complexity: 5,
    Required_Skills: ['AWS Lambda', 'Node.js', 'DynamoDB', 'API Gateway'],
    attachments: [],
  },
  {
    taskId: 'kanban_4',
    title: 'Code Review Process',
    description: 'Review and approve pull requests for the authentication module',
    assignedBy: 'manager1',
    assignedTo: 'user3',
    status: 'completed',
    dueDate: '2025-10-10T00:00:00Z',
    createdAt: '2025-10-02T14:00:00Z',
    updatedAt: '2025-10-09T17:30:00Z',
    Task_Complexity: 2,
    Required_Skills: ['Code Review', 'Git', 'QA'],
    attachments: [],
  },
  {
    taskId: 'kanban_5',
    title: 'DynamoDB Schema Design',
    description: 'Design and implement database schema for task management',
    assignedBy: 'manager1',
    assignedTo: 'user4',
    status: 'in-progress',
    dueDate: '2025-10-18T00:00:00Z',
    createdAt: '2025-10-06T12:00:00Z',
    updatedAt: '2025-10-11T15:20:00Z',
    Task_Complexity: 4,
    Required_Skills: ['DynamoDB', 'Database Design', 'AWS', 'NoSQL'],
    attachments: ['https://s3.amazonaws.com/taskflow-attachments/schema-v1.json', 'https://s3.amazonaws.com/taskflow-attachments/entity-diagram.png', 'https://s3.amazonaws.com/taskflow-attachments/access-patterns.md'],
  },
];

const teamMembers = [
  { id: 'user1', name: 'John Doe', avatar: '', department: 'Engineering' },
  { id: 'user2', name: 'Jane Smith', avatar: '', department: 'Design' },
  { id: 'user3', name: 'Mike Johnson', avatar: '', department: 'Engineering' },
  { id: 'user4', name: 'Sarah Wilson', avatar: '', department: 'Engineering' },
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
  
  // WIP Limits state with localStorage persistence
  const [wipLimits, setWipLimits] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('taskflow-wip-limits');
    return saved ? JSON.parse(saved) : {
      'pending': 0, // No limit for pending
      'in-progress': 5, // Default WIP limit for in-progress
      'completed': 0, // No limit for completed
    };
  });
  const [showWipSettings, setShowWipSettings] = useState(false);

  // Save WIP limits to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('taskflow-wip-limits', JSON.stringify(wipLimits));
  }, [wipLimits]);

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

  // Define Kanban columns with dynamic WIP limits
  const columns: Column[] = [
    {
      id: 'pending',
      title: 'Pending',
      status: 'pending',
      color: '#f5f5f5',
      icon: <AssignmentIcon />,
      maxItems: wipLimits['pending'] || undefined,
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      status: 'in-progress',
      color: '#e3f2fd',
      icon: <ScheduleIcon />,
      maxItems: wipLimits['in-progress'] || undefined,
    },
    {
      id: 'completed',
      title: 'Completed',
      status: 'completed',
      color: '#e8f5e8',
      icon: <CompleteIcon />,
      maxItems: wipLimits['completed'] || undefined,
    },
  ];

  // Load tasks on component mount
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const fetchedTasks = await TaskService.getAllTasks();
        setTasks(fetchedTasks);
        
        // If no tasks exist in the API, you can optionally load mock data
        if (fetchedTasks.length === 0) {
          console.log('No tasks found in API, using mock data for development');
          setTasks(mockTasks);
        }
      } catch (error) {
        console.error('Error fetching tasks:', error);
        showError('Failed to load tasks from server. Loading mock data for development.');
        // Fallback to mock data if API fails
        setTasks(mockTasks);
      }
    };
    
    fetchTasks();
  }, [showError]);

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
    if (targetColumn?.maxItems && targetColumn.maxItems > 0) {
      const currentTasksInColumn = getTasksForColumn(newStatus).length;
      if (currentTasksInColumn >= targetColumn.maxItems && source.droppableId !== destination.droppableId) {
        showError(`WIP limit exceeded! ${targetColumn.title} can only have ${targetColumn.maxItems} tasks. Currently has ${currentTasksInColumn}.`);
        return;
      }
    }

    try {
      setDragDisabled(true);

      // Optimistically update task status locally
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.taskId === taskId 
            ? { ...task, status: newStatus, updatedAt: new Date().toISOString() }
            : task
        )
      );

      // Update task status via API
      const updatedTask = await TaskService.updateTaskStatus(taskId, newStatus);
      
      // Sync with API response
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.taskId === taskId ? updatedTask : task
        )
      );

      showSuccess(`Task moved to ${targetColumn?.title}`);
    } catch (error) {
      console.error('Error updating task status:', error);
      
      // Revert optimistic update on error
      const originalTask = tasks.find(t => t.taskId === taskId);
      if (originalTask) {
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.taskId === taskId ? originalTask : task
          )
        );
      }
      
      showError(`Failed to update task status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Revert changes on error
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.taskId === taskId 
            ? { ...task, status: source.droppableId as Task['status'] }
            : task
        )
      );
    } finally {
      setDragDisabled(false);
    }
  };

  // Complexity color mapping
  const getComplexityColor = (complexity: number) => {
    if (complexity >= 4) return 'error'; // High complexity (4-5)
    if (complexity === 3) return 'warning'; // Medium complexity (3)
    if (complexity <= 2) return 'success'; // Low complexity (1-2)
    return 'default';
  };

  // Create or update task
  const handleSaveTask = async () => {
    try {
      if (!formData.title.trim()) {
        showError('Task title is required');
        return;
      }

      const taskRequestData = {
        title: formData.title,
        description: formData.description,
        assignedBy: 'user-manager-12345', // TODO: Get from auth context
        assignedTo: formData.assignedTo || undefined,
        status: formData.status,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : new Date().toISOString(),
        Task_Complexity: formData.Task_Complexity,
        Required_Skills: formData.Required_Skills,
        attachments: editingTask?.attachments || [],
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
        showSuccess('Task created successfully');
      }

      handleCloseDialog();
    } catch (error) {
      console.error('Error saving task:', error);
      showError(`Failed to ${editingTask ? 'update' : 'create'} task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Delete task
  const handleDeleteTask = async (task: Task) => {
    try {
      // TODO: Delete from DynamoDB in production
      // const deleteCommand = new DeleteItemCommand({ ... });
      setTasks(prev => prev.filter(t => t.taskId !== task.taskId));
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
        assignedTo: task.assignedTo || '',
        status: task.status,
        dueDate: task.dueDate.split('T')[0], // Extract date part
        Task_Complexity: task.Task_Complexity,
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
        task.taskId === taskId 
          ? { ...task, attachments: [...(task.attachments || []), `https://s3.amazonaws.com/taskflow-attachments/${taskId}/${file.name}`] }
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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setShowWipSettings(true)}
            sx={{ borderRadius: 2 }}
          >
            WIP Settings
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{ borderRadius: 2 }}
          >
            Add Task
          </Button>
        </Box>
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
                  {column.maxItems && column.maxItems > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="textSecondary">
                        WIP Limit: {columnTasks.length}/{column.maxItems}
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={(columnTasks.length / column.maxItems) * 100}
                        color={columnTasks.length >= column.maxItems ? "error" : "primary"}
                        sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
                      />
                    </Box>
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
            const isAtLimit = Boolean(column.maxItems && column.maxItems > 0 && columnTasks.length >= column.maxItems);
            const isNearLimit = Boolean(column.maxItems && column.maxItems > 0 && columnTasks.length >= column.maxItems * 0.8);
            
            return (
              <Grid item xs={12} sm={6} md={3} key={column.id}>
                <Paper 
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    backgroundColor: column.color,
                    border: isAtLimit ? '2px solid #f44336' : isNearLimit ? '2px solid #ff9800' : '2px solid #e0e0e0',
                    boxShadow: isAtLimit ? '0 0 10px rgba(244, 67, 54, 0.3)' : 'none',
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
                  <Droppable droppableId={column.id} isDropDisabled={Boolean(dragDisabled || isAtLimit)}>
                    {(provided, snapshot) => {
                      const canDrop = !isAtLimit || snapshot.isDraggingOver;
                      return (
                        <Box
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          sx={{
                            flexGrow: 1,
                            p: 1,
                            minHeight: 200,
                            backgroundColor: snapshot.isDraggingOver 
                              ? (isAtLimit ? '#ffebee' : '#f0f0f0') 
                              : 'transparent',
                            border: snapshot.isDraggingOver && isAtLimit ? '2px dashed #f44336' : 'none',
                            overflowY: 'auto',
                            position: 'relative',
                          }}
                        >
                          {isAtLimit && !canDrop && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 1,
                                pointerEvents: 'none',
                              }}
                            >
                              <Typography variant="caption" color="error" sx={{ fontWeight: 'bold' }}>
                                WIP Limit Reached
                              </Typography>
                            </Box>
                          )}
                        {columnTasks.map((task, index) => (
                          <Draggable
                            key={task.taskId}
                            draggableId={task.taskId}
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

                                  {/* Required Skills */}
                                  <Stack direction="row" spacing={0.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>  
                                    {(Array.isArray(task.Required_Skills) ? task.Required_Skills : []).slice(0, 2).map((skill) => (
                                      <Chip
                                        key={skill}
                                        label={skill}
                                        size="small"
                                        sx={{ fontSize: '0.7rem', height: 20 }}
                                      />
                                    ))}
                                    {Array.isArray(task.Required_Skills) && task.Required_Skills.length > 2 && (
                                      <Chip
                                        label={`+${task.Required_Skills.length - 2}`}
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
                                        label={`Level ${task.Task_Complexity}`}
                                        color={getComplexityColor(task.Task_Complexity) as any}
                                        size="small"
                                        icon={<FlagIcon />}
                                      />
                                      {task.attachments && task.attachments.length > 0 && (
                                        <Chip
                                          label={task.attachments.length}
                                          size="small"
                                          icon={<CloudUploadIcon />}
                                          variant="outlined"
                                        />
                                      )}
                                    </Box>
                                    <Tooltip title={task.assignedTo ? teamMembers.find(m => m.id === task.assignedTo)?.name || 'Unknown' : 'Unassigned'}>
                                      <Avatar sx={{ width: 24, height: 24 }}>
                                        {task.assignedTo ? (teamMembers.find(m => m.id === task.assignedTo)?.name?.charAt(0) || 'U') : '?'}
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

                                  {/* Task Info */}
                                  <Box sx={{ mt: 1 }}>
                                    <Typography variant="caption" color="textSecondary">
                                      Created: {new Date(task.createdAt).toLocaleDateString()}
                                    </Typography>
                                  </Box>
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
                        {provided.placeholder}
                      </Box>
                      );
                    }}
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
                  handleFileUpload(file, selectedTask.taskId);
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
                  value={formData.assignedTo}
                  onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
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
                <InputLabel>Task Complexity</InputLabel>
                <Select
                  value={formData.Task_Complexity}
                  onChange={(e) => setFormData(prev => ({ ...prev, Task_Complexity: e.target.value as any }))}
                  label="Task Complexity"
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



            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Required Skills (comma separated)"
                value={Array.isArray(formData.Required_Skills) ? formData.Required_Skills.join(', ') : ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  Required_Skills: e.target.value.split(',').map(skill => skill.trim()).filter(Boolean)
                }))}
                placeholder="React, TypeScript, AWS"
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

      {/* WIP Settings Dialog */}
      <Dialog open={showWipSettings} onClose={() => setShowWipSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          WIP Limit Settings
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Configure Work In Progress limits for each column. Set to 0 for no limit.
          </Typography>
          
          {/* Quick Stats */}
          <Box sx={{ mb: 3, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Current Status:</Typography>
            {columns.map((column) => {
              const count = getTasksForColumn(column.status).length;
              const limit = wipLimits[column.status];
              const isAtLimit = limit > 0 && count >= limit;
              const isNearLimit = limit > 0 && count >= limit * 0.8;
              
              return (
                <Typography 
                  key={column.id} 
                  variant="caption" 
                  display="block"
                  color={isAtLimit ? 'error' : isNearLimit ? 'warning.main' : 'text.secondary'}
                >
                  {column.title}: {count} tasks {limit > 0 ? `(limit: ${limit})` : '(no limit)'}
                  {isAtLimit && ' ⚠️ At limit!'}
                  {isNearLimit && !isAtLimit && ' ⚡ Near limit'}
                </Typography>
              );
            })}
          </Box>

          <Grid container spacing={3}>
            {columns.map((column) => (
              <Grid item xs={12} key={column.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 120 }}>
                    {column.icon}
                    <Typography variant="body1" sx={{ ml: 1 }}>
                      {column.title}
                    </Typography>
                  </Box>
                  <TextField
                    type="number"
                    label="WIP Limit"
                    value={wipLimits[column.status] || 0}
                    onChange={(e) => setWipLimits(prev => ({
                      ...prev,
                      [column.status]: Math.max(0, parseInt(e.target.value) || 0)
                    }))}
                    inputProps={{ min: 0, max: 50 }}
                    size="small"
                    sx={{ width: 120 }}
                    helperText={wipLimits[column.status] === 0 ? "No limit" : ""}
                  />
                  <Typography variant="caption" color="textSecondary">
                    Current: {getTasksForColumn(column.status).length}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setWipLimits({
                'pending': 0,
                'in-progress': 5,
                'completed': 0,
              });
            }}
            color="secondary"
          >
            Reset to Defaults
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={() => setShowWipSettings(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              setShowWipSettings(false);
              showSuccess('WIP limits updated successfully');
            }} 
            variant="contained"
          >
            Apply Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* WIP Limit Warning */}
      {columns.some(col => {
        const count = getTasksForColumn(col.status).length;
        return col.maxItems && col.maxItems > 0 && count >= col.maxItems;
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
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => setShowWipSettings(true)}
            >
              Adjust
            </Button>
          }
        >
          <Typography variant="body2">
            WIP limit reached! Consider adjusting limits or moving tasks to balance workflow.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default KanbanBoard;
