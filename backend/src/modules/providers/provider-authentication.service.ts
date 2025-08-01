import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProviderType } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import axios from 'axios';

export interface ProviderCredentials {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  customHeaders?: Record<string, string>;
  additionalConfig?: Record<string, any>;
  endpoint?: string;
  organizationId?: string;
  projectId?: string;
  region?: string;
}

export interface EncryptedCredentials {
  encryptedData: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

export interface CredentialValidationResult {
  isValid: boolean;
  issues: string[];
  capabilities?: string[];
  models?: string[];
  metadata?: Record<string, any>;
}

export interface KeyRotationResult {
  success: boolean;
  rotatedCount: number;
  failedCount: number;
  errors: string[];
}

@Injectable()
export class ProviderAuthenticationService {
  private readonly logger = new Logger(ProviderAuthenticationService.name);
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyVersion = 1;
  private readonly credentialCache = new Map<string, { credentials: ProviderCredentials; expiry: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const key = this.config.get<string>('ENCRYPTION_KEY');
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    this.encryptionKey = crypto.scryptSync(key, 'salt', 32);
    this.startCredentialCleanupScheduler();
  }

  /**
   * Encrypt provider credentials using AES-256-GCM with versioning
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
        authTag: authTag.toString('hex'),
        keyVersion: this.keyVersion
      };
    } catch (error) {
      this.logger.error(`Error encrypting credentials: ${error.message}`);
      throw new InternalServerErrorException('Failed to encrypt credentials');
    }
  }

  /**
   * Decrypt provider credentials with version support
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
      throw new InternalServerErrorException('Failed to decrypt credentials');
    }
  }

  /**
   * Store encrypted credentials for a provider with audit logging
   */
  async storeProviderCredentials(
    providerId: string,
    credentials: ProviderCredentials,
    authType: string = 'api_key',
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Validate credentials before storing
      const validation = this.validateCredentialStrength(credentials);
      if (!validation.isValid) {
        throw new BadRequestException(`Credential validation failed: ${validation.issues.join(', ')}`);
      }

      const encryptedCredentials = this.encryptCredentials(credentials);
      
      // Calculate expiry for OAuth tokens
      let expiresAt: Date | undefined;
      if (credentials.accessToken && metadata?.expiresIn) {
        expiresAt = new Date(Date.now() + metadata.expiresIn * 1000);
      }

      await this.prisma.providerAuthentication.upsert({
        where: { providerId },
        update: {
          authType,
          credentials: encryptedCredentials,
          expiresAt,
          isActive: true,
          updatedAt: new Date()
        },
        create: {
          providerId,
          authType,
          credentials: encryptedCredentials,
          expiresAt,
          isActive: true
        }
      });

      // Clear cache
      this.credentialCache.delete(providerId);

      // Audit log
      if (userId) {
        await this.auditCredentialAccess(providerId, 'WRITE', userId, true, metadata);
      }

      // Emit event
      this.eventEmitter.emit('provider.credentials.stored', {
        providerId,
        authType,
        userId,
        timestamp: new Date()
      });

      this.logger.log(`Stored credentials for provider ${providerId}`);
    } catch (error) {
      this.logger.error(`Error storing credentials for provider ${providerId}: ${error.message}`);
      
      if (userId) {
        await this.auditCredentialAccess(providerId, 'WRITE', userId, false, { error: error.message });
      }

      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to store provider credentials');
    }
  }

