// Backend server URL for file uploads (avoids CORS issues)
const UPLOAD_SERVER_URL = 'http://localhost:3001';

export class FileService {
  /**
   * Upload a file to S3 via backend proxy server
   * @param file - The file to upload
   * @param userId - The user uploading the file
   * @param taskId - Optional task ID to associate with the file
   * @returns The S3 URL of the uploaded file
   */
  static async uploadFile(
    file: File,
    userId: string,
    taskId?: string
  ): Promise<string> {
    try {
      console.log('Uploading file via backend server...', {
        fileName: file.name,
        size: file.size,
        type: file.type,
        userId,
        taskId,
      });

      // Create FormData to send file to backend
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', userId);
      if (taskId) {
        formData.append('taskId', taskId);
      }

      // Upload via backend server
      const response = await fetch(`${UPLOAD_SERVER_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Upload failed: ${response.status}`);
      }

      const result = await response.json();
      
      console.log('File uploaded successfully:', result);

      return result.s3Url;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Upload multiple files
   * @param files - Array of files to upload
   * @param userId - The user uploading the files
   * @param taskId - Optional task ID to associate with the files
   * @returns Array of S3 URLs
   */
  static async uploadFiles(
    files: File[],
    userId: string,
    taskId?: string
  ): Promise<string[]> {
    const uploadPromises = files.map((file) =>
      this.uploadFile(file, userId, taskId)
    );

    return Promise.all(uploadPromises);
  }
}