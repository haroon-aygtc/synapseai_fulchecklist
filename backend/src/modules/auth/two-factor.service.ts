import { Injectable } from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

@Injectable()
export class TwoFactorService {
  async generateSecret(email: string, serviceName: string): Promise<{ secret: string; qrCode: string }> {
    const secret = speakeasy.generateSecret({
      name: email,
      issuer: serviceName,
      length: 32,
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode,
    };
  }

  async verifyToken(secret: string, token: string): Promise<boolean> {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps before/after current time
    });
  }

  generateBackupCode(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }
}