// ML Prediction and Task Assignment Service

const ML_PREDICT_API = 'https://3yyt4uq6wj.execute-api.us-east-1.amazonaws.com/dev/predict';
const ASSIGN_TASK_API = 'https://fymcyfakj2.execute-api.us-east-1.amazonaws.com/dev/assignTask';

export interface UserSkillProfile {
  id: string; // For UI compatibility
  userId: string;
  email: string;
  name: string;
  yearsOfExperience: number;
  skills: string[];
  department?: string;
  avatar?: string;
}

export interface TaskAssignmentPrediction {
  userId: string;
  email: string;
  name: string;
  predictedCompletionTime: number;
  skillMatchScore: number;
  yearsOfExperience: number;
  matchedSkills: string[];
  missingSkills: string[];
}

export interface AssignTaskRequest {
  taskId: string;
  assignedTo: string; // email or userId
}

export interface AssignTaskResponse {
  success: boolean;
  message: string;
  taskId: string;
  assignedTo: string;
}

export class TaskAssignmentService {
  /**
   * Calculate skill match score between user skills and required skills
   */
  private static calculateSkillMatchScore(
    userSkills: string[],
    requiredSkills: string[]
  ): { score: number; matched: string[]; missing: string[] } {
    if (!requiredSkills || requiredSkills.length === 0) {
      return { score: 1.0, matched: [], missing: [] };
    }

    const userSkillsLower = userSkills.map(s => s.toLowerCase().trim());
    const requiredSkillsLower = requiredSkills.map(s => s.toLowerCase().trim());

    const matched = requiredSkillsLower.filter(skill =>
      userSkillsLower.includes(skill)
    );

    const missing = requiredSkillsLower.filter(skill =>
      !userSkillsLower.includes(skill)
    );

    const score = requiredSkillsLower.length > 0
      ? matched.length / requiredSkillsLower.length
      : 1.0;

    return {
      score: Number(score.toFixed(2)),
      matched: matched,
      missing: missing,
    };
  }

  /**
   * Get ML prediction for task completion time
   */
  private static async getPrediction(
    taskComplexity: number,
    yearsOfExperience: number,
    skillMatchScore: number
  ): Promise<number> {
    try {
      const response = await fetch(ML_PREDICT_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Task_Complexity: taskComplexity,
          Years_of_Experience: yearsOfExperience,
          Skill_Match_Score: skillMatchScore,
        }),
      });

      if (!response.ok) {
        throw new Error(`ML API error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || 0;
    } catch (error) {
      console.error('Error getting ML prediction:', error);
      throw error;
    }
  }

  /**
   * Get task assignment recommendations for all users
   */
  static async getTaskRecommendations(
    taskComplexity: number,
    requiredSkills: string[],
    users: UserSkillProfile[]
  ): Promise<TaskAssignmentPrediction[]> {
    try {
      console.log('Getting task recommendations...', {
        taskComplexity,
        requiredSkills,
        userCount: users.length,
      });

      // Calculate predictions for all users
      const predictions = await Promise.all(
        users.map(async (user) => {
          const skillMatch = this.calculateSkillMatchScore(
            user.skills,
            requiredSkills
          );

          const predictedTime = await this.getPrediction(
            taskComplexity,
            user.yearsOfExperience,
            skillMatch.score
          );

          return {
            userId: user.userId,
            email: user.email,
            name: user.name,
            predictedCompletionTime: predictedTime,
            skillMatchScore: skillMatch.score,
            yearsOfExperience: user.yearsOfExperience,
            matchedSkills: skillMatch.matched,
            missingSkills: skillMatch.missing,
          };
        })
      );

      // Sort by predicted completion time (ascending) and skill match score (descending)
      const sortedPredictions = predictions.sort((a, b) => {
        // Primary sort: Lower completion time is better
        const timeDiff = a.predictedCompletionTime - b.predictedCompletionTime;
        if (Math.abs(timeDiff) > 0.5) {
          return timeDiff;
        }
        // Secondary sort: Higher skill match is better
        return b.skillMatchScore - a.skillMatchScore;
      });

      console.log('Recommendations generated:', sortedPredictions);

      return sortedPredictions;
    } catch (error) {
      console.error('Error getting recommendations:', error);
      throw error;
    }
  }

  /**
   * Assign task to selected user
   */
  static async assignTask(
    taskId: string,
    assignedToEmail: string
  ): Promise<AssignTaskResponse> {
    try {
      console.log('Assigning task...', { taskId, assignedToEmail });

      const response = await fetch(ASSIGN_TASK_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId: taskId,
          assignedTo: assignedToEmail,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Assignment API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      console.log('Task assigned successfully:', data);

      return {
        success: true,
        message: 'Task assigned successfully',
        taskId: taskId,
        assignedTo: assignedToEmail,
        ...data,
      };
    } catch (error) {
      console.error('Error assigning task:', error);
      throw error;
    }
  }
}
