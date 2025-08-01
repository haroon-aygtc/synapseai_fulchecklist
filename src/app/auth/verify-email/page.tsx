'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  async function handleResendEmail() {
    setIsResending(true);
    setResendSuccess(false);
    
    try {
      // In a real implementation, this would call your resend verification API
      console.log('Resending verification email');
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Show success message
      setResendSuccess(true);
    } catch (error) {
      console.error('Failed to resend verification email:', error);
    } finally {
      setIsResending(false);
    }
  }

  return (
    <Card className="w-full shadow-lg border-0 bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Verify your email</CardTitle>
        <CardDescription>
          We've sent a verification link to your email address
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center space-y-4 py-6">
          <div className="rounded-full bg-primary/10 p-3">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-medium">Check your inbox</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              We've sent a verification email to your inbox. Click the link in the email to verify your account.
            </p>
          </div>
          
          {resendSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-md bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm"
            >
              Verification email resent successfully!
            </motion.div>
          )}
          
          <div className="flex flex-col space-y-2 w-full max-w-xs">
            <Button
              onClick={handleResendEmail}
              variant="outline"
              disabled={isResending}
              className="w-full"
            >
              {isResending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resending...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Resend verification email
                </>
              )}
            </Button>
            
            <Button
              asChild
              className="w-full"
            >
              <Link href="/auth/login">
                Continue to login
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-center">
        <div className="text-center text-sm text-muted-foreground">
          Need help? <Link href="/support" className="font-medium text-primary hover:underline">Contact support</Link>
        </div>
      </CardFooter>
    </Card>
  );
}