  /**
   * Retrieve and decrypt credentials for a provider with caching
   */
  async getProviderCredentials(providerId: string, userId?: string): Promise<ProviderCredentials | null> {
    try {
      // Check cache first
      const cached = this.credentialCache.get(providerId);
      if (cached && cached.expiry > Date.now()) {
        return cached.credentials;
      }

      const authRecord = await this.prisma.providerAuthentication.findUnique({
        where: { providerId }
      });

      if (!authRecord || !authRecord.isActive) {
        return null;
      }

      // Check if credentials are expired
      if (authRecord.expiresAt && new Date() > authRecord.expiresAt) {
        // Try to refresh if possible
        const refreshed = await this.refreshOAuthToken(providerId);
        if (!refreshed) {
          this.logger.warn(`Credentials expired for provider ${providerId}`);
          return null;
        }
        // Retry after refresh
        return this.getProviderCredentials(providerId, userId);
      }

      const credentials = this.decryptCredentials(authRecord.credentials as EncryptedCredentials);

      // Cache for 5 minutes
      this.credentialCache.set(providerId, {
        credentials,
        expiry: Date.now() + 300000
      });

      // Audit log
      if (userId) {
        await this.auditCredentialAccess(providerId, 'READ', userId, true);
      }

      return credentials;
    } catch (error) {
      this.logger.error(`Error retrieving credentials for provider ${providerId}: ${error.message}`);
      
      if (userId) {
        await this.auditCredentialAccess(providerId, 'READ', userId, false, { error: error.message });
      }

      return null;
    }
  }

