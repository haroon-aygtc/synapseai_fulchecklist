'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { useAuth } from '@/lib/auth/auth-context';

export default function VerifyEmailPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyEmail } = useAuth();

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setError('Invalid or missing verification token');
        setIsLoading(false);
        return;
      }

      try {
        const result = await verifyEmail({ token });
        setSuccess(result.message);
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/auth/login');
        }, 3000);
      } catch (err: any) {
        setError(err.message || 'Email verification failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [searchParams, verifyEmail, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/auth/login"
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </Link>
          <ThemeSwitcher />
        </div>

        <div className="max-w-md mx-auto">
          <Card className="shadow-2xl border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
            <CardHeader className="space-y-1 pb-6 text-center">
              <div className="mx-auto h-12 w-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center mb-4">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold">Email Verification</CardTitle>
              <CardDescription>
                {isLoading ? 'Verifying your email address...' : 'Email verification status'}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {isLoading && (
                <div className="text-center py-8">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
                  <p className="mt-4 text-slate-600 dark:text-slate-400">
                    Please wait while we verify your email address...
                  </p>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {success && (
                <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              {!isLoading && (
                <div className="text-center space-y-4">
                  {success && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Redirecting to sign in page in a few seconds...
                    </p>
                  )}
                  
                  <Button
                    onClick={() => router.push('/auth/login')}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    Continue to Sign In
                  </Button>
                </div>
              )}

              {error && (
                <div className="text-center text-sm text-slate-600 dark:text-slate-400">
                  Need help?{' '}
                  <Link
                    href="/auth/register"
                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                  >
                    Create a new account
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}