'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Building2, Shield, Loader2, CheckCircle, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { useAuth } from '@/lib/auth/auth-context';

const twoFactorSchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'Two-factor code must be 6 digits'),
});

type TwoFactorForm = z.infer<typeof twoFactorSchema>;

export default function TwoFactorPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [step, setStep] = useState<'setup' | 'verify' | 'complete'>('setup');
  const router = useRouter();
  const { user, enable2FA, verify2FA } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TwoFactorForm>({
    resolver: zodResolver(twoFactorSchema),
  });

  const handleSetup2FA = async () => {
    const password = prompt('Please enter your password to continue:');
    if (!password) return;

    setIsLoading(true);
    setError('');

    try {
      const result = await enable2FA({ password });
      setQrCode(result.qrCode);
      setBackupCodes(result.backupCodes);
      setStep('verify');
    } catch (err: any) {
      setError(err.message || '2FA setup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: TwoFactorForm) => {
    setIsLoading(true);
    setError('');

    try {
      const result = await verify2FA(data);
      setSuccess(result.message);
      setStep('complete');
      
      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (err: any) {
      setError(err.message || '2FA verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
  };

  const downloadBackupCodes = () => {
    const element = document.createElement('a');
    const file = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'synapseai-backup-codes.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (!user) {
    router.push('/auth/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <ThemeSwitcher />
        </div>

        <div className="max-w-lg mx-auto">
          <Card className="shadow-2xl border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
            <CardHeader className="space-y-1 pb-6 text-center">
              <div className="mx-auto h-12 w-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold">
                {step === 'setup' && 'Enable Two-Factor Authentication'}
                {step === 'verify' && 'Verify Your Setup'}
                {step === 'complete' && '2FA Enabled Successfully'}
              </CardTitle>
              <CardDescription>
                {step === 'setup' && 'Add an extra layer of security to your account'}
                {step === 'verify' && 'Scan the QR code and enter the verification code'}
                {step === 'complete' && 'Your account is now protected with 2FA'}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {success && (
                <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              {step === 'setup' && (
                <div className="space-y-4">
                  <div className="text-center space-y-4">
                    <p className="text-slate-600 dark:text-slate-400">
                      Two-factor authentication adds an extra layer of security to your account by requiring a code from your phone in addition to your password.
                    </p>
                    
                    <Button
                      onClick={handleSetup2FA}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Setting up 2FA...
                        </>
                      ) : (
                        'Enable 2FA'
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {step === 'verify' && (
                <div className="space-y-6">
                  {/* QR Code */}
                  <div className="text-center space-y-4">
                    <h3 className="font-semibold">1. Scan QR Code</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Use your authenticator app (Google Authenticator, Authy, etc.) to scan this QR code:
                    </p>
                    {qrCode && (
                      <div className="flex justify-center">
                        <img src={qrCode} alt="2FA QR Code" className="border rounded-lg" />
                      </div>
                    )}
                  </div>

                  {/* Backup Codes */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">2. Save Backup Codes</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Store these backup codes in a safe place. You can use them to access your account if you lose your phone:
                    </p>
                    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg">
                      <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                        {backupCodes.map((code, index) => (
                          <div key={index} className="text-center py-1">
                            {code}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={copyBackupCodes}
                        className="flex-1"
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Codes
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={downloadBackupCodes}
                        className="flex-1"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </div>
                  </div>

                  {/* Verification */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">3. Enter Verification Code</h3>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="token">6-Digit Code</Label>
                        <div className="relative">
                          <Shield className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                          <Input
                            id="token"
                            placeholder="000000"
                            maxLength={6}
                            className="pl-10 text-center tracking-widest"
                            {...register('token')}
                          />
                        </div>
                        {errors.token && (
                          <p className="text-sm text-red-600">{errors.token.message}</p>
                        )}
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          'Verify & Enable 2FA'
                        )}
                      </Button>
                    </form>
                  </div>
                </div>
              )}

              {step === 'complete' && (
                <div className="text-center space-y-4">
                  <div className="mx-auto h-16 w-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    Two-factor authentication has been successfully enabled for your account. 
                    You'll now need to enter a code from your authenticator app when signing in.
                  </p>
                  <p className="text-sm text-slate-500">
                    Redirecting to dashboard in a few seconds...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}