  /**
   * Update provider credentials with partial updates
   */
  async updateProviderCredentials(
    providerId: string,
    credentials: Partial<ProviderCredentials>,
    userId?: string
  ): Promise<void> {
    try {
      const existingCredentials = await this.getProviderCredentials(providerId);
      if (!existingCredentials) {
        throw new BadRequestException('Provider credentials not found');
      }

      const updatedCredentials = { ...existingCredentials, ...credentials };
      await this.storeProviderCredentials(providerId, updatedCredentials, undefined, userId);
    } catch (error) {
      this.logger.error(`Error updating credentials for provider ${providerId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete provider credentials with soft delete
   */
  async deleteProviderCredentials(providerId: string, userId?: string): Promise<void> {
    try {
      await this.prisma.providerAuthentication.update({
        where: { providerId },
        data: { 
          isActive: false,
          updatedAt: new Date()
        }
      });

      // Clear cache
      this.credentialCache.delete(providerId);

      // Audit log
      if (userId) {
        await this.auditCredentialAccess(providerId, 'DELETE', userId, true);
      }

      // Emit event
      this.eventEmitter.emit('provider.credentials.deleted', {
        providerId,
        userId,
        timestamp: new Date()
      });

      this.logger.log(`Deactivated credentials for provider ${providerId}`);
    } catch (error) {
      this.logger.error(`Error deleting credentials for provider ${providerId}: ${error.message}`);
      
      if (userId) {
        await this.auditCredentialAccess(providerId, 'DELETE', userId, false, { error: error.message });
      }

      throw new InternalServerErrorException('Failed to delete provider credentials');
    }
  }

  /**
   * Validate API key format for different providers with enhanced patterns
   */
  validateApiKeyFormat(providerType: ProviderType, apiKey: string): boolean {
    const patterns = {
      [ProviderType.OPENAI]: /^sk-[a-zA-Z0-9]{48,}$/,
      [ProviderType.ANTHROPIC]: /^sk-ant-[a-zA-Z0-9-_]{95,}$/,
      [ProviderType.GOOGLE]: /^[a-zA-Z0-9-_]{39}$/,
      [ProviderType.MISTRAL]: /^[a-zA-Z0-9]{32}$/,
      [ProviderType.GROQ]: /^gsk_[a-zA-Z0-9]{52}$/,
      [ProviderType.DEEPSEEK]: /^sk-[a-zA-Z0-9]{48,}$/,
      [ProviderType.HUGGINGFACE]: /^hf_[a-zA-Z0-9]{37}$/,
      [ProviderType.OPENROUTER]: /^sk-or-[a-zA-Z0-9-_]{43,}$/,
      [ProviderType.OLLAMA]: /.*/,  // Local, no specific format
      [ProviderType.LOCALAI]: /.*/,  // Local, no specific format
      [ProviderType.CUSTOM]: /.*/   // Custom, allow any format
    };

    const pattern = patterns[providerType];
    return pattern ? pattern.test(apiKey) : true;
  }

  /**
   * Test provider credentials by making actual API calls
   */
  async testProviderCredentials(
    providerType: ProviderType,
    credentials: ProviderCredentials,
    timeout: number = 10000
  ): Promise<CredentialValidationResult> {
    try {
      const testResult = await this.performProviderTest(providerType, credentials, timeout);
      
      return {
        isValid: true,
        issues: [],
        capabilities: testResult.capabilities,
        models: testResult.models,
        metadata: testResult.metadata
      };
    } catch (error) {
      this.logger.error(`Provider test failed for ${providerType}: ${error.message}`);
      
      return {
        isValid: false,
        issues: [error.message],
        capabilities: [],
        models: []
      };
    }
  }

  /**
   * Perform actual API test for different providers
   */
  private async performProviderTest(
    providerType: ProviderType,
    credentials: ProviderCredentials,
    timeout: number
  ): Promise<{ capabilities: string[]; models: string[]; metadata: Record<string, any> }> {
    const testConfigs = {
      [ProviderType.OPENAI]: {
        url: credentials.endpoint || 'https://api.openai.com/v1/models',
        headers: { 'Authorization': `Bearer ${credentials.apiKey}` }
      },
      [ProviderType.ANTHROPIC]: {
        url: credentials.endpoint || 'https://api.anthropic.com/v1/messages',
        headers: { 
          'x-api-key': credentials.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        method: 'POST',
        data: {
          model: 'claude-3-haiku-20240307',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'test' }]
        }
      },
      [ProviderType.GOOGLE]: {
        url: `${credentials.endpoint || 'https://generativelanguage.googleapis.com/v1beta'}/models`,
        params: { key: credentials.apiKey }
      },
      [ProviderType.MISTRAL]: {
        url: credentials.endpoint || 'https://api.mistral.ai/v1/models',
        headers: { 'Authorization': `Bearer ${credentials.apiKey}` }
      },
      [ProviderType.GROQ]: {
        url: credentials.endpoint || 'https://api.groq.com/openai/v1/models',
        headers: { 'Authorization': `Bearer ${credentials.apiKey}` }
      }
    };

    const config = testConfigs[providerType];
    if (!config) {
      throw new Error(`Test not implemented for provider type: ${providerType}`);
    }

    const response = await axios({
      ...config,
      timeout,
      validateStatus: (status) => status < 500 // Accept 4xx as valid (auth issues)
    });

    if (response.status >= 400) {
      throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
    }

    // Extract capabilities and models from response
    const capabilities = this.extractCapabilities(providerType, response.data);
    const models = this.extractModels(providerType, response.data);

    return {
      capabilities,
      models,
      metadata: {
        responseTime: response.headers['x-response-time'],
        rateLimit: response.headers['x-ratelimit-limit'],
        rateLimitRemaining: response.headers['x-ratelimit-remaining']
      }
    };
  }

  /**
   * Extract capabilities from provider response
   */
  private extractCapabilities(providerType: ProviderType, responseData: any): string[] {
    const defaultCapabilities = {
      [ProviderType.OPENAI]: ['chat', 'completion', 'embedding', 'function_calling', 'vision'],
      [ProviderType.ANTHROPIC]: ['chat', 'completion', 'function_calling'],
      [ProviderType.GOOGLE]: ['chat', 'completion', 'embedding', 'vision'],
      [ProviderType.MISTRAL]: ['chat', 'completion', 'function_calling'],
      [ProviderType.GROQ]: ['chat', 'completion'],
      [ProviderType.DEEPSEEK]: ['chat', 'completion', 'function_calling'],
      [ProviderType.HUGGINGFACE]: ['chat', 'completion', 'embedding'],
      [ProviderType.OPENROUTER]: ['chat', 'completion', 'function_calling'],
      [ProviderType.OLLAMA]: ['chat', 'completion', 'embedding'],
      [ProviderType.LOCALAI]: ['chat', 'completion', 'embedding'],
      [ProviderType.CUSTOM]: ['chat', 'completion']
    };

    return defaultCapabilities[providerType] || ['chat', 'completion'];
  }

  /**
   * Extract models from provider response
   */
  private extractModels(providerType: ProviderType, responseData: any): string[] {
    try {
      if (responseData.data && Array.isArray(responseData.data)) {
        return responseData.data.map((model: any) => model.id || model.name).filter(Boolean);
      }
      if (responseData.models && Array.isArray(responseData.models)) {
        return responseData.models.map((model: any) => model.id || model.name).filter(Boolean);
      }
      return [];
    } catch (error) {
      this.logger.warn(`Failed to extract models for ${providerType}: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate secure API key for internal use
   */
  generateSecureApiKey(prefix: string = 'sk'): string {
    const randomBytes = crypto.randomBytes(32).toString('hex');
    return `${prefix}-${randomBytes}`;
  }

  /**
   * Hash sensitive data for audit logging
   */
  hashSensitiveData(data: string): string {
    return bcrypt.hashSync(data, 12);
  }

  /**
   * Verify hashed sensitive data
   */
  verifySensitiveData(data: string, hash: string): boolean {
    return bcrypt.compareSync(data, hash);
  }

  /**
   * Rotate encryption key with comprehensive error handling
   */
  async rotateEncryptionKey(newKey: string): Promise<KeyRotationResult> {
    const result: KeyRotationResult = {
      success: false,
      rotatedCount: 0,
      failedCount: 0,
      errors: []
    };

    try {
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
            authTag: authTag.toString('hex'),
            keyVersion: this.keyVersion + 1
          };

          // Update record
          await this.prisma.providerAuthentication.update({
            where: { id: record.id },
            data: { credentials: newEncryptedCredentials }
          });

          result.rotatedCount++;
        } catch (error) {
          this.logger.error(`Failed to rotate key for provider ${record.providerId}: ${error.message}`);
          result.failedCount++;
          result.errors.push(`Provider ${record.providerId}: ${error.message}`);
        }
      }

      // Clear credential cache
      this.credentialCache.clear();

      result.success = result.failedCount === 0;
      this.logger.log(`Encryption key rotation completed: ${result.rotatedCount} success, ${result.failedCount} failed`);
      
      return result;
    } catch (error) {
      this.logger.error(`Error during key rotation: ${error.message}`);
      result.errors.push(error.message);
      return result;
    }
  }

