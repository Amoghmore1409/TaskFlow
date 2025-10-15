// User interface definition (matching display needs)
export interface User {
  user_ID: string;
  createdAt: string;
  email: string;
  Employee_Skills: string[];
  isActive: boolean;
  name: string;
  role: string;
  teamId: string;
  updatedAt: string;
  Years_of_Experience: number;
}

export class UserService {
  // Get all users (mock data only)
  static async getAllUsers(): Promise<User[]> {
    console.log('🔄 UserService.getAllUsers called - using mock data');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return this.getMockUsers();
  }

  // Get a specific user by ID (mock data only)
  static async getUserById(userId: string): Promise<User> {
    console.log('� UserService.getUserById called with ID:', userId);
    
    const users = this.getMockUsers();
    const user = users.find(u => u.user_ID === userId);
    
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    return user;
  }

  // Create a new user (mock functionality)
  static async createUser(userData: Partial<User>): Promise<User> {
    console.log('🔄 UserService.createUser called with data:', userData);
    
    const newUser: User = {
      user_ID: 'user-' + Date.now(),
      name: userData.name || 'New User',
      email: userData.email || 'new@taskflow.com',
      role: userData.role || 'Employee',
      Employee_Skills: userData.Employee_Skills || [],
      Years_of_Experience: userData.Years_of_Experience || 0,
      teamId: userData.teamId || 'team-general',
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    console.log('🎭 Mock user created:', newUser);
    return newUser;
  }

  // Update an existing user (mock functionality)
  static async updateUser(userId: string, userData: Partial<User>): Promise<User> {
    console.log('🔄 UserService.updateUser called with ID:', userId, 'data:', userData);
    
    const existingUser = await this.getUserById(userId);
    const updatedUser: User = {
      ...existingUser,
      ...userData,
      user_ID: userId, // Ensure ID doesn't change
      updatedAt: new Date().toISOString(),
    };
    
    console.log('🎭 Mock user updated:', updatedUser);
    return updatedUser;
  }

  // Delete a user (mock functionality)
  static async deleteUser(userId: string): Promise<void> {
    console.log('🔄 UserService.deleteUser called with ID:', userId);
    console.log('🎭 Mock user deletion completed');
    // In a real implementation, this would remove from the data store
  }

  // Get mock users for display
  private static getMockUsers(): User[] {
    return [
      {
        user_ID: 'user-001',
        name: 'John Smith',
        email: 'john.smith@taskflow.com',
        role: 'Senior Software Engineer',
        Employee_Skills: ['React', 'TypeScript', 'AWS', 'Python'],
        Years_of_Experience: 5,
        teamId: 'team-engineering',
        isActive: true,
        createdAt: '2020-01-15T00:00:00.000Z',
        updatedAt: '2025-10-15T00:00:00.000Z',
      },
      {
        user_ID: 'user-002',
        name: 'Sarah Wilson',
        email: 'sarah.wilson@taskflow.com',
        role: 'Engineering Manager',
        Employee_Skills: ['Leadership', 'React', 'AWS', 'Team Management'],
        Years_of_Experience: 8,
        teamId: 'team-engineering',
        isActive: true,
        createdAt: '2018-03-20T00:00:00.000Z',
        updatedAt: '2025-10-15T00:00:00.000Z',
      },
      {
        user_ID: 'user-003',
        name: 'Mike Johnson',
        email: 'mike.johnson@taskflow.com',
        role: 'Marketing Specialist',
        Employee_Skills: ['Digital Marketing', 'Content Creation', 'Analytics', 'SEO'],
        Years_of_Experience: 3,
        teamId: 'team-marketing',
        isActive: true,
        createdAt: '2022-06-10T00:00:00.000Z',
        updatedAt: '2025-10-15T00:00:00.000Z',
      },
      {
        user_ID: 'user-004',
        name: 'Emily Davis',
        email: 'emily.davis@taskflow.com',
        role: 'Marketing Manager',
        Employee_Skills: ['Strategy', 'Brand Management', 'Team Leadership', 'Analytics'],
        Years_of_Experience: 6,
        teamId: 'team-marketing',
        isActive: true,
        createdAt: '2019-09-01T00:00:00.000Z',
        updatedAt: '2025-10-15T00:00:00.000Z',
      },
      {
        user_ID: 'user-005',
        name: 'David Brown',
        email: 'david.brown@taskflow.com',
        role: 'Financial Analyst',
        Employee_Skills: ['Financial Analysis', 'Excel', 'SQL', 'Data Modeling'],
        Years_of_Experience: 4,
        teamId: 'team-finance',
        isActive: false,
        createdAt: '2021-02-14T00:00:00.000Z',
        updatedAt: '2025-10-15T00:00:00.000Z',
      },
      {
        user_ID: 'user-006',
        name: 'Lisa Chen',
        email: 'lisa.chen@taskflow.com',
        role: 'Finance Director',
        Employee_Skills: ['Financial Planning', 'Leadership', 'Strategic Analysis', 'Budget Management'],
        Years_of_Experience: 10,
        teamId: 'team-finance',
        isActive: true,
        createdAt: '2016-11-30T00:00:00.000Z',
        updatedAt: '2025-10-15T00:00:00.000Z',
      },
      {
        user_ID: 'user-007',
        name: 'Alex Rodriguez',
        email: 'alex.rodriguez@taskflow.com',
        role: 'UX Designer',
        Employee_Skills: ['Figma', 'User Research', 'Prototyping', 'UI/UX Design'],
        Years_of_Experience: 4,
        teamId: 'team-design',
        isActive: true,
        createdAt: '2021-08-12T00:00:00.000Z',
        updatedAt: '2025-10-15T00:00:00.000Z',
      },
      {
        user_ID: 'user-008',
        name: 'Maria Garcia',
        email: 'maria.garcia@taskflow.com',
        role: 'HR Business Partner',
        Employee_Skills: ['Talent Acquisition', 'Employee Relations', 'Performance Management', 'Compliance'],
        Years_of_Experience: 7,
        teamId: 'team-hr',
        isActive: true,
        createdAt: '2019-04-22T00:00:00.000Z',
        updatedAt: '2025-10-15T00:00:00.000Z',
      },
      {
        user_ID: 'user-009',
        name: 'Robert Kim',
        email: 'robert.kim@taskflow.com',
        role: 'DevOps Engineer',
        Employee_Skills: ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Infrastructure'],
        Years_of_Experience: 6,
        teamId: 'team-engineering',
        isActive: true,
        createdAt: '2020-07-08T00:00:00.000Z',
        updatedAt: '2025-10-15T00:00:00.000Z',
      },
      {
        user_ID: 'user-010',
        name: 'Jennifer Lee',
        email: 'jennifer.lee@taskflow.com',
        role: 'Product Manager',
        Employee_Skills: ['Product Strategy', 'Roadmap Planning', 'Stakeholder Management', 'Agile'],
        Years_of_Experience: 8,
        teamId: 'team-product',
        isActive: true,
        createdAt: '2018-12-03T00:00:00.000Z',
        updatedAt: '2025-10-15T00:00:00.000Z',
      }
    ];
  }
}

export default UserService;