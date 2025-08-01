import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransporter({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendVerificationEmail(email: string, firstName: string, token: string): Promise<void> {
    const verificationUrl = `${this.configService.get<string>('FRONTEND_URL')}/auth/verify-email?token=${token}`;

    const mailOptions = {
      from: {
        name: 'SynapseAI',
        address: this.configService.get<string>('SMTP_FROM_EMAIL'),
      },
      to: email,
      subject: 'Verify Your SynapseAI Account',
      html: this.getVerificationEmailTemplate(firstName, verificationUrl),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Verification email sent to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}:`, error);
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, firstName: string, token: string): Promise<void> {
    const resetUrl = `${this.configService.get<string>('FRONTEND_URL')}/auth/reset-password?token=${token}`;

    const mailOptions = {
      from: {
        name: 'SynapseAI',
        address: this.configService.get<string>('SMTP_FROM_EMAIL'),
      },
      to: email,
      subject: 'Reset Your SynapseAI Password',
      html: this.getPasswordResetEmailTemplate(firstName, resetUrl),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}:`, error);
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, firstName: string, organizationName: string): Promise<void> {
    const loginUrl = `${this.configService.get<string>('FRONTEND_URL')}/auth/login`;

    const mailOptions = {
      from: {
        name: 'SynapseAI',
        address: this.configService.get<string>('SMTP_FROM_EMAIL'),
      },
      to: email,
      subject: 'Welcome to SynapseAI',
      html: this.getWelcomeEmailTemplate(firstName, organizationName, loginUrl),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Welcome email sent to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}:`, error);
      throw error;
    }
  }

  private getVerificationEmailTemplate(firstName: string, verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your SynapseAI Account</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e1e5e9; border-top: none; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; border-radius: 0 0 8px 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to SynapseAI</h1>
              <p>Enterprise AI Orchestration Platform</p>
            </div>
            <div class="content">
              <h2>Hi ${firstName},</h2>
              <p>Thank you for signing up for SynapseAI! To complete your registration and start building powerful AI workflows, please verify your email address.</p>
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
              <p><strong>This link will expire in 24 hours.</strong></p>
              <p>If you didn't create an account with SynapseAI, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 SynapseAI. All rights reserved.</p>
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getPasswordResetEmailTemplate(firstName: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your SynapseAI Password</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e1e5e9; border-top: none; }
            .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; border-radius: 0 0 8px 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
              <p>SynapseAI Security</p>
            </div>
            <div class="content">
              <h2>Hi ${firstName},</h2>
              <p>We received a request to reset your SynapseAI password. If you made this request, click the button below to reset your password:</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #dc3545;">${resetUrl}</p>
              <p><strong>This link will expire in 1 hour.</strong></p>
              <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
              <p>For security reasons, this link can only be used once.</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 SynapseAI. All rights reserved.</p>
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getWelcomeEmailTemplate(firstName: string, organizationName: string, loginUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to SynapseAI</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e1e5e9; border-top: none; }
            .button { display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6c757d; border-radius: 0 0 8px 8px; }
            .feature { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 6px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to SynapseAI!</h1>
              <p>Your AI Orchestration Journey Begins</p>
            </div>
            <div class="content">
              <h2>Hi ${firstName},</h2>
              <p>Congratulations! Your SynapseAI account for <strong>${organizationName}</strong> is now active and ready to use.</p>
              
              <div style="text-align: center;">
                <a href="${loginUrl}" class="button">Access Your Dashboard</a>
              </div>

              <h3>What you can do with SynapseAI:</h3>
              
              <div class="feature">
                <h4>🤖 Create AI Agents</h4>
                <p>Build intelligent agents with multi-provider support and advanced capabilities.</p>
              </div>
              
              <div class="feature">
                <h4>🔧 Develop Custom Tools</h4>
                <p>Create powerful tools for API integration, data processing, and automation.</p>
              </div>
              
              <div class="feature">
                <h4>🔄 Design Workflows</h4>
                <p>Orchestrate complex AI workflows with our visual workflow builder.</p>
              </div>
              
              <div class="feature">
                <h4>📊 Monitor & Analyze</h4>
                <p>Track performance, costs, and usage with comprehensive analytics.</p>
              </div>

              <p>Need help getting started? Check out our documentation or contact our support team.</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 SynapseAI. All rights reserved.</p>
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}