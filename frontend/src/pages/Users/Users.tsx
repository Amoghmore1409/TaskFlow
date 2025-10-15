import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Avatar,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Badge,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Fab,
  Divider,
} from '@mui/material';
import {
  Search,
  FilterList,
  Person,
  Email,
  Phone,
  Business,
  Work,
  Star,
  Edit,
  Delete,
  Add,
  Visibility,
  Clear,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import { UserService, User } from '../../services/userService';
import { useNotification } from '../../context/NotificationContext';
import LoadingSpinner from '../../components/Common/LoadingSpinner';

const Users: React.FC = () => {
  // State management
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const { showNotification } = useNotification();

  // Helper functions for notifications
  const showSuccess = useCallback((message: string) => showNotification(message, 'success'), [showNotification]);
  const showError = useCallback((message: string) => showNotification(message, 'error'), [showNotification]);

  // Load users function (extracted for reuse)
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading users...');
      
      // Set a timeout for the API call
      const timeoutPromise = new Promise<User[]>((_, reject) => 
        setTimeout(() => reject(new Error('Loading timeout')), 10000)
      );
      
      const apiPromise = UserService.getAllUsers();
      
      // Race between API call and timeout
      const usersData = await Promise.race([apiPromise, timeoutPromise]);
      
      console.log('✅ Users loaded:', usersData.length, 'users');
      console.log('📋 Users data:', usersData);
      
      setUsers(usersData);
      setFilteredUsers(usersData);
      
      // Show simple success message
      showSuccess(`Successfully loaded ${usersData.length} users`);
    } catch (error) {
      console.error('💥 Error loading users:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showError('Failed to load users: ' + errorMessage);
      
      // Set empty array but don't prevent the component from rendering
      setUsers([]);
      setFilteredUsers([]);
    } finally {
      setLoading(false);
    }
  }, [showError, showSuccess]);

  // Load users data on component mount
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Filter users based on search and filters
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.Employee_Skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Team filter
    if (teamFilter !== 'all') {
      filtered = filtered.filter(user => user.teamId === teamFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      const isActiveFilter = statusFilter === 'active';
      filtered = filtered.filter(user => user.isActive === isActiveFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, teamFilter, statusFilter]);

  // Get unique teams for filter
  const teams = useMemo(() => {
    return Array.from(new Set(users.map(user => user.teamId))).sort();
  }, [users]);

  // Status colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'error';
      case 'on-leave': return 'warning';
      default: return 'default';
    }
  };

  // Handle user actions
  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setEditMode(false);
    setDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditMode(true);
    setDialogOpen(true);
  };

  const handleDeleteUser = async (user: User) => {
    if (window.confirm(`Are you sure you want to delete ${user.name}?`)) {
      try {
        await UserService.deleteUser(user.user_ID);
        setUsers(prev => prev.filter(u => u.user_ID !== user.user_ID));
        showSuccess('User deleted successfully');
      } catch (error) {
        showError('Failed to delete user: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedUser(null);
    setEditMode(false);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setTeamFilter('all');
    setStatusFilter('all');
  };

  // Format years of experience
  const formatExperience = (years: number) => {
    return years === 1 ? '1 year' : `${years} years`;
  };

  // Format join date
  const formatJoinDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // User Card Component
  const UserCard: React.FC<{ user: User }> = ({ user }) => (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ width: 60, height: 60, mr: 2, bgcolor: 'primary.main' }}>
            {user.name.split(' ').map(n => n[0]).join('')}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
              {user.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ID: {user.user_ID}
            </Typography>
            <Badge 
              badgeContent={user.isActive ? 'ACTIVE' : 'INACTIVE'} 
              color={user.isActive ? 'success' : 'error'}
              sx={{ mt: 0.5 }}
            />
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Work sx={{ mr: 1, fontSize: 16 }} />
            {user.role}
          </Typography>
          <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Business sx={{ mr: 1, fontSize: 16 }} />
            {user.teamId.replace('team-', '').charAt(0).toUpperCase() + user.teamId.replace('team-', '').slice(1)}
          </Typography>
          <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Star sx={{ mr: 1, fontSize: 16 }} />
            {formatExperience(user.Years_of_Experience)} experience
          </Typography>
          <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
            <Email sx={{ mr: 1, fontSize: 16 }} />
            {user.email}
          </Typography>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
            Skills:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {user.Employee_Skills.slice(0, 3).map((skill, index) => (
              <Chip key={index} label={skill} size="small" variant="outlined" />
            ))}
            {user.Employee_Skills.length > 3 && (
              <Chip label={`+${user.Employee_Skills.length - 3} more`} size="small" variant="outlined" color="primary" />
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 'auto' }}>
          <Tooltip title="View Details">
            <IconButton onClick={() => handleViewUser(user)} color="primary">
              <Visibility />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit User">
            <IconButton onClick={() => handleEditUser(user)} color="warning">
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete User">
            <IconButton onClick={() => handleDeleteUser(user)} color="error">
              <Delete />
            </IconButton>
          </Tooltip>
        </Box>
      </CardContent>
    </Card>
  );

  // Table Row Component
  const UserTableRow: React.FC<{ user: User }> = ({ user }) => (
    <TableRow hover>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Avatar sx={{ width: 40, height: 40, mr: 2 }}>
            {user.name.split(' ').map(n => n[0]).join('')}
          </Avatar>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              {user.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user.user_ID}
            </Typography>
          </Box>
        </Box>
      </TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell>{user.teamId.replace('team-', '').charAt(0).toUpperCase() + user.teamId.replace('team-', '').slice(1)}</TableCell>
      <TableCell>{user.role}</TableCell>
      <TableCell>{formatExperience(user.Years_of_Experience)}</TableCell>
      <TableCell>
        <Badge 
          badgeContent={user.isActive ? 'ACTIVE' : 'INACTIVE'} 
          color={user.isActive ? 'success' : 'error'}
        />
      </TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View Details">
            <IconButton size="small" onClick={() => handleViewUser(user)} color="primary">
              <Visibility />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit User">
            <IconButton size="small" onClick={() => handleEditUser(user)} color="warning">
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete User">
            <IconButton size="small" onClick={() => handleDeleteUser(user)} color="error">
              <Delete />
            </IconButton>
          </Tooltip>
        </Box>
      </TableCell>
    </TableRow>
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Users Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage employee information, skills, and details
        </Typography>
      </Box>

      {/* Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Team</InputLabel>
                <Select
                  value={teamFilter}
                  label="Team"
                  onChange={(e) => setTeamFilter(e.target.value)}
                >
                  <MenuItem value="all">All Teams</MenuItem>
                  {teams.map(team => (
                    <MenuItem key={team} value={team}>
                      {team.replace('team-', '').charAt(0).toUpperCase() + team.replace('team-', '').slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={viewMode === 'table'}
                    onChange={(e) => setViewMode(e.target.checked ? 'table' : 'cards')}
                  />
                }
                label="Table View"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Clear />}
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results Count */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Showing {filteredUsers.length} of {users.length} users
          {(searchTerm || teamFilter !== 'all' || statusFilter !== 'all') && ' (filtered)'}
        </Typography>
      </Box>

      {/* Users Display */}
      {filteredUsers.length === 0 && !loading ? (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            {users.length === 0 ? (
              <>
                No users found. This could be because:
                <ul style={{ textAlign: 'left', margin: '8px 0' }}>
                  <li>The database is empty</li>
                  <li>The API is not responding</li>
                  <li>There's a network connectivity issue</li>
                </ul>
                Mock users should have been loaded automatically for demonstration.
              </>
            ) : (
              'No users found matching your search criteria.'
            )}
          </Alert>
          {users.length === 0 && (
            <Button 
              variant="contained" 
              onClick={loadUsers}
              startIcon={<Add />}
            >
              Retry Loading Users
            </Button>
          )}
        </Box>
      ) : loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : viewMode === 'cards' ? (
        <Grid container spacing={3}>
          {filteredUsers.map((user) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={user.user_ID}>
              <UserCard user={user} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Team</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Experience</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.map((user) => (
                <UserTableRow key={user.user_ID} user={user} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* User Details Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        {selectedUser && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar sx={{ width: 50, height: 50, mr: 2 }}>
                  {selectedUser.name.split(' ').map(n => n[0]).join('')}
                </Avatar>
                <Box>
                  <Typography variant="h6">{selectedUser.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedUser.user_ID} • {selectedUser.role}
                  </Typography>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Contact Information
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <Email sx={{ mr: 1, fontSize: 16, verticalAlign: 'text-bottom' }} />
                    {selectedUser.email}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <Business sx={{ mr: 1, fontSize: 16, verticalAlign: 'text-bottom' }} />
                    Team: {selectedUser.teamId}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Employment Details
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Role: {selectedUser.role}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Experience: {formatExperience(selectedUser.Years_of_Experience)}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Team: {selectedUser.teamId}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Status: <Badge badgeContent={selectedUser.isActive ? 'ACTIVE' : 'INACTIVE'} color={selectedUser.isActive ? 'success' : 'error'} />
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                    Skills & Expertise
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {selectedUser.Employee_Skills.map((skill, index) => (
                      <Chip key={index} label={skill} variant="outlined" />
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>Close</Button>
              <Button variant="contained" onClick={() => handleEditUser(selectedUser)}>
                Edit User
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Add User FAB */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => {
          // TODO: Implement add user functionality
          showSuccess('Add user functionality coming soon!');
        }}
      >
        <Add />
      </Fab>
    </Box>
  );
};

export default Users;