// User Service for fetching user/employee data

const USERS_API = 'https://cfukuuuiw8.execute-api.us-east-1.amazonaws.com/dev/users';

export interface User {
  user_ID: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'member';
  Employee_Skills: string[];
  Years_of_Experience: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  department?: string;
  avatar?: string;
}

export class UserService {
  /**
   * Get all active users from the API
   */
  static async getAllUsers(): Promise<User[]> {
    try {
      console.log('Fetching users from API...');
      
      const response = await fetch(USERS_API, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }

      const users: User[] = await response.json();
      
      console.log(`Fetched ${users.length} users from API`);
      
      // Filter only active users
      return users.filter(user => user.isActive !== false);
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  /**
   * Get active users with experience (filter out users without experience data)
   */
  static async getActiveUsersWithExperience(): Promise<User[]> {
    try {
      const allUsers = await this.getAllUsers();
      
      // Filter users who have experience data (for ML predictions)
      const usersWithExperience = allUsers.filter(user => 
        user.Years_of_Experience !== undefined && 
        user.Years_of_Experience !== null &&
        user.Years_of_Experience >= 0
      );
      
      console.log(`${usersWithExperience.length} users have experience data`);
      
      return usersWithExperience;
    } catch (error) {
      console.error('Error getting users with experience:', error);
      throw error;
    }
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    try {
      const users = await this.getAllUsers();
      return users.find(user => user.email === email) || null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<User | null> {
    try {
      const users = await this.getAllUsers();
      return users.find(user => user.user_ID === userId) || null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }

  /**
   * Convert User to UserSkillProfile format for task assignment
   */
  static convertToSkillProfile(user: User): any {
    return {
      id: user.user_ID,
      userId: user.user_ID,
      email: user.email,
      name: user.name,
      yearsOfExperience: user.Years_of_Experience || 0,
      skills: user.Employee_Skills || [],
      department: user.department || 'General',
      avatar: user.avatar || '',
    };
  }

  /**
   * Get all users as skill profiles for task assignment
   */
  static async getUsersAsSkillProfiles(): Promise<any[]> {
    try {
      const users = await this.getActiveUsersWithExperience();
      return users.map(user => this.convertToSkillProfile(user));
    } catch (error) {
      console.error('Error converting users to skill profiles:', error);
      throw error;
    }
  }
}
