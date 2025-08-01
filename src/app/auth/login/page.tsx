'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Eye, EyeOff, ArrowLeft, Building2, Mail, Lock, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { useAuth } from '@/lib/auth/auth-context';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  twoFactorCode: z.string().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const redirectTo = searchParams.get('redirect') || '/';

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError('');

    try {
      await login({
        email: data.email,
        password: data.password,
        twoFactorCode: data.twoFactorCode,
      });

      router.push(redirectTo);
    } catch (err: any) {
      if (err.message.includes('Two-factor authentication code required')) {
        setRequires2FA(true);
        setError('Please enter your 2FA code');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

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
            Back to Home
          </Link>
          <ThemeSwitcher />
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Left Column - Branding */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    SynapseAI
                  </h1>
                  <p className="text-slate-600 dark:text-slate-400">Enterprise AI Orchestration</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <h2 className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                  Welcome Back
                </h2>
                <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
                  Continue building intelligent workflows with the most advanced AI orchestration platform. 
                  Your agents, tools, and workflows are waiting.
                </p>
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="grid gap-4">
              <div className="flex items-start gap-3 p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg backdrop-blur-sm">
                <div className="h-8 w-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">Secure Authentication</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">2FA, SSO, and enterprise security</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg backdrop-blur-sm">
                <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">99.9% Uptime</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Enterprise-grade reliability</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Login Form */}
          <div className="w-full max-w-md mx-auto">
            <Card className="shadow-2xl border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
              <CardHeader className="space-y-1 pb-6">
                <CardTitle className="text-2xl font-bold text-center">Sign In</CardTitle>
                <CardDescription className="text-center">
                  Access your AI orchestration platform
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@company.com"
                        className="pl-10"
                        {...register('email')}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-red-600">{errors.email.message}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <Link
                        href="/auth/forgot-password"
                        className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        className="pl-10 pr-10"
                        {...register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-red-600">{errors.password.message}</p>
                    )}
                  </div>

                  {/* 2FA Code */}
                  {requires2FA && (
                    <div className="space-y-2">
                      <Label htmlFor="twoFactorCode">Two-Factor Authentication Code</Label>
                      <div className="relative">
                        <Shield className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          id="twoFactorCode"
                          placeholder="000000"
                          maxLength={6}
                          className="pl-10 text-center tracking-widest"
                          {...register('twoFactorCode')}
                        />
                      </div>
                      {errors.twoFactorCode && (
                        <p className="text-sm text-red-600">{errors.twoFactorCode.message}</p>
                      )}
                      <p className="text-xs text-slate-500">
                        Enter the 6-digit code from your authenticator app
                      </p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing In...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>

                <div className="text-center text-sm text-slate-600 dark:text-slate-400">
                  Don't have an account?{' '}
                  <Link
                    href="/auth/register"
                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                  >
                    Create account
                  </Link>
                </div>

                {/* SSO Options */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-slate-900 px-2 text-slate-500">
                      Enterprise SSO Available
                    </span>
                  </div>
                </div>

                <p className="text-xs text-center text-slate-500">
                  Contact your administrator for SSO setup
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}