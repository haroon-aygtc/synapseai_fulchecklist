import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
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
  User,
  Building,
  Check,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RegisterFormProps {
  onRegister?: (data: any) => void;
  onSignIn?: () => void;
}

export default function AuthRegister({ 
  onRegister = () => {}, 
  onSignIn = () => {} 
}: RegisterFormProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const passwordRequirements = [
    { label: 'At least 8 characters', met: formData.password.length >= 8 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(formData.password) },
    { label: 'Contains lowercase letter', met: /[a-z]/.test(formData.password) },
    { label: 'Contains number', met: /\d/.test(formData.password) },
    { label: 'Contains special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password) }
  ];

  const passwordStrength = passwordRequirements.filter(req => req.met).length;
  const passwordsMatch = formData.password === formData.confirmPassword && formData.confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordStrength < 4 || !passwordsMatch || !acceptTerms) return;
    
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      onRegister(formData);
      setIsLoading(false);
    }, 1500);
  };

  const handleSocialSignUp = (provider: string) => {
    console.log(`Sign up with ${provider}`);
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left Side - Branding & Benefits */}
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
              Join thousands of teams building the future with AI. Get started with our comprehensive platform for AI agent orchestration.
            </p>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-semibold">What you'll get:</h3>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-muted-foreground">Free 14-day trial with full access</span>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-muted-foreground">Up to 5 team members included</span>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-muted-foreground">50+ pre-built agent templates</span>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-muted-foreground">Multi-provider AI model support</span>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-muted-foreground">24/7 priority support</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/5 dark:to-purple-500/5 p-6 rounded-xl border border-blue-200/50 dark:border-blue-800/50">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-blue-900 dark:text-blue-100">Trusted by 10,000+ Teams</span>
            </div>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              From startups to Fortune 500 companies, teams trust SynapseAI for their AI orchestration needs.
            </p>
          </div>
        </div>

        {/* Right Side - Registration Form */}
        <div className="w-full max-w-md mx-auto">
          <Card className="shadow-2xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardHeader className="space-y-1 text-center pb-6">
              <div className="flex justify-center mb-4 lg:hidden">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Bot className="h-7 w-7 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">Create your account</CardTitle>
              <CardDescription className="text-base">
                Start your free trial today. No credit card required.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Social Sign Up Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => handleSocialSignUp('google')}
                  className="h-11"
                >
                  <Chrome className="h-4 w-4 mr-2" />
                  Google
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleSocialSignUp('github')}
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

              {/* Registration Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="John"
                        value={formData.firstName}
                        onChange={(e) => updateFormData('firstName', e.target.value)}
                        className="pl-10 h-11"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={(e) => updateFormData('lastName', e.target.value)}
                      className="h-11"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@company.com"
                      value={formData.email}
                      onChange={(e) => updateFormData('email', e.target.value)}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Company name</Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="company"
                      type="text"
                      placeholder="Acme Inc."
                      value={formData.company}
                      onChange={(e) => updateFormData('company', e.target.value)}
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
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={(e) => updateFormData('password', e.target.value)}
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
                  
                  {/* Password Strength Indicator */}
                  {formData.password && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Progress 
                          value={(passwordStrength / 5) * 100} 
                          className="flex-1 h-2"
                        />
                        <span className="text-xs text-muted-foreground">
                          {passwordStrength}/5
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-1 text-xs">
                        {passwordRequirements.map((req, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            {req.met ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <X className="h-3 w-3 text-red-500" />
                            )}
                            <span className={cn(
                              req.met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                            )}>
                              {req.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                      className="pl-10 pr-10 h-11"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {formData.confirmPassword && (
                    <div className="flex items-center space-x-2 text-xs">
                      {passwordsMatch ? (
                        <>
                          <Check className="h-3 w-3 text-green-500" />
                          <span className="text-green-600 dark:text-green-400">Passwords match</span>
                        </>
                      ) : (
                        <>
                          <X className="h-3 w-3 text-red-500" />
                          <span className="text-red-600 dark:text-red-400">Passwords don't match</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="terms"
                      checked={acceptTerms}
                      onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="terms" className="text-sm font-normal leading-5">
                      I agree to the{' '}
                      <Button variant="link" className="px-0 h-auto text-sm">
                        Terms of Service
                      </Button>{' '}
                      and{' '}
                      <Button variant="link" className="px-0 h-auto text-sm">
                        Privacy Policy
                      </Button>
                    </Label>
                  </div>
                  
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="marketing"
                      checked={acceptMarketing}
                      onCheckedChange={(checked) => setAcceptMarketing(checked as boolean)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="marketing" className="text-sm font-normal leading-5">
                      I'd like to receive product updates and marketing communications
                    </Label>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  disabled={isLoading || passwordStrength < 4 || !passwordsMatch || !acceptTerms}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Creating account...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span>Create account</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Button>
              </form>

              <div className="text-center">
                <span className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                </span>
                <Button
                  type="button"
                  variant="link"
                  className="px-0 font-semibold"
                  onClick={onSignIn}
                >
                  Sign in
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}