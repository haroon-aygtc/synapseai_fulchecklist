import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { 
  Bot, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Github, 
  Chrome,
  ArrowRight,
  Shield,
  Zap,
  Users,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoginFormProps {
  onLogin?: (email: string, password: string) => void;
  onSignUp?: () => void;
  onForgotPassword?: () => void;
}

export default function AuthLogin({ 
  onLogin = () => {}, 
  onSignUp = () => {}, 
  onForgotPassword = () => {} 
}: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      onLogin(email, password);
      setIsLoading(false);
    }, 1000);
  };

  const handleSocialLogin = (provider: string) => {
    console.log(`Login with ${provider}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left Side - Branding & Features */}
        <div className="hidden lg:block space-y-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Bot className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  SynapseAI
                </h1>
                <p className="text-muted-foreground">Enterprise AI Orchestration Platform</p>
              </div>
            </div>
            
            <p className="text-lg text-muted-foreground leading-relaxed">
              Build, deploy, and manage AI agents with real-time orchestration capabilities across multiple providers, tools, and workflows.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
                <Bot className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">AI Agent Management</h3>
                <p className="text-muted-foreground">Create and manage intelligent agents with advanced capabilities and multi-provider support.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg">
                <Zap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Workflow Orchestration</h3>
                <p className="text-muted-foreground">Visual workflow builder with drag-and-drop interface for complex AI orchestrations.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg">
                <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Real-time Analytics</h3>
                <p className="text-muted-foreground">Comprehensive monitoring and analytics with performance insights and cost tracking.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-lg">
                <Users className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Team Collaboration</h3>
                <p className="text-muted-foreground">Multi-tenant architecture with robust RBAC and team management features.</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/5 dark:to-purple-500/5 p-6 rounded-xl border border-blue-200/50 dark:border-blue-800/50">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-blue-900 dark:text-blue-100">Enterprise Ready</span>
            </div>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              SOC2 compliant with enterprise-grade security, SSO integration, and 99.9% uptime SLA.
            </p>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full max-w-md mx-auto">
          <Card className="shadow-2xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardHeader className="space-y-1 text-center pb-8">
              <div className="flex justify-center mb-4 lg:hidden">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Bot className="h-7 w-7 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
              <CardDescription className="text-base">
                Sign in to your SynapseAI account to continue
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Social Login Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => handleSocialLogin('google')}
                  className="h-11"
                >
                  <Chrome className="h-4 w-4 mr-2" />
                  Google
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleSocialLogin('github')}
                  className="h-11"
                >
                  <Github className="h-4 w-4 mr-2" />
                  GitHub
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with email
                  </span>
                </div>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    />
                    <Label htmlFor="remember" className="text-sm font-normal">
                      Remember me
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    className="px-0 font-normal text-sm"
                    onClick={onForgotPassword}
                  >
                    Forgot password?
                  </Button>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span>Sign in</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Button>
              </form>

              <div className="text-center">
                <span className="text-sm text-muted-foreground">
                  Don't have an account?{' '}
                </span>
                <Button
                  type="button"
                  variant="link"
                  className="px-0 font-semibold"
                  onClick={onSignUp}
                >
                  Sign up for free
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Trust Indicators */}
          <div className="mt-8 text-center space-y-4">
            <div className="flex items-center justify-center space-x-6 text-xs text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Shield className="h-3 w-3" />
                <span>SOC2 Compliant</span>
              </div>
              <div className="flex items-center space-x-1">
                <Lock className="h-3 w-3" />
                <span>256-bit SSL</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="h-3 w-3" />
                <span>10k+ Users</span>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              By signing in, you agree to our{' '}
              <Button variant="link" className="px-0 h-auto text-xs">
                Terms of Service
              </Button>{' '}
              and{' '}
              <Button variant="link" className="px-0 h-auto text-xs">
                Privacy Policy
              </Button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}