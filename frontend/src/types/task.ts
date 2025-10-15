// Task interface definition for task management services
export interface Task {
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

export interface TaskFormData {
  title: string;
  description: string;
  assignedTo: string;
  status: 'pending' | 'in-progress' | 'completed';
  dueDate: string;
  Task_Complexity: number;
  Required_Skills: string[];
}

// API response types for tasks
export interface TasksResponse {
  tasks: Task[];
  count: number;
}

export interface CreateTaskRequest {
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

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  taskId: string;
}