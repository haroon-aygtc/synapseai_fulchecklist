import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import { SynapseSDK } from '../core/sdk';
import { WorkflowBuilder } from './workflow-builder';
import { FormGenerator } from './form-generator';
import { CommandPalette } from './command-palette';
import { OnboardingTour } from './onboarding-tour';
import { FloatingAssistant } from './floating-assistant';

import { SDKConfig, Workflow, Agent, Tool } from '../types';
import { cn } from '@/lib/utils';

interface EmbeddableWidgetProps {
  config: SDKConfig;
  type: 'workflow-builder' | 'form-generator' | 'command-palette' | 'onboarding-tour' | 'floating-assistant' | 'full-suite';
  containerId?: string;
  className?: string;
  style?: React.CSSProperties;
  
  // Workflow Builder Props
  workflowId?: string;
  onWorkflowSave?: (workflow: Workflow) => void;
  onWorkflowExecute?: (execution: any) => void;
  readOnly?: boolean;
  
  // Form Generator Props
  schema?: any;
  fields?: any[];
  onFormSubmit?: (data: any) => void;
  formTitle?: string;
  
  // Command Palette Props
  actions?: any[];
  onActionExecute?: (action: any) => void;
  
  // Onboarding Tour Props
  steps?: any[];
  onTourComplete?: () => void;
  onTourSkip?: () => void;
  autoStartTour?: boolean;
  
  // Floating Assistant Props
  assistantConfig?: any;
  onAssistantMessage?: (message: any) => void;
  
  // Integration Props
  onReady?: (sdk: SynapseSDK) => void;
  onError?: (error: Error) => void;
  onEvent?: (event: any) => void;
}

// Create a separate query client for the widget
const createWidgetQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 2,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 1
    }
  }
});

const WidgetContent: React.FC<EmbeddableWidgetProps & { sdk: SynapseSDK }> = ({
  sdk,
  type,
  className,
  style,
  workflowId,
  onWorkflowSave,
  onWorkflowExecute,
  readOnly,
  schema,
  fields,
  onFormSubmit,
  formTitle,
  actions,
  onActionExecute,
  steps,
  onTourComplete,
  onTourSkip,
  autoStartTour,
  assistantConfig,
  onAssistantMessage,
  onEvent
}) => {
  // Event handling
  useEffect(() => {
    if (!onEvent) return;

    const handleEvent = (event: any) => {
      onEvent(event);
    };

    sdk.on('*', handleEvent);
    
    return () => {
      sdk.off('*', handleEvent);
    };
  }, [sdk, onEvent]);

  const renderWidget = () => {
    switch (type) {
      case 'workflow-builder':
        return (
          <WorkflowBuilder
            workflowId={workflowId}
            onSave={onWorkflowSave}
            onExecute={onWorkflowExecute}
            readOnly={readOnly}
            className={className}
          />
        );

      case 'form-generator':
        if (!schema || !fields || !onFormSubmit) {
          return (
            <div className="p-8 text-center text-gray-500">
              <p>Form Generator requires schema, fields, and onSubmit props</p>
            </div>
          );
        }
        return (
          <FormGenerator
            schema={schema}
            fields={fields}
            onSubmit={onFormSubmit}
            title={formTitle}
            className={className}
          />
        );

      case 'command-palette':
        return (
          <CommandPalette
            actions={actions}
            onActionExecute={onActionExecute}
            className={className}
          />
        );

      case 'onboarding-tour':
        if (!steps) {
          return (
            <div className="p-8 text-center text-gray-500">
              <p>Onboarding Tour requires steps prop</p>
            </div>
          );
        }
        return (
          <OnboardingTour
            steps={steps}
            onComplete={onTourComplete}
            onSkip={onTourSkip}
            autoStart={autoStartTour}
            className={className}
          />
        );

      case 'floating-assistant':
        return (
          <FloatingAssistant
            config={assistantConfig}
            onMessage={onAssistantMessage}
            className={className}
          />
        );

      case 'full-suite':
        return (
          <div className={cn("synapse-full-suite", className)} style={style}>
            {/* Command Palette */}
            <CommandPalette
              actions={actions}
              onActionExecute={onActionExecute}
            />
            
            {/* Floating Assistant */}
            <FloatingAssistant
              config={assistantConfig}
              onMessage={onAssistantMessage}
            />
            
            {/* Onboarding Tour */}
            {steps && (
              <OnboardingTour
                steps={steps}
                onComplete={onTourComplete}
                onSkip={onTourSkip}
                autoStart={autoStartTour}
              />
            )}
            
            {/* Main Content Area */}
            <div className="synapse-main-content">
              {workflowId && (
                <WorkflowBuilder
                  workflowId={workflowId}
                  onSave={onWorkflowSave}
                  onExecute={onWorkflowExecute}
                  readOnly={readOnly}
                />
              )}
              
              {schema && fields && onFormSubmit && (
                <FormGenerator
                  schema={schema}
                  fields={fields}
                  onSubmit={onFormSubmit}
                  title={formTitle}
                />
              )}
            </div>
          </div>
        );

      default:
        return (
          <div className="p-8 text-center text-gray-500">
            <p>Unknown widget type: {type}</p>
          </div>
        );
    }
  };

  return (
    <div className={cn("synapse-widget", className)} style={style}>
      {renderWidget()}
    </div>
  );
};

