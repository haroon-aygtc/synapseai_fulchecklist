import React, { useState, useEffect, useCallback } from 'react';
import Joyride, { 
  CallBackProps, 
  STATUS, 
  EVENTS, 
  ACTIONS,
  Step,
  Styles,
  Locale
} from 'react-joyride';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle,
  Circle,
  ArrowRight,
  Lightbulb,
  Target,
  Zap,
  Star,
  Award
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import { OnboardingStep } from '@/lib/sdk/types';
import { useSynapseSDK } from '@/lib/sdk/hooks';
import { cn } from '@/lib/utils';

interface OnboardingTourProps {
  steps: OnboardingStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  onStepChange?: (stepIndex: number) => void;
  autoStart?: boolean;
  showProgress?: boolean;
  showSkipButton?: boolean;
  continuous?: boolean;
  disableOverlay?: boolean;
  disableScrolling?: boolean;
  locale?: Partial<Locale>;
  styles?: Partial<Styles>;
  className?: string;
  tourKey?: string;
}

const defaultLocale: Locale = {
  back: 'Back',
  close: 'Close',
  last: 'Finish',
  next: 'Next',
  open: 'Open the dialog',
  skip: 'Skip tour'
};

const defaultStyles: Partial<Styles> = {
  options: {
    primaryColor: '#3b82f6',
    width: 350,
    zIndex: 1000,
  },
  tooltip: {
    borderRadius: 12,
    padding: 0,
    backgroundColor: 'white',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    border: '1px solid #e5e7eb'
  },
  tooltipContainer: {
    textAlign: 'left' as const,
  },
  tooltipTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
    padding: '20px 20px 10px 20px'
  },
  tooltipContent: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.5',
    padding: '0 20px 20px 20px'
  },
  tooltipFooter: {
    padding: '15px 20px 20px 20px',
    borderTop: '1px solid #f3f4f6'
  },
  buttonNext: {
    backgroundColor: '#3b82f6',
    borderRadius: '8px',
    border: 'none',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    padding: '8px 16px',
    cursor: 'pointer'
  },
  buttonBack: {
    backgroundColor: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    color: '#6b7280',
    fontSize: '14px',
    fontWeight: '500',
    padding: '8px 16px',
    cursor: 'pointer',
    marginRight: '8px'
  },
  buttonSkip: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#9ca3af',
    fontSize: '14px',
    cursor: 'pointer',
    marginRight: 'auto'
  },
  buttonClose: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#9ca3af',
    fontSize: '18px',
    cursor: 'pointer',
    position: 'absolute' as const,
    right: '10px',
    top: '10px',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(2px)'
  },
  spotlight: {
    borderRadius: '8px'
  }
};