  /**
   * Audit credential access with comprehensive logging
   */
  async auditCredentialAccess(
    providerId: string,
    action: 'READ' | 'WRITE' | 'DELETE' | 'TEST',
    userId: string,
    success: boolean,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const auditLog = {
        timestamp: new Date(),
        providerId,
        action,
        userId,
        success,
        metadata: metadata || {},
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        sessionId: metadata?.sessionId
      };

      // Store in Redis for immediate access
      const redisKey = `audit:credentials:${providerId}:${Date.now()}`;
      await this.redis.setex(redisKey, 86400, JSON.stringify(auditLog)); // 24 hours

      // Also store in database for long-term retention
      await this.prisma.$executeRaw`
        INSERT INTO audit_logs (
          entity_type, entity_id, action, user_id, success, 
          metadata, ip_address, user_agent, created_at
        ) VALUES (
          'provider_credentials', ${providerId}, ${action}, ${userId}, ${success},
          ${JSON.stringify(auditLog)}, ${metadata?.ipAddress || null}, 
          ${metadata?.userAgent || null}, NOW()
        )
      `;

      this.logger.log(`Audit log created: ${action} on provider ${providerId} by user ${userId} - ${success ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      this.logger.error(`Error creating audit log: ${error.message}`);
      // Don't throw here as audit failure shouldn't break the main operation
    }
  }

  /**
   * Check if credentials are expired with grace period
   */
  async checkCredentialExpiry(providerId: string): Promise<{
    isExpired: boolean;
    expiresAt?: Date;
    gracePeriodRemaining?: number;
  }> {
    try {
      const authRecord = await this.prisma.providerAuthentication.findUnique({
        where: { providerId }
      });

      if (!authRecord || !authRecord.expiresAt) {
        return { isExpired: false };
      }

      const now = new Date();
      const isExpired = now > authRecord.expiresAt;
      
      // 5-minute grace period
      const gracePeriodEnd = new Date(authRecord.expiresAt.getTime() + 300000);
      const gracePeriodRemaining = Math.max(0, gracePeriodEnd.getTime() - now.getTime());

      return {
        isExpired,
        expiresAt: authRecord.expiresAt,
        gracePeriodRemaining: isExpired ? gracePeriodRemaining : undefined
      };
    } catch (error) {
      this.logger.error(`Error checking credential expiry for provider ${providerId}: ${error.message}`);
      return { isExpired: true }; // Assume expired on error for security
    }
  }

  /**
   * Refresh OAuth tokens with provider-specific logic
   */
  async refreshOAuthToken(providerId: string): Promise<boolean> {
    try {
      const credentials = await this.getProviderCredentials(providerId);
      if (!credentials?.refreshToken) {
        return false;
      }

      const provider = await this.prisma.provider.findUnique({
        where: { id: providerId }
      });

      if (!provider) {
        return false;
      }

      // Provider-specific refresh logic
      const refreshResult = await this.performOAuthRefresh(provider.type, credentials);
      
      if (refreshResult.success) {
        // Update credentials with new tokens
        await this.updateProviderCredentials(providerId, {
          accessToken: refreshResult.accessToken,
          refreshToken: refreshResult.refreshToken || credentials.refreshToken
        });

        this.logger.log(`OAuth token refreshed for provider ${providerId}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error refreshing OAuth token for provider ${providerId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Perform OAuth refresh for specific providers
   */
  private async performOAuthRefresh(
    providerType: ProviderType,
    credentials: ProviderCredentials
  ): Promise<{ success: boolean; accessToken?: string; refreshToken?: string }> {
    // This would implement OAuth refresh logic specific to each provider
    // For now, return false as most AI providers use API keys, not OAuth
    
    switch (providerType) {
      case ProviderType.GOOGLE:
        // Google OAuth refresh implementation would go here
        return { success: false };
      case ProviderType.CUSTOM:
        // Custom OAuth refresh implementation would go here
        return { success: false };
      default:
        return { success: false };
    }
  }

  /**
   * Validate credential strength with comprehensive checks
   */
  validateCredentialStrength(credentials: ProviderCredentials): {
    isValid: boolean;
    issues: string[];
    score: number;
  } {
    const issues: string[] = [];
    let score = 0;

    if (credentials.apiKey) {
      if (credentials.apiKey.length < 20) {
        issues.push('API key is too short (minimum 20 characters)');
      } else {
        score += 25;
      }

      if (!/[A-Za-z]/.test(credentials.apiKey) || !/[0-9]/.test(credentials.apiKey)) {
        issues.push('API key should contain both letters and numbers');
      } else {
        score += 25;
      }

      if (!/[A-Z]/.test(credentials.apiKey) || !/[a-z]/.test(credentials.apiKey)) {
        issues.push('API key should contain both uppercase and lowercase letters');
      } else {
        score += 25;
      }

      if (!/[^A-Za-z0-9]/.test(credentials.apiKey)) {
        // Special characters are good but not required for all providers
        score += 10;
      } else {
        score += 25;
      }
    }

    if (credentials.clientSecret && credentials.clientSecret.length < 32) {
      issues.push('Client secret is too short (minimum 32 characters)');
    }

    // Check for common weak patterns
    const weakPatterns = [
      /^(test|demo|sample|example)/i,
      /^(123|abc|password)/i,
      /(password|secret|key)$/i
    ];

    for (const pattern of weakPatterns) {
      if (credentials.apiKey && pattern.test(credentials.apiKey)) {
        issues.push('API key appears to be a test or weak key');
        score = Math.max(0, score - 50);
        break;
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      score: Math.min(100, score)
    };
  }

  /**
   * Get credential usage statistics
   */
  async getCredentialUsageStats(providerId: string): Promise<{
    lastUsed?: Date;
    usageCount: number;
    errorCount: number;
    successRate: number;
  }> {
    try {
      // Get usage stats from Redis
      const usageKey = `provider:usage:${providerId}`;
      const usageData = await this.redis.hgetall(usageKey);

      return {
        lastUsed: usageData.lastUsed ? new Date(usageData.lastUsed) : undefined,
        usageCount: parseInt(usageData.usageCount || '0'),
        errorCount: parseInt(usageData.errorCount || '0'),
        successRate: usageData.usageCount ? 
          (parseInt(usageData.usageCount) - parseInt(usageData.errorCount || '0')) / parseInt(usageData.usageCount) : 0
      };
    } catch (error) {
      this.logger.error(`Error getting usage stats for provider ${providerId}: ${error.message}`);
      return { usageCount: 0, errorCount: 0, successRate: 0 };
    }
  }

  /**
   * Update credential usage statistics
   */
  async updateCredentialUsageStats(providerId: string, success: boolean): Promise<void> {
    try {
      const usageKey = `provider:usage:${providerId}`;
      const pipeline = this.redis.pipeline();
      
      pipeline.hincrby(usageKey, 'usageCount', 1);
      pipeline.hset(usageKey, 'lastUsed', new Date().toISOString());
      
      if (!success) {
        pipeline.hincrby(usageKey, 'errorCount', 1);
      }
      
      pipeline.expire(usageKey, 86400 * 30); // 30 days
      await pipeline.exec();
    } catch (error) {
      this.logger.error(`Error updating usage stats for provider ${providerId}: ${error.message}`);
    }
  }

  /**
   * Cleanup expired credentials and cache
   */
  private startCredentialCleanupScheduler(): void {
    // Run cleanup every hour
    setInterval(async () => {
      try {
        // Clean expired cache entries
        const now = Date.now();
        for (const [key, value] of this.credentialCache.entries()) {
          if (value.expiry <= now) {
            this.credentialCache.delete(key);
          }
        }

        // Clean expired credentials from database
        await this.prisma.providerAuthentication.updateMany({
          where: {
            expiresAt: { lt: new Date() },
            isActive: true
          },
          data: { isActive: false }
        });

        this.logger.debug('Credential cleanup completed');
      } catch (error) {
        this.logger.error(`Error during credential cleanup: ${error.message}`);
      }
    }, 3600000); // 1 hour
  }

  /**
   * Backup credentials for disaster recovery
   */
  async backupCredentials(organizationId?: string): Promise<{
    success: boolean;
    backupId: string;
    count: number;
  }> {
    try {
      const where = organizationId ? 
        { provider: { organizationId } } : 
        {};

      const credentials = await this.prisma.providerAuthentication.findMany({
        where: { ...where, isActive: true },
        include: { provider: true }
      });

      const backupId = crypto.randomUUID();
      const backupData = {
        id: backupId,
        timestamp: new Date(),
        organizationId,
        credentials: credentials.map(cred => ({
          providerId: cred.providerId,
          providerName: cred.provider.name,
          authType: cred.authType,
          // Don't include actual credentials in backup for security
          hasCredentials: true,
          expiresAt: cred.expiresAt,
          createdAt: cred.createdAt
        }))
      };

      // Store backup metadata in Redis
      const backupKey = `backup:credentials:${backupId}`;
      await this.redis.setex(backupKey, 86400 * 7, JSON.stringify(backupData)); // 7 days

      return {
        success: true,
        backupId,
        count: credentials.length
      };
    } catch (error) {
      this.logger.error(`Error creating credentials backup: ${error.message}`);
      return {
        success: false,
        backupId: '',
        count: 0
      };
    }
  }
}