export const EmbeddableWidget: React.FC<EmbeddableWidgetProps> = (props) => {
  const {
    config,
    containerId,
    onReady,
    onError,
    ...widgetProps
  } = props;

  const [sdk, setSDK] = useState<SynapseSDK | null>(null);
  const [queryClient] = useState(() => createWidgetQueryClient());
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  // Initialize SDK
  useEffect(() => {
    try {
      const sdkInstance = new SynapseSDK(config);
      setSDK(sdkInstance);
      
      // Wait for connection
      const handleConnect = () => {
        setIsReady(true);
        if (onReady) {
          onReady(sdkInstance);
        }
      };

      const handleError = (error: any) => {
        const errorObj = new Error(error.message || 'SDK Error');
        setError(errorObj);
        if (onError) {
          onError(errorObj);
        }
      };

      sdkInstance.on('realtime:connected', handleConnect);
      sdkInstance.on('auth:error', handleError);
      
      // If realtime is disabled, mark as ready immediately
      if (!config.enableRealtime) {
        setIsReady(true);
        if (onReady) {
          onReady(sdkInstance);
        }
      }

      return () => {
        sdkInstance.off('realtime:connected', handleConnect);
        sdkInstance.off('auth:error', handleError);
        sdkInstance.disconnect();
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to initialize SDK');
      setError(error);
      if (onError) {
        onError(error);
      }
    }
  }, [config, onReady, onError]);

  // Find container element
  useEffect(() => {
    if (containerId) {
      const container = document.getElementById(containerId);
      if (container) {
        containerRef.current = container;
      } else {
        console.warn(`Container with id "${containerId}" not found`);
      }
    }
  }, [containerId]);

  // Error state
  if (error) {
    const errorContent = (
      <div className="synapse-widget-error p-8 text-center">
        <div className="text-red-600 mb-4">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="text-lg font-semibold mb-2">Widget Error</h3>
          <p className="text-sm text-gray-600">{error.message}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Reload Page
        </button>
      </div>
    );

    return containerRef.current 
      ? createPortal(errorContent, containerRef.current)
      : errorContent;
  }

  // Loading state
  if (!sdk || !isReady) {
    const loadingContent = (
      <div className="synapse-widget-loading p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Initializing Synapse SDK...</p>
      </div>
    );

    return containerRef.current 
      ? createPortal(loadingContent, containerRef.current)
      : loadingContent;
  }

  // Main widget content
  const widgetContent = (
    <QueryClientProvider client={queryClient}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="synapse-widget-container"
      >
        <WidgetContent sdk={sdk} {...widgetProps} />
      </motion.div>
    </QueryClientProvider>
  );

  // Render in container or return directly
  return containerRef.current 
    ? createPortal(widgetContent, containerRef.current)
    : widgetContent;
};

// Utility function to create and mount widget
export const createSynapseWidget = (
  containerId: string,
  props: EmbeddableWidgetProps
): (() => void) => {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container with id "${containerId}" not found`);
  }

  // Create React root and render widget
  import('react-dom/client').then(({ createRoot }) => {
    const root = createRoot(container);
    root.render(React.createElement(EmbeddableWidget, { ...props, containerId }));
    
    // Return cleanup function
    return () => {
      root.unmount();
    };
  });

  // Fallback cleanup function
  return () => {
    container.innerHTML = '';
  };
};

// Framework-specific integrations
export const integrations = {
  // React integration (already handled by the component above)
  react: EmbeddableWidget,

  // Vue integration
  vue: {
    install(app: any, options: EmbeddableWidgetProps) {
      app.component('SynapseWidget', {
        props: {
          config: { type: Object, required: true },
          type: { type: String, required: true },
          // ... other props
        },
        mounted() {
          this.cleanup = createSynapseWidget(this.$el.id, {
            ...options,
            ...this.$props
          });
        },
        beforeUnmount() {
          if (this.cleanup) {
            this.cleanup();
          }
        },
        template: '<div :id="containerId"></div>'
      });
    }
  },

  // Angular integration
  angular: {
    createDirective() {
      return {
        selector: '[synapseWidget]',
        inputs: ['config', 'type', 'workflowId', 'schema', 'fields'],
        ngOnInit() {
          this.cleanup = createSynapseWidget(this.elementRef.nativeElement.id, {
            config: this.config,
            type: this.type,
            workflowId: this.workflowId,
            schema: this.schema,
            fields: this.fields
          });
        },
        ngOnDestroy() {
          if (this.cleanup) {
            this.cleanup();
          }
        }
      };
    }
  },

  // Vanilla JS integration
  vanilla: {
    mount(containerId: string, props: EmbeddableWidgetProps) {
      return createSynapseWidget(containerId, props);
    }
  }
};

export default EmbeddableWidget;