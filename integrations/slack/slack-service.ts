import { WebClient } from '@slack/web-api';
import { IncomingWebhook } from '@slack/webhook';

interface SlackUser {
  id: string;
  name: string;
  email: string;
  real_name: string;
}

interface TaskNotification {
  taskId: string;
  taskTitle: string;
  assigneeName: string;
  assigneeSlackId: string;
  priority: string;
  dueDate?: string;
}

interface LeaveNotification {
  requestId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: string;
  approverSlackId?: string;
}

export class SlackService {
  private client: WebClient;
  private webhook?: IncomingWebhook;

  constructor(botToken: string, webhookUrl?: string) {
    this.client = new WebClient(botToken);
    if (webhookUrl) {
      this.webhook = new IncomingWebhook(webhookUrl);
    }
  }

  /**
   * Find Slack user by email
   */
  async findUserByEmail(email: string): Promise<SlackUser | null> {
    try {
      const result = await this.client.users.lookupByEmail({ email });
      
      if (result.ok && result.user) {
        return {
          id: result.user.id!,
          name: result.user.name!,
          email: result.user.profile?.email!,
          real_name: result.user.real_name!,
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error finding Slack user by email:', error);
      return null;
    }
  }

  /**
   * Send direct message to user
   */
  async sendDirectMessage(userId: string, message: string): Promise<boolean> {
    try {
      const result = await this.client.chat.postMessage({
        channel: userId,
        text: message,
      });

      return result.ok || false;
    } catch (error) {
      console.error('Error sending direct message:', error);
      return false;
    }
  }

  /**
   * Send task assignment notification
   */
  async sendTaskAssignmentNotification(notification: TaskNotification): Promise<boolean> {
    const priorityEmoji = {
      high: '🔴',
      medium: '🟡',
      low: '🟢',
    };

    const message = `
🎯 *New Task Assigned*

*Task:* ${notification.taskTitle}
*Priority:* ${priorityEmoji[notification.priority as keyof typeof priorityEmoji]} ${notification.priority.toUpperCase()}
*Task ID:* ${notification.taskId}
${notification.dueDate ? `*Due Date:* ${notification.dueDate}` : ''}

You can view and manage this task in the TaskFlow dashboard.
    `.trim();

    return await this.sendDirectMessage(notification.assigneeSlackId, message);
  }

  /**
   * Send task update notification
   */
  async sendTaskUpdateNotification(
    userId: string,
    taskTitle: string,
    updateType: string,
    details?: string
  ): Promise<boolean> {
    const updateEmojis = {
      completed: '✅',
      updated: '📝',
      overdue: '⚠️',
      comment: '💬',
    };

    const emoji = updateEmojis[updateType as keyof typeof updateEmojis] || '📋';

    const message = `
${emoji} *Task Update*

*Task:* ${taskTitle}
*Update:* ${updateType.charAt(0).toUpperCase() + updateType.slice(1)}
${details ? `*Details:* ${details}` : ''}

Check TaskFlow for more information.
    `.trim();

    return await this.sendDirectMessage(userId, message);
  }

  /**
   * Send leave request notification to approver
   */
  async sendLeaveRequestNotification(notification: LeaveNotification): Promise<boolean> {
    if (!notification.approverSlackId) {
      return false;
    }

    const leaveEmojis = {
      vacation: '🏖️',
      sick: '🤒',
      personal: '👤',
      emergency: '🚨',
    };

    const emoji = leaveEmojis[notification.leaveType as keyof typeof leaveEmojis] || '📅';

    const message = `
${emoji} *Leave Request Pending Approval*

*Employee:* ${notification.employeeName}
*Leave Type:* ${notification.leaveType.charAt(0).toUpperCase() + notification.leaveType.slice(1)}
*Dates:* ${notification.startDate} to ${notification.endDate}
*Request ID:* ${notification.requestId}

Please review and approve/reject this request in the TaskFlow dashboard.
    `.trim();

    return await this.sendDirectMessage(notification.approverSlackId, message);
  }

  /**
   * Send leave status update notification
   */
  async sendLeaveStatusNotification(
    employeeSlackId: string,
    notification: LeaveNotification
  ): Promise<boolean> {
    const statusEmojis = {
      approved: '✅',
      rejected: '❌',
      pending: '⏳',
    };

    const emoji = statusEmojis[notification.status as keyof typeof statusEmojis] || '📋';

    const message = `
${emoji} *Leave Request ${notification.status.toUpperCase()}*

*Leave Type:* ${notification.leaveType.charAt(0).toUpperCase() + notification.leaveType.slice(1)}
*Dates:* ${notification.startDate} to ${notification.endDate}
*Status:* ${notification.status.charAt(0).toUpperCase() + notification.status.slice(1)}

${notification.status === 'approved' 
  ? 'Your leave request has been approved! 🎉' 
  : notification.status === 'rejected'
  ? 'Your leave request has been rejected. Please contact your manager for details.'
  : 'Your leave request is still pending approval.'
}
    `.trim();

    return await this.sendDirectMessage(employeeSlackId, message);
  }

  /**
   * Send team notification to channel
   */
  async sendTeamNotification(
    channelId: string,
    title: string,
    message: string,
    color: string = 'good'
  ): Promise<boolean> {
    try {
      const result = await this.client.chat.postMessage({
        channel: channelId,
        attachments: [
          {
            color,
            title,
            text: message,
          },
        ],
      });

      return result.ok || false;
    } catch (error) {
      console.error('Error sending team notification:', error);
      return false;
    }
  }

  /**
   * Create a Slack reminder
   */
  async createReminder(
    userId: string,
    text: string,
    time: string
  ): Promise<boolean> {
    try {
      const result = await this.client.reminders.add({
        text,
        time,
        user: userId,
      });

      return result.ok || false;
    } catch (error) {
      console.error('Error creating reminder:', error);
      return false;
    }
  }

  /**
   * Send webhook notification (for general announcements)
   */
  async sendWebhookNotification(
    title: string,
    message: string,
    fields?: Array<{ title: string; value: string; short?: boolean }>
  ): Promise<boolean> {
    if (!this.webhook) {
      console.error('Webhook URL not configured');
      return false;
    }

    try {
      await this.webhook.send({
        attachments: [
          {
            color: 'good',
            title,
            text: message,
            ...(fields && { fields }),
          },
        ],
      });

      return true;
    } catch (error) {
      console.error('Error sending webhook notification:', error);
      return false;
    }
  }

  /**
   * Get user presence status
   */
  async getUserPresence(userId: string): Promise<string | null> {
    try {
      const result = await this.client.users.getPresence({ user: userId });
      return result.presence || null;
    } catch (error) {
      console.error('Error getting user presence:', error);
      return null;
    }
  }

  /**
   * Send daily task summary to user
   */
  async sendDailyTaskSummary(
    userId: string,
    tasks: Array<{ title: string; priority: string; dueDate?: string }>
  ): Promise<boolean> {
    if (tasks.length === 0) {
      return await this.sendDirectMessage(
        userId,
        '🎉 Great job! You have no pending tasks for today.'
      );
    }

    const taskList = tasks
      .map((task, index) => {
        const priorityEmoji = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
        const dueText = task.dueDate ? ` (Due: ${task.dueDate})` : '';
        return `${index + 1}. ${priorityEmoji} ${task.title}${dueText}`;
      })
      .join('\n');

    const message = `
📋 *Your Tasks for Today*

${taskList}

Have a productive day! 💪
    `.trim();

    return await this.sendDirectMessage(userId, message);
  }
}

// AWS Lambda function for Slack integration
export const handleSlackNotification = async (event: any) => {
  const { notificationType, data, slackToken, webhookUrl } = event;

  const slackService = new SlackService(slackToken, webhookUrl);

  try {
    let success = false;

    switch (notificationType) {
      case 'task_assigned':
        success = await slackService.sendTaskAssignmentNotification(data);
        break;

      case 'task_updated':
        success = await slackService.sendTaskUpdateNotification(
          data.userId,
          data.taskTitle,
          data.updateType,
          data.details
        );
        break;

      case 'leave_request':
        success = await slackService.sendLeaveRequestNotification(data);
        break;

      case 'leave_status':
        success = await slackService.sendLeaveStatusNotification(
          data.employeeSlackId,
          data
        );
        break;

      case 'daily_summary':
        success = await slackService.sendDailyTaskSummary(
          data.userId,
          data.tasks
        );
        break;

      default:
        console.error('Unknown notification type:', notificationType);
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Unknown notification type' }),
        };
    }

    return {
      statusCode: success ? 200 : 500,
      body: JSON.stringify({
        message: success ? 'Notification sent successfully' : 'Failed to send notification',
      }),
    };
  } catch (error) {
    console.error('Error handling Slack notification:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to process Slack notification',
      }),
    };
  }
};
