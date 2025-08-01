import { SynapseSDK } from './core/sdk';
import { EmbeddableWidget } from './components/widget';
import { WorkflowBuilder } from './components/workflow-builder';
import { FormGenerator } from './components/form-generator';
import { CommandPalette } from './components/command-palette';
import { OnboardingTour } from './components/onboarding-tour';
import { FloatingAssistant } from './components/floating-assistant';

// Core SDK exports
export { SynapseSDK };

// Component exports
export {
  EmbeddableWidget,
  WorkflowBuilder,
  FormGenerator,
  CommandPalette,
  OnboardingTour,
  FloatingAssistant
};

// Type exports
export * from './types';
export * from './hooks';

// Initialize SDK
export const initializeSynapseSDK = (config: {
  apiUrl: string;
  apiKey: string;
  tenantId: string;
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
}) => {
  return new SynapseSDK(config);
};

export default SynapseSDK;