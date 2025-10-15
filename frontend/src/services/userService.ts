// User interface definition
export interface User {
  userId: string;
  employeeName: string;
  employeeId: string;
  email: string;
  department: string;
  position: string;
  skills: string[];
  yearsOfExperience: number;
  joinDate: string;
  manager?: string;
  phoneNumber?: string;
  location?: string;
  status: 'active' | 'inactive' | 'on-leave';
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

// API response types
interface UsersResponse {
  users: User[];
  count: number;
}

interface CreateUserRequest {
  employeeName: string;
  employeeId: string;
  email: string;
  department: string;
  position: string;
  skills: string[];
  yearsOfExperience: number;
  joinDate: string;
  manager?: string;
  phoneNumber?: string;
  location?: string;
  status: 'active' | 'inactive' | 'on-leave';
}

interface UpdateUserRequest extends Partial<CreateUserRequest> {
  userId: string;
}

// API Configuration
const USE_DEVELOPMENT_CORS_PROXY = true;
const API_BASE_URL_USER = 'https://owsbp59rqk.execute-api.us-east-1.amazonaws.com/dev/users';
const API_BASE_URL_ID = 'https://owsbp59rqk.execute-api.us-east-1.amazonaws.com/dev';

export class UserService {
  private static async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    useUserUrl = true
  ): Promise<T> {
    // Choose the correct base URL based on the operation
    const baseUrl = useUserUrl ? API_BASE_URL_USER : API_BASE_URL_ID;
    const directUrl = `${baseUrl}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    console.log(`🔄 Making User API request to: ${directUrl}`, { method: options.method || 'GET', headers: config.headers });

    try {
      const response = await fetch(directUrl, config);
      
      console.log(`📡 User API Response Status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorBody = await response.text();
        const errorMessage = `User API request failed: ${response.status} ${response.statusText}. ${errorBody}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
      }

      // Handle empty responses
      const text = await response.text();
      console.log('📋 Raw User API Response:', text);
      
      if (!text) {
        console.log('📝 Empty response, returning empty object');
        return {} as T;
      }

      try {
        const parsed = JSON.parse(text) as T;
        console.log('✅ Parsed User API Response:', parsed);
        return parsed;
      } catch (parseError) {
        console.warn('⚠️ Response is not valid JSON:', text);
        return text as unknown as T;
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(`🚨 Network error - check if User API is accessible: ${directUrl}`, error);
        
        // Check if this looks like a CORS error
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('cors') || errorMsg.includes('network') || errorMsg.includes('fetch')) {
          throw new Error(`CORS Error: Browser blocked the request to ${directUrl}. 

Fix needed: Configure API Gateway to handle OPTIONS preflight requests for User API.

Temporary workaround: 
1. Open AWS API Gateway Console
2. Find your API and select the /user resource  
3. Actions → Enable CORS
4. Set Access-Control-Allow-Origin: *
5. Actions → Deploy API`);
        }
      }
      console.error(`💥 User API request to ${directUrl} failed:`, error);
      throw error;
    }
  }

  // Get all users
  static async getAllUsers(): Promise<User[]> {
    console.log('🔄 UserService.getAllUsers called');
    
    // For development, use CORS workaround if needed
    if (USE_DEVELOPMENT_CORS_PROXY && window.location.hostname === 'localhost') {
      try {
        console.log('🔄 Attempting direct API call...');
        const response = await fetch(`${API_BASE_URL_USER}`);
        console.log('📡 Direct API response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Direct API call successful:', data);
          const users = data.users || (Array.isArray(data) ? data : []);
          return Array.isArray(users) ? users : [];
        }
        throw new Error('Direct API call failed');
      } catch (corsError) {
        console.warn('🚨 Direct API call blocked by CORS, using proxy...');
        try {
          // Use CORS proxy as fallback
          const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`${API_BASE_URL_USER}`)}`;
          console.log('🌐 Using proxy URL:', proxyUrl);
          
          const response = await fetch(proxyUrl);
          if (response.ok) {
            const proxyData = await response.json();
            const actualData = JSON.parse(proxyData.contents);
            const users = actualData.users || (Array.isArray(actualData) ? actualData : []);
            console.log('✅ Proxy call successful:', users);
            return Array.isArray(users) ? users : [];
          }
          throw new Error('Proxy call failed');
        } catch (proxyError) {
          console.error('🚨 Both direct and proxy calls failed:', { corsError, proxyError });
          console.log('🔧 Using mock user data for development');
          return this.getMockUsers();
        }
      }
    }

    // Production path
    const response = await this.makeRequest<UsersResponse>('', {
      method: 'GET',
    });

    return Array.isArray(response.users) ? response.users : [];
  }

  // Get a specific user by ID
  static async getUserById(userId: string): Promise<User> {
    console.log('🔄 UserService.getUserById called with ID:', userId);
    
    const response = await this.makeRequest<User>(`/${userId}`, {
      method: 'GET',
    }, false);

    return response;
  }

  // Create a new user
  static async createUser(userData: CreateUserRequest): Promise<User> {
    console.log('🔄 UserService.createUser called with data:', userData);
    
    // For development CORS workaround
    if (USE_DEVELOPMENT_CORS_PROXY && window.location.hostname === 'localhost') {
      console.log('📍 Entering CORS workaround path for user creation...');
      
      try {
        console.log('🔄 Attempting direct API call...');
        const directResponse = await fetch(`${API_BASE_URL_USER}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(userData),
        });
        
        console.log('📡 Direct API response status:', directResponse.status);
        
        if (directResponse.ok) {
          const data = await directResponse.json();
          console.log('✅ Direct API call successful! User created:', data);
          return data;
        }
        
        const errorText = await directResponse.text();
        console.log('❌ Direct API call failed, error text:', errorText);
        throw new Error(`Direct API call failed: ${directResponse.status} ${directResponse.statusText}`);
      } catch (corsError) {
        console.log('🚨 Direct API call failed with error:', corsError);
        console.warn('Direct API call blocked by CORS, using proxy for POST...');
        
        try {
          console.log('🔄 Attempting CORS proxy...');
          const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(`${API_BASE_URL_USER}`);
          console.log('🌐 Proxy URL:', proxyUrl);
          
          const proxyResponse = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
          });
          
          console.log('📡 Proxy response status:', proxyResponse.status);
          
          if (proxyResponse.ok) {
            const result = await proxyResponse.json();
            console.log('✅ CORS proxy successful! User created via proxy:', result);
            return result;
          }
          
          const proxyErrorText = await proxyResponse.text();
          console.log('❌ Proxy request failed, error text:', proxyErrorText);
          throw new Error(`Proxy request failed: ${proxyResponse.status}`);
        } catch (proxyError) {
          console.error('🚨 Both direct and proxy requests failed:', proxyError);
          console.warn('🔄 Creating mock user for development since API is not accessible');
          
          // Create a mock user for development
          const mockUser: User = {
            userId: 'mock-user-' + Date.now(),
            ...userData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          console.log('🔧 Mock user created for development:', mockUser);
          console.log('⚠️ WARNING: This is a MOCK USER - NOT SAVED TO DATABASE!');
          return mockUser;
        }
      }
    }

    // Production code path
    const response = await this.makeRequest<User>('', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    return response;
  }

  // Update an existing user
  static async updateUser(userId: string, userData: Partial<CreateUserRequest>): Promise<User> {
    console.log('🔄 UserService.updateUser called with ID:', userId, 'data:', userData);
    
    const updateData: UpdateUserRequest = {
      userId,
      ...userData,
    };

    const response = await this.makeRequest<User>(`/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    }, false);

    return response;
  }

  // Delete a user
  static async deleteUser(userId: string): Promise<void> {
    console.log('🔄 UserService.deleteUser called with ID:', userId);
    
    await this.makeRequest<void>(`/${userId}`, {
      method: 'DELETE',
    }, false);
  }

  // Get mock users for development
  private static getMockUsers(): User[] {
    return [
      {
        userId: 'user-001',
        employeeName: 'John Smith',
        employeeId: 'EMP001',
        email: 'john.smith@company.com',
        department: 'Engineering',
        position: 'Senior Software Engineer',
        skills: ['React', 'TypeScript', 'AWS', 'Python'],
        yearsOfExperience: 5,
        joinDate: '2020-01-15T00:00:00.000Z',
        manager: 'Sarah Wilson',
        phoneNumber: '+1-555-0101',
        location: 'New York, NY',
        status: 'active',
        avatar: '',
        createdAt: '2020-01-15T00:00:00.000Z',
        updatedAt: '2025-10-15T00:00:00.000Z',
      },
      {
        userId: 'user-002',
        employeeName: 'Sarah Wilson',
        employeeId: 'EMP002',
        email: 'sarah.wilson@company.com',
        department: 'Engineering',
        position: 'Engineering Manager',
        skills: ['Leadership', 'React', 'AWS', 'Team Management'],
        yearsOfExperience: 8,
        joinDate: '2018-03-20T00:00:00.000Z',
        phoneNumber: '+1-555-0102',
        location: 'New York, NY',
        status: 'active',
        avatar: '',
        createdAt: '2018-03-20T00:00:00.000Z',
        updatedAt: '2025-10-15T00:00:00.000Z',
      },
      {
        userId: 'user-003',
        employeeName: 'Mike Johnson',
        employeeId: 'EMP003',
        email: 'mike.johnson@company.com',
        department: 'Marketing',
        position: 'Marketing Specialist',
        skills: ['Digital Marketing', 'Content Creation', 'Analytics', 'SEO'],
        yearsOfExperience: 3,
        joinDate: '2022-06-10T00:00:00.000Z',
        manager: 'Emily Davis',
        phoneNumber: '+1-555-0103',
        location: 'San Francisco, CA',
        status: 'active',
        avatar: '',
        createdAt: '2022-06-10T00:00:00.000Z',
        updatedAt: '2025-10-15T00:00:00.000Z',
      },
      {
        userId: 'user-004',
        employeeName: 'Emily Davis',
        employeeId: 'EMP004',
        email: 'emily.davis@company.com',
        department: 'Marketing',
        position: 'Marketing Manager',
        skills: ['Strategy', 'Brand Management', 'Team Leadership', 'Analytics'],
        yearsOfExperience: 6,
        joinDate: '2019-09-01T00:00:00.000Z',
        phoneNumber: '+1-555-0104',
        location: 'San Francisco, CA',
        status: 'active',
        avatar: '',
        createdAt: '2019-09-01T00:00:00.000Z',
        updatedAt: '2025-10-15T00:00:00.000Z',
      },
      {
        userId: 'user-005',
        employeeName: 'David Brown',
        employeeId: 'EMP005',
        email: 'david.brown@company.com',
        department: 'Finance',
        position: 'Financial Analyst',
        skills: ['Financial Analysis', 'Excel', 'SQL', 'Data Modeling'],
        yearsOfExperience: 4,
        joinDate: '2021-02-14T00:00:00.000Z',
        manager: 'Lisa Chen',
        phoneNumber: '+1-555-0105',
        location: 'Chicago, IL',
        status: 'on-leave',
        avatar: '',
        createdAt: '2021-02-14T00:00:00.000Z',
        updatedAt: '2025-10-15T00:00:00.000Z',
      },
      {
        userId: 'user-006',
        employeeName: 'Lisa Chen',
        employeeId: 'EMP006',
        email: 'lisa.chen@company.com',
        department: 'Finance',
        position: 'Finance Director',
        skills: ['Financial Planning', 'Leadership', 'Strategic Analysis', 'Budget Management'],
        yearsOfExperience: 10,
        joinDate: '2016-11-30T00:00:00.000Z',
        phoneNumber: '+1-555-0106',
        location: 'Chicago, IL',
        status: 'active',
        avatar: '',
        createdAt: '2016-11-30T00:00:00.000Z',
        updatedAt: '2025-10-15T00:00:00.000Z',
      }
    ];
  }
}

export default UserService;