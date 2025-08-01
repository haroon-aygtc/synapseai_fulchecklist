'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const twoFactorSchema = z.object({
  code: z.string().min(6, { message: 'Please enter a valid verification code' }).max(6),
});

export default function TwoFactorPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const form = useForm<z.infer<typeof twoFactorSchema>>({
    resolver: zodResolver(twoFactorSchema),
    defaultValues: {
      code: '',
    },
  });

  useEffect(() => {
    startCountdown();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCountdown = () => {
    setCanResend(false);
    setCountdown(30);
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  async function onSubmit(values: z.infer<typeof twoFactorSchema>) {
    setIsLoading(true);
    
    try {
      // In a real implementation, this would call your 2FA verification API
      console.log('2FA code:', values.code);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirect to dashboard on success
      router.push('/');
    } catch (error) {
      console.error('2FA verification failed:', error);
      form.setError('root', { 
        message: 'Invalid verification code. Please try again.' 
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendCode() {
    if (!canResend) return;
    
    try {
      // In a real implementation, this would call your resend 2FA code API
      console.log('Resending 2FA code');
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Restart countdown
      startCountdown();
    } catch (error) {
      console.error('Failed to resend code:', error);
    }
  }

  return (
    <Card className="w-full shadow-lg border-0 bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Two-factor authentication</CardTitle>
        <CardDescription>
          Enter the verification code sent to your device
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex flex-col items-center space-y-2">
                      <Input 
                        placeholder="000000" 
                        className="text-center text-2xl tracking-widest h-14"
                        maxLength={6}
                        disabled={isLoading}
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.formState.errors.root && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-md bg-destructive/15 text-destructive text-sm"
              >
                {form.formState.errors.root.message}
              </motion.div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </Button>
          </form>
        </Form>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Didn't receive a code?{" "}
            <Button 
              variant="link" 
              className="p-0 h-auto font-medium"
              disabled={!canResend}
              onClick={handleResendCode}
            >
              {canResend ? (
                "Resend code"
              ) : (
                `Resend in ${countdown}s`
              )}
            </Button>
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button variant="link" asChild>
          <Link href="/auth/login">
            Use another method
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}