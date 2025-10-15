import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
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
  Tooltip,
  Avatar,
  Alert,
  CircularProgress,
  Divider,
  Button,
  Badge,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Email,
  Phone,
  Business,
  Work,
  Star,
  Edit,
  Delete,
  Clear,
  Search,
  People,
} from '@mui/icons-material';
import { useNotification } from '../../context';
import { UserService, User } from '../../services/userService';
import LoadingSpinner from '../../components/Common/LoadingSpinner';

const Tasks: React.FC = () => {
  // State management
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { showNotification } = useNotification();

  // Helper functions for notifications
  const showSuccess = useCallback((message: string) => showNotification(message, 'success'), [showNotification]);
  const showError = useCallback((message: string) => showNotification(message, 'error'), [showNotification]);

  // Load users data
  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        console.log('🔄 Loading users from database...');
        const usersData = await UserService.getAllUsers();
        console.log('✅ Users loaded from database:', usersData.length, 'users');
        setUsers(usersData);
        setFilteredUsers(usersData);
      } catch (error) {
        console.error('💥 Error loading users from database:', error);
        showError('Failed to load users: ' + (error instanceof Error ? error.message : 'Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [showError]);

  // Filter users based on search and filters
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Department filter
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(user => user.department === departmentFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.status === statusFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, departmentFilter, statusFilter]);

  // Get unique departments for filter
  const departments = useMemo(() => {
    return Array.from(new Set(users.map(user => user.department))).sort();
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
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedUser(null);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDepartmentFilter('all');
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
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', '&:hover': { boxShadow: 4 } }}>
      <CardContent sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ width: 60, height: 60, mr: 2, bgcolor: 'primary.main' }}>
            {user.avatar ? (
              <img src={user.avatar} alt={user.employeeName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              user.employeeName.split(' ').map(n => n[0]).join('')
            )}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
              {user.employeeName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ID: {user.employeeId}
            </Typography>
            <Badge 
              badgeContent={user.status.toUpperCase()} 
              color={getStatusColor(user.status) as any}
              sx={{ mt: 0.5 }}
            />
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Work sx={{ mr: 1, fontSize: 16 }} />
            {user.position}
          </Typography>
          <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Business sx={{ mr: 1, fontSize: 16 }} />
            {user.department}
          </Typography>
          <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Star sx={{ mr: 1, fontSize: 16 }} />
            {formatExperience(user.yearsOfExperience)} experience
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
            {user.skills.slice(0, 3).map((skill, index) => (
              <Chip key={index} label={skill} size="small" variant="outlined" />
            ))}
            {user.skills.length > 3 && (
              <Chip label={`+${user.skills.length - 3} more`} size="small" variant="outlined" color="primary" />
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 'auto' }}>
          <Tooltip title="View Details">
            <IconButton onClick={() => handleViewUser(user)} color="primary">
              <ViewIcon />
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
            {user.avatar ? (
              <img src={user.avatar} alt={user.employeeName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              user.employeeName.split(' ').map(n => n[0]).join('')
            )}
          </Avatar>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              {user.employeeName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user.employeeId}
            </Typography>
          </Box>
        </Box>
      </TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell>{user.department}</TableCell>
      <TableCell>{user.position}</TableCell>
      <TableCell>{formatExperience(user.yearsOfExperience)}</TableCell>
      <TableCell>
        <Badge 
          badgeContent={user.status.toUpperCase()} 
          color={getStatusColor(user.status) as any}
        />
      </TableCell>
      <TableCell>
        <Tooltip title="View Details">
          <IconButton size="small" onClick={() => handleViewUser(user)} color="primary">
            <ViewIcon />
          </IconButton>
        </Tooltip>
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
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
          <People sx={{ mr: 2, fontSize: 40, color: 'primary.main' }} />
          All Users Database
        </Typography>
        <Typography variant="body1" color="text.secondary">
          View all employees and their information from the database
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
            <CardContent>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {users.length}
              </Typography>
              <Typography variant="body1">
                Total Users
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
            <CardContent>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {users.filter(u => u.status === 'active').length}
              </Typography>
              <Typography variant="body1">
                Active Users
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'warning.main', color: 'white' }}>
            <CardContent>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {users.filter(u => u.status === 'on-leave').length}
              </Typography>
              <Typography variant="body1">
                On Leave
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'info.main', color: 'white' }}>
            <CardContent>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {departments.length}
              </Typography>
              <Typography variant="body1">
                Departments
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
                <InputLabel>Department</InputLabel>
                <Select
                  value={departmentFilter}
                  label="Department"
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                >
                  <MenuItem value="all">All Departments</MenuItem>
                  {departments.map(dept => (
                    <MenuItem key={dept} value={dept}>{dept}</MenuItem>
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
                  <MenuItem value="on-leave">On Leave</MenuItem>
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
          {(searchTerm || departmentFilter !== 'all' || statusFilter !== 'all') && ' (filtered)'}
        </Typography>
      </Box>

      {/* Users Display */}
      {filteredUsers.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {users.length === 0 ? 'No users found in the database.' : 'No users found matching your criteria.'}
        </Alert>
      ) : viewMode === 'cards' ? (
        <Grid container spacing={3}>
          {filteredUsers.map((user) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={user.userId}>
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
                <TableCell>Department</TableCell>
                <TableCell>Position</TableCell>
                <TableCell>Experience</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.map((user) => (
                <UserTableRow key={user.userId} user={user} />
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
                  {selectedUser.avatar ? (
                    <img 
                      src={selectedUser.avatar} 
                      alt={selectedUser.employeeName} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  ) : (
                    selectedUser.employeeName.split(' ').map(n => n[0]).join('')
                  )}
                </Avatar>
                <Box>
                  <Typography variant="h6">{selectedUser.employeeName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedUser.employeeId} • {selectedUser.position}
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
                  {selectedUser.phoneNumber && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <Phone sx={{ mr: 1, fontSize: 16, verticalAlign: 'text-bottom' }} />
                      {selectedUser.phoneNumber}
                    </Typography>
                  )}
                  {selectedUser.location && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <Business sx={{ mr: 1, fontSize: 16, verticalAlign: 'text-bottom' }} />
                      {selectedUser.location}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Employment Details
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Department: {selectedUser.department}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Experience: {formatExperience(selectedUser.yearsOfExperience)}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Join Date: {formatJoinDate(selectedUser.joinDate)}
                  </Typography>
                  {selectedUser.manager && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Manager: {selectedUser.manager}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Status: <Badge badgeContent={selectedUser.status.toUpperCase()} color={getStatusColor(selectedUser.status) as any} />
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Skills & Expertise
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {selectedUser.skills.map((skill, index) => (
                      <Chip key={index} label={skill} variant="outlined" />
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default Tasks;