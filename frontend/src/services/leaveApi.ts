// TODO: Replace with your actual API Gateway Invoke URL
const API_BASE_URL = 'https://owsbp59rqk.execute-api.us-east-1.amazonaws.com/dev';

// This interface defines the data structure returned by our simple Lambda function
interface LeaveRequestFromApi {
  leaveRequestId: string;
  userId: string;
  employeeName: string;
  leaveType: string;
  status: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Fetches all leave requests from the backend.
 */
export async function getLeaveRequests(): Promise<LeaveRequestFromApi[]> {
  const response = await fetch(`${API_BASE_URL}/leave-request`);
  if (!response.ok) {
    throw new Error('Failed to fetch leave requests');
  }
  return response.json();
}

/**
 * Creates a new leave request. The body should match the Lambda's POST schema.
 * @param requestData - The data for the new leave request.
 */
export async function createLeaveRequest(requestData: object): Promise<LeaveRequestFromApi> {
  const response = await fetch(`${API_BASE_URL}/leave-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestData),
  });
  if (!response.ok) {
    throw new Error('Failed to create leave request');
  }
  return response.json();
}

/**
 * Updates the status of an existing leave request.
 * @param requestId - The ID of the request to update.
 * @param newStatus - The new status ('approved', 'rejected', etc.).
 */
export async function updateLeaveRequestStatus(requestId: string, newStatus: string): Promise<LeaveRequestFromApi> {
  const response = await fetch(`${API_BASE_URL}/leave-request/${requestId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: newStatus }),
  });
  if (!response.ok) {
    throw new Error('Failed to update leave request status');
  }
  return response.json();
}

/**
 * Deletes a leave request.
 */
export async function deleteLeaveRequest(requestId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/leave-request/${requestId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete leave request');
  }
}