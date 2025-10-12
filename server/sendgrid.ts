import { MailService } from '@sendgrid/mail';
import * as fs from 'fs';
import * as path from 'path';

const mailService = new MailService();

if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('⚠️ SENDGRID_API_KEY not set - email functionality will be disabled');
}

interface EmailAttachment {
  filePath: string;
  originalName?: string;
}

interface EmailParams {
  to: string;
  from: string;
  replyTo?: string;
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: (string | EmailAttachment)[];
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('Email sending skipped - SENDGRID_API_KEY not configured');
    return false;
  }
  
  try {
    console.log(
      `Attempting to send email to ${params.to} from ${params.from} with subject: ${params.subject}`
    );
    const emailData: any = {
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || '',
      html: params.html || '',
    };
    
    // Add Reply-To header if provided
    if (params.replyTo) {
      emailData.replyTo = params.replyTo;
    }
    
    // Add BCC if provided
    if (params.bcc) {
      emailData.bcc = params.bcc;
    }
    
    // Process attachments if provided
    if (params.attachments && params.attachments.length > 0) {
      const processedAttachments = [];
      
      for (const attachment of params.attachments) {
        try {
          // Handle both string paths and attachment objects
          const filePath = typeof attachment === 'string' ? attachment : attachment.filePath;
          const originalName = typeof attachment === 'string' ? undefined : attachment.originalName;
          
          // Check if file exists
          if (!fs.existsSync(filePath)) {
            console.warn(`Attachment file not found: ${filePath}`);
            continue;
          }
          
          // Read file from disk
          const fileContent = fs.readFileSync(filePath);
          const base64Content = fileContent.toString('base64');
          
          // Use original name if provided, otherwise extract from path
          const filename = originalName || path.basename(filePath);
          
          // Determine content type based on file extension
          const ext = path.extname(filename).toLowerCase();
          const contentTypeMap: Record<string, string> = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.txt': 'text/plain',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
          };
          
          const contentType = contentTypeMap[ext] || 'application/octet-stream';
          
          processedAttachments.push({
            content: base64Content,
            filename: filename,
            type: contentType,
            disposition: 'attachment',
          });
          
          console.log(`Processed attachment: ${filename} (${contentType})`);
        } catch (attachmentError) {
          console.error(`Failed to process attachment ${filePath}:`, attachmentError);
          // Continue processing other attachments even if one fails
        }
      }
      
      if (processedAttachments.length > 0) {
        emailData.attachments = processedAttachments;
        console.log(`Added ${processedAttachments.length} attachment(s) to email`);
      }
    }
    
    await mailService.send(emailData);
    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    if (error.response && error.response.body) {
      console.error(
        'SendGrid error details:',
        JSON.stringify(error.response.body, null, 2)
      );
    }
    return false;
  }
}

export async function sendSuggestionNotification(suggestion: {
  title: string;
  description: string;
  category: string;
  priority: string;
  submittedBy: string;
  submittedAt: Date;
}): Promise<boolean> {
  // Import SendGrid compliance footer
  const { EMAIL_FOOTER_TEXT, EMAIL_FOOTER_HTML } = await import('./utils/email-footer');
  
  const emailContent = `
New Suggestion Submitted to The Sandwich Project

Title: ${suggestion.title}
Category: ${suggestion.category}
Priority: ${suggestion.priority}
Submitted by: ${suggestion.submittedBy}
Submitted at: ${suggestion.submittedAt.toLocaleString()}

Description:
${suggestion.description}

---
This is an automated notification from The Sandwich Project suggestions portal.${EMAIL_FOOTER_TEXT}
  `.trim();

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #236383;">New Suggestion Submitted</h2>
      <p>A new suggestion has been submitted to The Sandwich Project suggestions portal.</p>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #333;">${suggestion.title}</h3>
        <p><strong>Category:</strong> ${suggestion.category}</p>
        <p><strong>Priority:</strong> ${suggestion.priority}</p>
        <p><strong>Submitted by:</strong> ${suggestion.submittedBy}</p>
        <p><strong>Submitted at:</strong> ${suggestion.submittedAt.toLocaleString()}</p>
      </div>
      
      <div style="margin: 20px 0;">
        <h4>Description:</h4>
        <p style="white-space: pre-wrap; background-color: #f9f9f9; padding: 15px; border-radius: 4px;">${
          suggestion.description
        }</p>
      </div>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px;">This is an automated notification from The Sandwich Project suggestions portal.</p>
      ${EMAIL_FOOTER_HTML}
    </div>
  `;

  return sendEmail({
    to: 'katielong2316@gmail.com', // Your email for development notifications
    from: 'katielong2316@gmail.com', // Using your verified email as sender
    subject: `New Suggestion: ${suggestion.title}`,
    text: emailContent,
    html: htmlContent,
  });
}

export async function sendWeeklyMonitoringReminder(location: string): Promise<{success: boolean; message?: string}> {
  try {
    // Import SendGrid compliance footer
    const { EMAIL_FOOTER_TEXT, EMAIL_FOOTER_HTML } = await import('./utils/email-footer');

    const emailContent = `
Weekly Monitoring Reminder - ${location}

This is a reminder to submit the weekly monitoring data for ${location}.

Please log in to The Sandwich Project dashboard and submit this week's monitoring information.

---
This is an automated reminder from The Sandwich Project weekly monitoring system.${EMAIL_FOOTER_TEXT}
    `.trim();

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #236383;">Weekly Monitoring Reminder</h2>
        <h3 style="color: #666;">${location}</h3>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p>This is a reminder to submit the weekly monitoring data for <strong>${location}</strong>.</p>
          <p>Please log in to The Sandwich Project dashboard and submit this week's monitoring information.</p>
        </div>

        <div style="margin: 20px 0; text-align: center;">
          <a href="${process.env.APP_URL || 'https://your-app-url.com'}/dashboard"
             style="background-color: #236383; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Go to Dashboard
          </a>
        </div>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">This is an automated reminder from The Sandwich Project weekly monitoring system.</p>
        ${EMAIL_FOOTER_HTML}
      </div>
    `;

    const sent = await sendEmail({
      to: 'katielong2316@gmail.com', // TODO: Replace with actual location contact email
      from: 'katielong2316@gmail.com',
      subject: `Weekly Monitoring Reminder - ${location}`,
      text: emailContent,
      html: htmlContent,
    });

    return {
      success: sent,
      message: sent ? 'Email sent successfully' : 'Failed to send email'
    };
  } catch (error) {
    console.error('Error sending weekly monitoring reminder:', error);
    return {
      success: false,
      message: error.message || 'Failed to send email'
    };
  }
}
