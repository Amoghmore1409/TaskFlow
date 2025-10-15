import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  CircularProgress,
  Button,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Assignment as TaskIcon,
  Event as LeaveIcon,
  Group as TeamIcon,
  TrendingUp as TrendingIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../context/NotificationContext';
import { UserService } from '../../services/userService';
import { getLeaveRequests } from '../../services/leaveApi';

// Interfaces
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactElement;
  color: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  loading?: boolean;
}

interface DashboardData {
  totalUsers: number;
  totalLeaves: number;
  pendingLeaves: number;
  approvedLeaves: number;
  rejectedLeaves: number;
  leavesByType: Array<{ name: string; value: number; color: string }>;
  leavesByDepartment: Array<{ department: string; count: number }>;
  usersByDepartment: Array<{ department: string; count: number }>;
  recentActivities: Array<{
    id: string;
    type: 'leave' | 'user' | 'task';
    title: string;
    subtitle: string;
    time: string;
    avatar?: string;
  }>;
}

// Chart color palettes
const LEAVE_TYPE_COLORS = {
  vacation: '#1976d2',
  sick: '#dc004e',
  personal: '#2e7d32',
  maternity: '#9c27b0',
  paternity: '#ff9800',
  emergency: '#f44336',
};

const CHART_COLORS = ['#1976d2', '#dc004e', '#2e7d32', '#9c27b0', '#ff9800', '#f44336', '#00bcd4', '#795548'];

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, trend, loading }) => (
  <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center">
          <Box
            sx={{
              backgroundColor: color,
              borderRadius: 2,
              p: 1.5,
              mr: 2,
              color: 'white',
              boxShadow: `0 4px 8px ${color}40`,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="h4" component="div" fontWeight="bold">
              {loading ? <CircularProgress size={24} /> : value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
          </Box>
        </Box>
        {trend && (
          <Box textAlign="right">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: trend.direction === 'up' ? 'success.main' : 'error.main',
              }}
            >
              <TrendingIcon 
                sx={{ 
                  fontSize: 16, 
                  mr: 0.5,
                  transform: trend.direction === 'down' ? 'rotate(180deg)' : 'none' 
                }} 
              />
              <Typography variant="caption" fontWeight="bold">
                {trend.value}%
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </CardContent>
  </Card>
);

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  
  // State management
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalUsers: 0,
    totalLeaves: 0,
    pendingLeaves: 0,
    approvedLeaves: 0,
    rejectedLeaves: 0,
    leavesByType: [],
    leavesByDepartment: [],
    usersByDepartment: [],
    recentActivities: [],
  });
  const [loading, setLoading] = useState(true);

  // Helper notification functions
  const showError = useCallback((message: string) => showNotification(message, 'error'), [showNotification]);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch users and leave requests in parallel
      const [usersResponse, leavesResponse] = await Promise.all([
        UserService.getAllUsers(),
        getLeaveRequests(),
      ]);

      console.log('Users data:', usersResponse);
      console.log('Leaves data:', leavesResponse);

      // Process users data
      const users = usersResponse || [];
      console.log('Processed users array:', users);
      console.log('Users length:', users.length);
      
      let usersByDept = users.reduce((acc: any, user: any) => {
        const dept = user.department || 'Unknown';
        acc[dept] = (acc[dept] || 0) + 1;
        return acc;
      }, {});

      // If no users or empty departments, add mock data for demonstration
      if (Object.keys(usersByDept).length === 0) {
        console.log('No user department data found, using fallback data');
        usersByDept = {
          'Engineering': 15,
          'Design': 8,
          'Marketing': 6,
          'HR': 4,
          'Sales': 7,
          'Operations': 5,
        };
      }

      console.log('Users by department:', usersByDept);

      // Process leaves data
      const leaves = leavesResponse || [];
      const pendingLeaves = leaves.filter((leave: any) => leave.status === 'pending').length;
      const approvedLeaves = leaves.filter((leave: any) => leave.status === 'approved').length;
      const rejectedLeaves = leaves.filter((leave: any) => leave.status === 'rejected').length;

      // Leave types distribution
      let leavesByType = leaves.reduce((acc: any, leave: any) => {
        const type = leave.leaveType || 'vacation';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      // If no leave data, add some sample data for demonstration
      if (Object.keys(leavesByType).length === 0) {
        console.log('No leave type data found, using fallback data');
        leavesByType = {
          'vacation': 12,
          'sick': 8,
          'personal': 5,
          'maternity': 2,
          'emergency': 3,
        };
      }

      console.log('Leaves by type:', leavesByType);

      // Leaves by department - use more realistic data
      const leavesByDept = {
        'Engineering': 12,
        'Design': 8,
        'Marketing': 6,
        'HR': 4,
        'Sales': 9,
        'Operations': 5,
      };

      // Generate recent activities
      const recentActivities = [
        {
          id: '1',
          type: 'leave' as const,
          title: 'New leave request submitted',
          subtitle: 'John Doe - Vacation Leave',
          time: '2 hours ago',
          avatar: 'JD',
        },
        {
          id: '2',
          type: 'user' as const,
          title: 'New team member added',
          subtitle: 'Sarah Wilson joined Engineering',
          time: '5 hours ago',
          avatar: 'SW',
        },
        {
          id: '3',
          type: 'leave' as const,
          title: 'Leave request approved',
          subtitle: 'Mike Johnson - Sick Leave',
          time: '1 day ago',
          avatar: 'MJ',
        },
        {
          id: '4',
          type: 'task' as const,
          title: 'Monthly report generated',
          subtitle: 'Q4 Performance Summary',
          time: '2 days ago',
          avatar: 'SYS',
        },
      ];

      const processedUsersByDept = Object.entries(usersByDept).map(([department, count]) => ({
        department,
        count: count as number,
      }));

      console.log('Processed users by department for chart:', processedUsersByDept);

      setDashboardData({
        totalUsers: users.length,
        totalLeaves: leaves.length,
        pendingLeaves,
        approvedLeaves,
        rejectedLeaves,
        leavesByType: Object.entries(leavesByType).map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value: value as number,
          color: LEAVE_TYPE_COLORS[name as keyof typeof LEAVE_TYPE_COLORS] || '#757575',
        })),
        leavesByDepartment: Object.entries(leavesByDept).map(([department, count]) => ({
          department,
          count: count as number,
        })),
        usersByDepartment: processedUsersByDept,
        recentActivities,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      showError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Calculate statistics for cards
  const stats = [
    {
      title: 'Total Users',
      value: dashboardData.totalUsers,
      icon: <TeamIcon />,
      color: '#1976d2',
      trend: { value: 8, direction: 'up' as const },
      loading,
    },
    {
      title: 'Total Leaves',
      value: dashboardData.totalLeaves,
      icon: <LeaveIcon />,
      color: '#dc004e',
      trend: { value: 12, direction: 'up' as const },
      loading,
    },
    {
      title: 'Pending Requests',
      value: dashboardData.pendingLeaves,
      icon: <TimeIcon />,
      color: '#ff9800',
      trend: { value: 3, direction: 'down' as const },
      loading,
    },
    {
      title: 'Approved This Month',
      value: dashboardData.approvedLeaves,
      icon: <CheckIcon />,
      color: '#2e7d32',
      trend: { value: 15, direction: 'up' as const },
      loading,
    },
  ];

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
            Welcome back, {user?.name}! 👋
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Here's what's happening with your team today.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => console.log('Quick action clicked')}
        >
          Quick Action
        </Button>
      </Box>
      
      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <StatCard {...stat} />
          </Grid>
        ))}
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Leave Types Distribution */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <LeaveIcon sx={{ mr: 1 }} />
                Leave Types Distribution
              </Typography>
              {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" height={300}>
                  <CircularProgress />
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={dashboardData.leavesByType}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {dashboardData.leavesByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Department Statistics */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <TeamIcon sx={{ mr: 1 }} />
                Users by Department
              </Typography>
              {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" height={300}>
                  <CircularProgress />
                </Box>
              ) : dashboardData.usersByDepartment.length === 0 ? (
                <Box display="flex" justifyContent="center" alignItems="center" height={300}>
                  <Typography color="text.secondary">No user data available</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData.usersByDepartment} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="department" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [value, 'Users']}
                      labelFormatter={(label) => `Department: ${label}`}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="#1976d2" 
                      radius={[4, 4, 0, 0]}
                      name="Users"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bottom Row */}
      <Grid container spacing={3}>
        {/* Leave Requests Trend */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingIcon sx={{ mr: 1 }} />
                Leave Requests by Department
              </Typography>
              {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" height={300}>
                  <CircularProgress />
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dashboardData.leavesByDepartment}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="department" />
                    <YAxis />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#1976d2"
                      fill="#1976d2"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activities */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <CalendarIcon sx={{ mr: 1 }} />
                Recent Activities
              </Typography>
              <List sx={{ maxHeight: 320, overflow: 'auto' }}>
                {dashboardData.recentActivities.map((activity, index) => (
                  <React.Fragment key={activity.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            bgcolor: activity.type === 'leave' ? '#dc004e' :
                                   activity.type === 'user' ? '#1976d2' : '#2e7d32',
                            width: 32,
                            height: 32,
                            fontSize: '0.75rem',
                          }}
                        >
                          {activity.avatar}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={activity.title}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {activity.subtitle}
                            </Typography>
                            <Typography variant="caption" color="text.disabled">
                              {activity.time}
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton edge="end" size="small">
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < dashboardData.recentActivities.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
