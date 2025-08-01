import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { SynapseSDK } from './core/sdk';
import { Workflow, Agent, Tool, WorkflowExecution, RealtimeEvent } from './types';

// SDK Hook
export const useSynapseSDK = () => {
  const [sdk, setSDK] = useState<SynapseSDK | null>(null);

  const initialize = useCallback((config: Parameters<typeof SynapseSDK>[0]) => {
    const newSDK = new SynapseSDK(config);
    setSDK(newSDK);
    return newSDK;
  }, []);

  const disconnect = useCallback(() => {
    if (sdk) {
      sdk.disconnect();
      setSDK(null);
    }
  }, [sdk]);

  return { sdk, initialize, disconnect };
};

// Workflow Hooks
export const useWorkflows = (params?: Parameters<SynapseSDK['listWorkflows']>[0]) => {
  const { sdk } = useSynapseSDK();
  
  return useQuery({
    queryKey: ['workflows', params],
    queryFn: () => sdk?.listWorkflows(params),
    enabled: !!sdk,
    staleTime: 30000
  });
};

export const useWorkflow = (id: string) => {
  const { sdk } = useSynapseSDK();
  
  return useQuery({
    queryKey: ['workflow', id],
    queryFn: () => sdk?.getWorkflow(id),
    enabled: !!sdk && !!id,
    staleTime: 30000
  });
};

export const useCreateWorkflow = () => {
  const { sdk } = useSynapseSDK();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workflow: Parameters<SynapseSDK['createWorkflow']>[0]) => 
      sdk!.createWorkflow(workflow),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    }
  });
};

export const useUpdateWorkflow = () => {
  const { sdk } = useSynapseSDK();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<SynapseSDK['updateWorkflow']>[1] }) => 
      sdk!.updateWorkflow(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    }
  });
};

export const useDeleteWorkflow = () => {
  const { sdk } = useSynapseSDK();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => sdk!.deleteWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    }
  });
};

export const useExecuteWorkflow = () => {
  const { sdk } = useSynapseSDK();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Record<string, any> }) => 
      sdk!.executeWorkflow(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions'] });
    }
  });
};

export const useWorkflowExecution = (executionId: string) => {
  const { sdk } = useSynapseSDK();
  
  return useQuery({
    queryKey: ['execution', executionId],
    queryFn: () => sdk?.getWorkflowExecution(executionId),
    enabled: !!sdk && !!executionId,
    refetchInterval: (data) => {
      const status = data?.data?.status;
      return status === 'running' || status === 'pending' ? 2000 : false;
    }
  });
};

// Agent Hooks
export const useAgents = (params?: Parameters<SynapseSDK['listAgents']>[0]) => {
  const { sdk } = useSynapseSDK();
  
  return useQuery({
    queryKey: ['agents', params],
    queryFn: () => sdk?.listAgents(params),
    enabled: !!sdk,
    staleTime: 30000
  });
};

export const useAgent = (id: string) => {
  const { sdk } = useSynapseSDK();
  
  return useQuery({
    queryKey: ['agent', id],
    queryFn: () => sdk?.getAgent(id),
    enabled: !!sdk && !!id,
    staleTime: 30000
  });
};

export const useCreateAgent = () => {
  const { sdk } = useSynapseSDK();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agent: Parameters<SynapseSDK['createAgent']>[0]) => 
      sdk!.createAgent(agent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    }
  });
};

export const useUpdateAgent = () => {
  const { sdk } = useSynapseSDK();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<SynapseSDK['updateAgent']>[1] }) => 
      sdk!.updateAgent(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    }
  });
};

// Tool Hooks
export const useTools = (params?: Parameters<SynapseSDK['listTools']>[0]) => {
  const { sdk } = useSynapseSDK();
  
  return useQuery({
    queryKey: ['tools', params],
    queryFn: () => sdk?.listTools(params),
    enabled: !!sdk,
    staleTime: 30000
  });
};

export const useTool = (id: string) => {
  const { sdk } = useSynapseSDK();
  
  return useQuery({
    queryKey: ['tool', id],
    queryFn: () => sdk?.getTool(id),
    enabled: !!sdk && !!id,
    staleTime: 30000
  });
};

export const useCreateTool = () => {
  const { sdk } = useSynapseSDK();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tool: Parameters<SynapseSDK['createTool']>[0]) => 
      sdk!.createTool(tool),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] });
    }
  });
};

// Realtime Hooks
export const useRealtimeEvent = (eventType: string, handler: (event: RealtimeEvent) => void) => {
  const { sdk } = useSynapseSDK();

  useEffect(() => {
    if (!sdk) return;

    sdk.on(eventType, handler);
    
    return () => {
      sdk.off(eventType, handler);
    };
  }, [sdk, eventType, handler]);
};

export const useRealtimeConnection = () => {
  const { sdk } = useSynapseSDK();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!sdk) return;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    sdk.on('realtime:connected', handleConnect);
    sdk.on('realtime:disconnected', handleDisconnect);

    setIsConnected(sdk.isConnected());

    return () => {
      sdk.off('realtime:connected', handleConnect);
      sdk.off('realtime:disconnected', handleDisconnect);
    };
  }, [sdk]);

  return isConnected;
};

// Form Schema Hook
export const useFormSchema = (type: 'workflow' | 'agent' | 'tool', config: Record<string, any>) => {
  const { sdk } = useSynapseSDK();
  
  return useQuery({
    queryKey: ['schema', type, config],
    queryFn: () => sdk?.generateFormSchema(type, config),
    enabled: !!sdk && !!config,
    staleTime: 300000 // 5 minutes
  });
};

// Analytics Hook
export const useAnalytics = (params: Parameters<SynapseSDK['getAnalytics']>[0]) => {
  const { sdk } = useSynapseSDK();
  
  return useQuery({
    queryKey: ['analytics', params],
    queryFn: () => sdk?.getAnalytics(params),
    enabled: !!sdk,
    staleTime: 60000 // 1 minute
  });
};

// Keyboard Shortcuts Hook
export const useKeyboardShortcuts = (shortcuts: Record<string, () => void>) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = [
        event.ctrlKey && 'ctrl',
        event.metaKey && 'meta',
        event.shiftKey && 'shift',
        event.altKey && 'alt',
        event.key.toLowerCase()
      ].filter(Boolean).join('+');

      const handler = shortcuts[key];
      if (handler) {
        event.preventDefault();
        handler();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

// Undo/Redo Hook
export const useUndoRedo = <T>(initialState: T) => {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const current = history[currentIndex];

  const push = useCallback((newState: T) => {
    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  }, [history, currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, history.length]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return {
    current,
    push,
    undo,
    redo,
    canUndo,
    canRedo,
    history,
    currentIndex
  };
};