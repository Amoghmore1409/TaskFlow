import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
} from '@mui/material';
import {
  Assignment as TaskIcon,
  Event as LeaveIcon,
  Group as TeamIcon,
  TrendingUp as TrendingIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactElement;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center">
        <Box
          sx={{
            backgroundColor: color,
            borderRadius: 1,
            p: 1,
            mr: 2,
            color: 'white',
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="h4" component="div">
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  // Mock data - in real app, this would come from API
  const stats = [
    { title: 'Active Tasks', value: 12, icon: <TaskIcon />, color: '#1976d2' },
    { title: 'Pending Leaves', value: 3, icon: <LeaveIcon />, color: '#dc004e' },
    { title: 'Team Members', value: 8, icon: <TeamIcon />, color: '#2e7d32' },
    { title: 'Completed This Month', value: 25, icon: <TrendingIcon />, color: '#ed6c02' },
  ];

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Welcome back, {user?.name}!
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <StatCard {...stat} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Tasks
            </Typography>
            <Typography color="text.secondary">
              Your recent task activity will appear here.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Typography color="text.secondary">
              Quick action buttons will appear here.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
