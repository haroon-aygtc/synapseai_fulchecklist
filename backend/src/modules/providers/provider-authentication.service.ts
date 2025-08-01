import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

export interface ProviderCredentials {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  customHeaders?: Record<string, string>;
  additionalConfig?: Record<string, any>;
}

export interface EncryptedCredentials {
  encryptedData: string;
  iv: string;
  authTag: string;
}

@Injectable()
export class ProviderAuthenticationService {
  private readonly logger = new Logger(ProviderAuthenticationService.name);
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const key = this.config.get<string>('ENCRYPTION_KEY');
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    this.encryptionKey = crypto.scryptSync(key, 'salt', 32);
  }

  /**
   * Encrypt provider credentials using AES-256-GCM
   */
  encryptCredentials(credentials: ProviderCredentials): EncryptedCredentials {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipherGCM(this.algorithm, this.encryptionKey, iv);
      
      const credentialsJson = JSON.stringify(credentials);
      let encrypted = cipher.update(credentialsJson, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();

      return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      this.logger.error(`Error encrypting credentials: ${error.message}`);
      throw new Error('Failed to encrypt credentials');
    }
  }

  /**
   * Decrypt provider credentials
   */
  decryptCredentials(encryptedCredentials: EncryptedCredentials): ProviderCredentials {
    try {
      const iv = Buffer.from(encryptedCredentials.iv, 'hex');
      const authTag = Buffer.from(encryptedCredentials.authTag, 'hex');
      const decipher = crypto.createDecipherGCM(this.algorithm, this.encryptionKey, iv);
      
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedCredentials.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      this.logger.error(`Error decrypting credentials: ${error.message}`);
      throw new Error('Failed to decrypt credentials');
    }
  }

  /**
   * Store encrypted credentials for a provider
   */
  async storeProviderCredentials(
    providerId: string,
    credentials: ProviderCredentials,
    authType: string = 'api_key'
  ): Promise<void> {
    try {
      const encryptedCredentials = this.encryptCredentials(credentials);
      
      await this.prisma.providerAuthentication.upsert({
        where: { providerId },
        update: {
          authType,
          credentials: encryptedCredentials,
          isActive: true,
          updatedAt: new Date()
        },
        create: {
          providerId,
          authType,
          credentials: encryptedCredentials,
          isActive: true
        }
      });

      this.logger.log(`Stored credentials for provider ${providerId}`);
    } catch (error) {
      this.logger.error(`Error storing credentials for provider ${providerId}: ${error.message}`);
      throw new Error('Failed to store provider credentials');
    }
  }

  /**
   * Retrieve and decrypt credentials for a provider
   */
  async getProviderCredentials(providerId: string): Promise<ProviderCredentials | null> {
    try {
      const authRecord = await this.prisma.providerAuthentication.findUnique({
        where: { providerId }
      });

      if (!authRecord || !authRecord.isActive) {
        return null;
      }

      return this.decryptCredentials(authRecord.credentials as EncryptedCredentials);
    } catch (error) {
      this.logger.error(`Error retrieving credentials for provider ${providerId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Update provider credentials
   */
  async updateProviderCredentials(
    providerId: string,
    credentials: Partial<ProviderCredentials>
  ): Promise<void> {
    try {
      const existingCredentials = await this.getProviderCredentials(providerId);
      if (!existingCredentials) {
        throw new Error('Provider credentials not found');
      }

      const updatedCredentials = { ...existingCredentials, ...credentials };
      await this.storeProviderCredentials(providerId, updatedCredentials);
    } catch (error) {
      this.logger.error(`Error updating credentials for provider ${providerId}: ${error.message}`);
      throw new Error('Failed to update provider credentials');
    }
  }

  /**
   * Delete provider credentials
   */
  async deleteProviderCredentials(providerId: string): Promise<void> {
    try {
      await this.prisma.providerAuthentication.update({
        where: { providerId },
        data: { isActive: false }
      });

      this.logger.log(`Deactivated credentials for provider ${providerId}`);
    } catch (error) {
      this.logger.error(`Error deleting credentials for provider ${providerId}: ${error.message}`);
      throw new Error('Failed to delete provider credentials');
    }
  }

  /**
   * Validate API key format for different providers
   */
  validateApiKeyFormat(providerType: string, apiKey: string): boolean {
    const patterns = {
      OPENAI: /^sk-[a-zA-Z0-9]{48,}$/,
      ANTHROPIC: /^sk-ant-[a-zA-Z0-9-_]{95,}$/,
      GOOGLE: /^[a-zA-Z0-9-_]{39}$/,
      MISTRAL: /^[a-zA-Z0-9]{32}$/,
      GROQ: /^gsk_[a-zA-Z0-9]{52}$/,
      DEEPSEEK: /^sk-[a-zA-Z0-9]{48,}$/,
      HUGGINGFACE: /^hf_[a-zA-Z0-9]{37}$/,
      OPENROUTER: /^sk-or-[a-zA-Z0-9-_]{43,}$/
    };

    const pattern = patterns[providerType as keyof typeof patterns];
    return pattern ? pattern.test(apiKey) : true; // Allow custom providers
  }

  /**
   * Generate secure API key for internal use
   */
  generateSecureApiKey(): string {
    return `sk-${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Hash sensitive data for audit logging
   */
  hashSensitiveData(data: string): string {
    return bcrypt.hashSync(data, 10);
  }

  /**
   * Verify hashed sensitive data
   */
  verifySensitiveData(data: string, hash: string): boolean {
    return bcrypt.compareSync(data, hash);
  }

  /**
   * Rotate encryption key (for key rotation scenarios)
   */
  async rotateEncryptionKey(newKey: string): Promise<void> {
    try {
      // This would be used in a key rotation scenario
      // 1. Decrypt all credentials with old key
      // 2. Re-encrypt with new key
      // 3. Update all records
      
      const allAuthRecords = await this.prisma.providerAuthentication.findMany({
        where: { isActive: true }
      });

      const newEncryptionKey = crypto.scryptSync(newKey, 'salt', 32);
      
      for (const record of allAuthRecords) {
        try {
          // Decrypt with current key
          const credentials = this.decryptCredentials(record.credentials as EncryptedCredentials);
          
          // Re-encrypt with new key
          const iv = crypto.randomBytes(16);
          const cipher = crypto.createCipherGCM(this.algorithm, newEncryptionKey, iv);
          
          const credentialsJson = JSON.stringify(credentials);
          let encrypted = cipher.update(credentialsJson, 'utf8', 'hex');
          encrypted += cipher.final('hex');
          
          const authTag = cipher.getAuthTag();

          const newEncryptedCredentials = {
            encryptedData: encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
          };

          // Update record
          await this.prisma.providerAuthentication.update({
            where: { id: record.id },
            data: { credentials: newEncryptedCredentials }
          });
        } catch (error) {
          this.logger.error(`Failed to rotate key for provider ${record.providerId}: ${error.message}`);
        }
      }

      this.logger.log('Encryption key rotation completed');
    } catch (error) {
      this.logger.error(`Error during key rotation: ${error.message}`);
      throw new Error('Failed to rotate encryption key');
    }
  }

  /**
   * Audit credential access
   */
  async auditCredentialAccess(
    providerId: string,
    action: 'READ' | 'WRITE' | 'DELETE',
    userId: string,
    success: boolean,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // In a production system, this would log to a secure audit system
      const auditLog = {
        timestamp: new Date(),
        providerId,
        action,
        userId,
        success,
        metadata: metadata || {},
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent
      };

      // Store in Redis for immediate access, and optionally in a separate audit database
      await this.prisma.$executeRaw`
        INSERT INTO audit_logs (provider_id, action, user_id, success, metadata, created_at)
        VALUES (${providerId}, ${action}, ${userId}, ${success}, ${JSON.stringify(auditLog)}, NOW())
      `;

      this.logger.log(`Audit log created: ${action} on provider ${providerId} by user ${userId}`);
    } catch (error) {
      this.logger.error(`Error creating audit log: ${error.message}`);
      // Don't throw here as audit failure shouldn't break the main operation
    }
  }

  /**
   * Check if credentials are expired (for OAuth tokens)
   */
  async checkCredentialExpiry(providerId: string): Promise<boolean> {
    try {
      const authRecord = await this.prisma.providerAuthentication.findUnique({
        where: { providerId }
      });

      if (!authRecord || !authRecord.expiresAt) {
        return false; // No expiry set
      }

      return new Date() > authRecord.expiresAt;
    } catch (error) {
      this.logger.error(`Error checking credential expiry for provider ${providerId}: ${error.message}`);
      return true; // Assume expired on error for security
    }
  }

  /**
   * Refresh OAuth tokens
   */
  async refreshOAuthToken(providerId: string): Promise<boolean> {
    try {
      const credentials = await this.getProviderCredentials(providerId);
      if (!credentials?.refreshToken) {
        return false;
      }

      // This would implement OAuth refresh logic specific to each provider
      // For now, return false as it requires provider-specific implementation
      this.logger.warn(`OAuth refresh not implemented for provider ${providerId}`);
      return false;
    } catch (error) {
      this.logger.error(`Error refreshing OAuth token for provider ${providerId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate credential strength
   */
  validateCredentialStrength(credentials: ProviderCredentials): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (credentials.apiKey) {
      if (credentials.apiKey.length < 20) {
        issues.push('API key is too short');
      }
      if (!/[A-Za-z]/.test(credentials.apiKey) || !/[0-9]/.test(credentials.apiKey)) {
        issues.push('API key should contain both letters and numbers');
      }
    }

    if (credentials.clientSecret && credentials.clientSecret.length < 32) {
      issues.push('Client secret is too short');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}