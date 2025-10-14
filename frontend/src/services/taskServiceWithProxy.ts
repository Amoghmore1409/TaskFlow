import { Task } from '../pages/Tasks/Tasks';

// For development: you can use a CORS proxy temporarily
const USE_CORS_PROXY = true; // Set to false once CORS is configured in API Gateway
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const API_BASE_URL = 'https://28zq8tmjl8.execute-api.us-east-1.amazonaws.com/dev';

interface CreateTaskRequest {
  title: string;
  description: string;
  assignedBy: string;
  assignedTo?: string;
  status: 'pending' | 'in-progress' | 'completed';
  dueDate: string;
  Task_Complexity: number;
  Required_Skills: string[];
  attachments?: string[];
}

interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  taskId: string;
}

export class TaskService {
  private static getUrl(endpoint: string): string {
    const fullUrl = `${API_BASE_URL}${endpoint}`;
    
    // Use CORS proxy for development if CORS is not configured
    if (USE_CORS_PROXY && window.location.hostname === 'localhost') {
      console.warn('Using CORS proxy for development. Configure CORS in API Gateway for production.');
      return `${CORS_PROXY}${encodeURIComponent(fullUrl)}`;
    }
    
    return fullUrl;
  }

  private static async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = this.getUrl(endpoint);
    
    const defaultHeaders: Record<string, string> = {};
    
    // Don't set Content-Type when using CORS proxy for GET requests
    if (!USE_CORS_PROXY || options.method !== 'GET') {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    console.log(`Making API request to: ${url}`, { method: options.method || 'GET', headers: config.headers });

    try {
      const response = await fetch(url, config);
      
      console.log(`API Response Status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorBody = await response.text();
        const errorMessage = `API request failed: ${response.status} ${response.statusText}. ${errorBody}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
      }

      // Handle empty responses
      const text = await response.text();
      console.log('Raw API Response:', text);
      
      if (!text) {
        console.log('Empty response, returning empty object');
        return {} as T;
      }

      try {
        const parsed = JSON.parse(text) as T;
        console.log('Parsed API Response:', parsed);
        return parsed;
      } catch (parseError) {
        console.warn('Response is not valid JSON:', text);
        return text as unknown as T;
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(`Network error - check if API is accessible: ${url}`, error);
        throw new Error(`Network error: Unable to connect to API. This is likely a CORS issue. Check the browser console and configure CORS in your API Gateway.`);
      }
      console.error(`API request to ${url} failed:`, error);
      throw error;
    }
  }

  // Create a new task
  static async createTask(taskData: CreateTaskRequest): Promise<Task> {
    // CORS proxy doesn't support POST requests reliably, so disable it for mutations
    const originalProxySetting = USE_CORS_PROXY;
    (this as any).USE_CORS_PROXY = false;
    
    try {
      const response = await this.makeRequest<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData),
      });
      return response;
    } finally {
      (this as any).USE_CORS_PROXY = originalProxySetting;
    }
  }

  // Get all tasks
  static async getAllTasks(): Promise<Task[]> {
    const response = await this.makeRequest<Task[]>('/tasks', {
      method: 'GET',
    });

    return Array.isArray(response) ? response : [];
  }

  // Get a specific task by ID
  static async getTaskById(taskId: string): Promise<Task> {
    const response = await this.makeRequest<Task>(`/tasks/${taskId}`, {
      method: 'GET',
    });

    return response;
  }

  // Update an existing task
  static async updateTask(taskId: string, taskData: Partial<CreateTaskRequest>): Promise<Task> {
    // CORS proxy doesn't support PUT requests reliably, so disable it for mutations
    const originalProxySetting = USE_CORS_PROXY;
    (this as any).USE_CORS_PROXY = false;
    
    try {
      const updateData: UpdateTaskRequest = {
        taskId,
        ...taskData,
      };

      const response = await this.makeRequest<Task>(`/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      return response;
    } finally {
      (this as any).USE_CORS_PROXY = originalProxySetting;
    }
  }

  // Delete a task
  static async deleteTask(taskId: string): Promise<void> {
    // CORS proxy doesn't support DELETE requests reliably, so disable it for mutations
    const originalProxySetting = USE_CORS_PROXY;
    (this as any).USE_CORS_PROXY = false;
    
    try {
      await this.makeRequest<void>(`/tasks/${taskId}`, {
        method: 'DELETE',
      });
    } finally {
      (this as any).USE_CORS_PROXY = originalProxySetting;
    }
  }

  // Update task status only (quick status change)
  static async updateTaskStatus(taskId: string, status: 'pending' | 'in-progress' | 'completed'): Promise<Task> {
    // CORS proxy doesn't support PUT requests reliably, so disable it for mutations
    const originalProxySetting = USE_CORS_PROXY;
    (this as any).USE_CORS_PROXY = false;
    
    try {
      const response = await this.makeRequest<Task>(`/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({
          taskId,
          status,
          updatedAt: new Date().toISOString(),
        }),
      });

      return response;
    } finally {
      (this as any).USE_CORS_PROXY = originalProxySetting;
    }
  }
}