const CustomTooltip: React.FC<{
  continuous: boolean;
  index: number;
  step: Step;
  backProps: any;
  closeProps: any;
  primaryProps: any;
  skipProps: any;
  tooltipProps: any;
  isLastStep: boolean;
  size: number;
  showProgress: boolean;
}> = ({
  continuous,
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
  isLastStep,
  size,
  showProgress
}) => {
  const progress = ((index + 1) / size) * 100;

  return (
    <div {...tooltipProps} className="joyride-tooltip">
      {step.title && (
        <div className="flex items-start justify-between p-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
              <Badge variant="outline" className="mt-1">
                Step {index + 1} of {size}
              </Badge>
            </div>
          </div>
          <button {...closeProps} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {showProgress && (
        <div className="px-5 pb-3">
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {step.content && (
        <div className="px-5 pb-4">
          <p className="text-gray-600 leading-relaxed">{step.content}</p>
        </div>
      )}

      <div className="flex items-center justify-between p-5 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {continuous && !step.hideSkipButton && (
            <button
              {...skipProps}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Skip tour
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {index > 0 && (
            <Button
              {...backProps}
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          )}
          
          <Button
            {...primaryProps}
            size="sm"
            className="flex items-center gap-1"
          >
            {isLastStep ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Finish
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  steps,
  onComplete,
  onSkip,
  onStepChange,
  autoStart = false,
  showProgress = true,
  showSkipButton = true,
  continuous = true,
  disableOverlay = false,
  disableScrolling = false,
  locale = defaultLocale,
  styles = defaultStyles,
  className,
  tourKey = 'default-tour'
}) => {
  const [run, setRun] = useState(autoStart);
  const [stepIndex, setStepIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSkipped, setIsSkipped] = useState(false);
  const { sdk } = useSynapseSDK();

  // Check if tour was already completed
  useEffect(() => {
    const completed = localStorage.getItem(`onboarding-${tourKey}-completed`);
    const skipped = localStorage.getItem(`onboarding-${tourKey}-skipped`);
    
    if (completed === 'true') {
      setIsCompleted(true);
    } else if (skipped === 'true') {
      setIsSkipped(true);
    } else if (autoStart) {
      setRun(true);
    }
  }, [tourKey, autoStart]);

  // Convert steps to Joyride format
  const joyrideSteps: Step[] = steps.map(step => ({
    target: step.target,
    content: step.content,
    title: step.title,
    placement: step.placement,
    disableBeacon: step.disableBeacon,
    hideCloseButton: step.hideCloseButton,
    hideFooter: step.hideFooter,
    showProgress: step.showProgress,
    showSkipButton: step.showSkipButton,
    styles: step.styles
  }));

  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { status, type, index, action } = data;

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
      
      if (onStepChange) {
        onStepChange(index);
      }
    }

    if (status === STATUS.FINISHED) {
      setRun(false);
      setIsCompleted(true);
      localStorage.setItem(`onboarding-${tourKey}-completed`, 'true');
      
      if (onComplete) {
        onComplete();
      }

      // Emit completion event
      if (sdk) {
        sdk.emit('onboarding:completed', {
          tourKey,
          stepsCompleted: steps.length,
          completedAt: new Date().toISOString()
        });
      }
    } else if (status === STATUS.SKIPPED) {
      setRun(false);
      setIsSkipped(true);
      localStorage.setItem(`onboarding-${tourKey}-skipped`, 'true');
      
      if (onSkip) {
        onSkip();
      }

      // Emit skip event
      if (sdk) {
        sdk.emit('onboarding:skipped', {
          tourKey,
          stepIndex,
          skippedAt: new Date().toISOString()
        });
      }
    }
  }, [onComplete, onSkip, onStepChange, tourKey, stepIndex, steps.length, sdk]);

  const startTour = useCallback(() => {
    setRun(true);
    setStepIndex(0);
    setIsCompleted(false);
    setIsSkipped(false);
    localStorage.removeItem(`onboarding-${tourKey}-completed`);
    localStorage.removeItem(`onboarding-${tourKey}-skipped`);
  }, [tourKey]);

  const resetTour = useCallback(() => {
    setRun(false);
    setStepIndex(0);
    setIsCompleted(false);
    setIsSkipped(false);
    localStorage.removeItem(`onboarding-${tourKey}-completed`);
    localStorage.removeItem(`onboarding-${tourKey}-skipped`);
  }, [tourKey]);

  const pauseTour = useCallback(() => {
    setRun(false);
  }, []);

  const resumeTour = useCallback(() => {
    setRun(true);
  }, []);

  if (steps.length === 0) {
    return null;
  }

  return (
    <div className={cn("onboarding-tour", className)}>
      <Joyride
        steps={joyrideSteps}
        run={run}
        stepIndex={stepIndex}
        continuous={continuous}
        showProgress={showProgress}
        showSkipButton={showSkipButton}
        disableOverlay={disableOverlay}
        disableScrolling={disableScrolling}
        locale={{ ...defaultLocale, ...locale }}
        styles={{ ...defaultStyles, ...styles }}
        callback={handleJoyrideCallback}
        tooltipComponent={(props) => (
          <CustomTooltip
            {...props}
            showProgress={showProgress}
          />
        )}
      />

      {/* Tour Control Panel */}
      <AnimatePresence>
        {(isCompleted || isSkipped) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-4 right-4 z-50"
          >
            <Card className="w-80 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    isCompleted ? "bg-green-100" : "bg-orange-100"
                  )}>
                    {isCompleted ? (
                      <Award className="w-4 h-4 text-green-600" />
                    ) : (
                      <Target className="w-4 h-4 text-orange-600" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {isCompleted ? 'Tour Completed!' : 'Tour Skipped'}
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                      {isCompleted 
                        ? 'You\'ve completed the onboarding tour.'
                        : 'You can restart the tour anytime.'
                      }
                    </p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={startTour}
                    className="flex items-center gap-1"
                  >
                    <Play className="w-3 h-3" />
                    Restart Tour
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsCompleted(false);
                      setIsSkipped(false);
                    }}
                    className="flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Tour Controls (for development/testing) */}
      {process.env.NODE_ENV === 'development' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="fixed top-4 right-4 z-50"
        >
          <Card className="w-64 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Tour Controls
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="tour-running" className="text-sm">
                  Running
                </Label>
                <Switch
                  id="tour-running"
                  checked={run}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      resumeTour();
                    } else {
                      pauseTour();
                    }
                  }}
                />
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <div className="text-xs text-gray-500">
                  Step {stepIndex + 1} of {steps.length}
                </div>
                <Progress value={((stepIndex + 1) / steps.length) * 100} className="h-1" />
              </div>
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={startTour}
                  className="flex-1"
                >
                  <Play className="w-3 h-3 mr-1" />
                  Start
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetTour}
                  className="flex-1"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset
                </Button>
              </div>
              
              <div className="text-xs text-gray-400 space-y-1">
                <div>Completed: {isCompleted ? 'Yes' : 'No'}</div>
                <div>Skipped: {isSkipped ? 'Yes' : 'No'}</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default OnboardingTour;