import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { useApixEvents, useApixPublish } from '@/lib/apix/hooks';
import { APIX_CHANNELS } from '@/lib/apix/types';
import { useAuth } from '@/lib/auth/auth-context';
import {
  User,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Upload,
  RefreshCw,
  Filter,
  Inbox,
  CheckCheck,
  History,
  Hourglass
} from 'lucide-react';

interface HumanInputRequest {
  id: string;
  executionId: string;
  workflowId?: string;
  workflowName?: string;
  prompt: string;
  inputType: 'text' | 'choice' | 'file' | 'approval' | 'form';
  options?: {
    choices?: string[];
    defaultValue?: any;
    timeoutSeconds?: number;
    assignedTo?: string;
    required?: boolean;
    formFields?: Array<{
      name: string;
      label: string;
      type: 'text' | 'number' | 'boolean' | 'select';
      required?: boolean;
      options?: string[];
    }>;
  };
  status: 'pending' | 'completed' | 'timeout' | 'cancelled';
  createdAt: Date;
  expiresAt?: Date;
  response?: any;
  respondedAt?: Date;
  respondedBy?: string;
}

interface HumanInputTasksProps {
  assignedOnly?: boolean;
  workflowId?: string;
  onTaskComplete?: (taskId: string, response: any) => void;
  className?: string;
}

export default function HumanInputTasks({
  assignedOnly = false,
  workflowId,
  onTaskComplete,
  className = ''
}: HumanInputTasksProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const publish = useApixPublish();
  
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [pendingTasks, setPendingTasks] = useState<HumanInputRequest[]>([]);
  const [completedTasks, setCompletedTasks] = useState<HumanInputRequest[]>([]);
  const [selectedTask, setSelectedTask] = useState<HumanInputRequest | null>(null);
  const [textResponse, setTextResponse] = useState<string>('');
  const [choiceResponse, setChoiceResponse] = useState<string>('');
  const [formResponses, setFormResponses] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [filter, setFilter] = useState<string>('all'); // 'all', 'assigned', 'unassigned'
  const [isPolling, setIsPolling] = useState<boolean>(true);

  // Subscribe to human input events
  const humanInputEvents = useApixEvents({
    channel: APIX_CHANNELS.WORKFLOW_EVENTS,
    filters: { type: 'HUMAN_INPUT' },
    includeHistory: true,
    historyLimit: 50
  });

  // Process human input events
  useEffect(() => {
    for (const event of humanInputEvents) {
      if (event.type === 'HUMAN_INPUT_REQUIRED') {
        const request: HumanInputRequest = {
          id: event.data.requestId,
          executionId: event.data.executionId,
          workflowId: event.data.workflowId,
          workflowName: event.data.workflowName,
          prompt: event.data.prompt,
          inputType: event.data.inputType,
          options: event.data.options,
          status: 'pending',
          createdAt: new Date(event.metadata.timestamp),
          expiresAt: event.data.options?.timeoutSeconds 
            ? new Date(new Date(event.metadata.timestamp).getTime() + event.data.options.timeoutSeconds * 1000)
            : undefined
        };
        
        setPendingTasks(prev => {
          // Check if task already exists
          if (prev.some(task => task.id === request.id)) {
            return prev;
          }
          return [...prev, request];
        });
      } else if (event.type === 'HUMAN_INPUT_RECEIVED') {
        setPendingTasks(prev => prev.filter(task => task.id !== event.data.requestId));
        setCompletedTasks(prev => {
          const existingIndex = prev.findIndex(task => task.id === event.data.requestId);
          if (existingIndex >= 0) {
            return prev;
          }
          
          const task = pendingTasks.find(t => t.id === event.data.requestId);
          if (!task) return prev;
          
          return [
            ...prev,
            {
              ...task,
              status: 'completed',
              response: event.data.input,
              respondedAt: new Date(event.metadata.timestamp),
              respondedBy: event.metadata.userId
            }
          ];
        });
        
        // Clear selection if the completed task was selected
        if (selectedTask?.id === event.data.requestId) {
          setSelectedTask(null);
          setTextResponse('');
          setChoiceResponse('');
          setFormResponses({});
        }
      } else if (event.type === 'HUMAN_INPUT_TIMEOUT') {
        setPendingTasks(prev => prev.filter(task => task.id !== event.data.requestId));
        setCompletedTasks(prev => {
          const existingIndex = prev.findIndex(task => task.id === event.data.requestId);
          if (existingIndex >= 0) {
            return prev;
          }
          
          const task = pendingTasks.find(t => t.id === event.data.requestId);
          if (!task) return prev;
          
          return [
            ...prev,
            {
              ...task,
              status: 'timeout',
              respondedAt: new Date(event.metadata.timestamp)
            }
          ];
        });
        
        // Clear selection if the timed out task was selected
        if (selectedTask?.id === event.data.requestId) {
          setSelectedTask(null);
          setTextResponse('');
          setChoiceResponse('');
          setFormResponses({});
        }
      } else if (event.type === 'HUMAN_INPUT_CANCELLED') {
        setPendingTasks(prev => prev.filter(task => task.id !== event.data.requestId));
        setCompletedTasks(prev => {
          const existingIndex = prev.findIndex(task => task.id === event.data.requestId);
          if (existingIndex >= 0) {
            return prev;
          }
          
          const task = pendingTasks.find(t => t.id === event.data.requestId);
          if (!task) return prev;
          
          return [
            ...prev,
            {
              ...task,
              status: 'cancelled',
              respondedAt: new Date(event.metadata.timestamp)
            }
          ];
        });
        
        // Clear selection if the cancelled task was selected
        if (selectedTask?.id === event.data.requestId) {
          setSelectedTask(null);
          setTextResponse('');
          setChoiceResponse('');
          setFormResponses({});
        }
      } else if (event.type === 'HUMAN_INPUT_LIST_RESPONSE') {
        const pendingRequests = event.data.pendingRequests || [];
        const completedRequests = event.data.completedRequests || [];
        
        setPendingTasks(pendingRequests.map((req: any) => ({
          ...req,
          createdAt: new Date(req.createdAt),
          expiresAt: req.expiresAt ? new Date(req.expiresAt) : undefined
        })));
        
        setCompletedTasks(completedRequests.map((req: any) => ({
          ...req,
          createdAt: new Date(req.createdAt),
          respondedAt: req.respondedAt ? new Date(req.respondedAt) : undefined,
          expiresAt: req.expiresAt ? new Date(req.expiresAt) : undefined
        })));
      }
    }
  }, [humanInputEvents, pendingTasks, selectedTask]);

  // Request initial data and set up polling
  useEffect(() => {
    const fetchTasks = () => {
      publish({
        type: 'HUMAN_INPUT_LIST_REQUEST',
        channel: APIX_CHANNELS.WORKFLOW_EVENTS,
        data: {
          workflowId,
          assignedOnly: assignedOnly ? user?.id : undefined
        }
      });
    };
    
    // Initial fetch
    fetchTasks();
    
    // Set up polling
    if (isPolling) {
      const interval = setInterval(fetchTasks, 10000); // Poll every 10 seconds
      return () => clearInterval(interval);
    }
  }, [publish, workflowId, assignedOnly, user?.id, isPolling]);

  // Handle task selection
  const selectTask = (task: HumanInputRequest) => {
    setSelectedTask(task);
    setTextResponse('');
    setChoiceResponse('');
    setFormResponses({});
    
    // Set default values if available
    if (task.options?.defaultValue) {
      if (task.inputType === 'text') {
        setTextResponse(task.options.defaultValue);
      } else if (task.inputType === 'choice' && task.options.choices?.includes(task.options.defaultValue)) {
        setChoiceResponse(task.options.defaultValue);
      } else if (task.inputType === 'form' && task.options.formFields) {
        const defaults: Record<string, any> = {};
        task.options.formFields.forEach(field => {
          if (field.name in task.options!.defaultValue) {
            defaults[field.name] = task.options!.defaultValue[field.name];
          }
        });
        setFormResponses(defaults);
      }
    }
  };

  // Handle form field change
  const handleFormFieldChange = (name: string, value: any) => {
    setFormResponses(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Submit response
  const submitResponse = async () => {
    if (!selectedTask) return;
    
    let response: any;
    
    switch (selectedTask.inputType) {
      case 'text':
        response = textResponse;
        break;
      case 'choice':
        response = choiceResponse;
        break;
      case 'approval':
        response = true; // Approval is always true when submitting
        break;
      case 'form':
        response = formResponses;
        break;
      default:
        toast({
          title: 'Error',
          description: 'Unsupported input type',
          variant: 'destructive'
        });
        return;
    }
    
    setIsSubmitting(true);
    
    try {
      publish({
        type: 'HUMAN_INPUT_RESPONSE',
        channel: APIX_CHANNELS.WORKFLOW_EVENTS,
        data: {
          requestId: selectedTask.id,
          executionId: selectedTask.executionId,
          input: response
        }
      });
      
      // Update local state
      setPendingTasks(prev => prev.filter(task => task.id !== selectedTask.id));
      setCompletedTasks(prev => [
        ...prev,
        {
          ...selectedTask,
          status: 'completed',
          response,
          respondedAt: new Date(),
          respondedBy: user?.id
        }
      ]);
      
      // Clear selection
      setSelectedTask(null);
      setTextResponse('');
      setChoiceResponse('');
      setFormResponses({});
      
      // Notify parent component
      onTaskComplete?.(selectedTask.id, response);
      
      toast({
        title: 'Response submitted',
        description: 'Your response has been submitted successfully.',
      });
    } catch (error) {
      console.error('Failed to submit response:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit response. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reject task (for approval type)
  const rejectTask = async () => {
    if (!selectedTask || selectedTask.inputType !== 'approval') return;
    
    setIsSubmitting(true);
    
    try {
      publish({
        type: 'HUMAN_INPUT_RESPONSE',
        channel: APIX_CHANNELS.WORKFLOW_EVENTS,
        data: {
          requestId: selectedTask.id,
          executionId: selectedTask.executionId,
          input: false
        }
      });
      
      // Update local state
      setPendingTasks(prev => prev.filter(task => task.id !== selectedTask.id));
      setCompletedTasks(prev => [
        ...prev,
        {
          ...selectedTask,
          status: 'completed',
          response: false,
          respondedAt: new Date(),
          respondedBy: user?.id
        }
      ]);
      
      // Clear selection
      setSelectedTask(null);
      
      // Notify parent component
      onTaskComplete?.(selectedTask.id, false);
      
      toast({
        title: 'Request rejected',
        description: 'The request has been rejected.',
      });
    } catch (error) {
      console.error('Failed to reject task:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject the request. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter tasks based on assignment
  const getFilteredTasks = (tasks: HumanInputRequest[]) => {
    if (filter === 'all') return tasks;
    if (filter === 'assigned') return tasks.filter(task => task.options?.assignedTo === user?.id);
    if (filter === 'unassigned') return tasks.filter(task => !task.options?.assignedTo);
    return tasks;
  };

  // Render task status badge
  const renderTaskStatus = (task: HumanInputRequest) => {
    switch (task.status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'timeout':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <Hourglass className="h-3 w-3 mr-1" />
            Timeout
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            Unknown
          </Badge>
        );
    }
  };

  // Render input type badge
  const renderInputType = (type: string) => {
    switch (type) {
      case 'text':
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            <FileText className="h-3 w-3 mr-1" />
            Text
          </Badge>
        );
      case 'choice':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <CheckCheck className="h-3 w-3 mr-1" />
            Choice
          </Badge>
        );
      case 'file':
        return (
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
            <Upload className="h-3 w-3 mr-1" />
            File
          </Badge>
        );
      case 'approval':
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Approval
          </Badge>
        );
      case 'form':
        return (
          <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
            <FileText className="h-3 w-3 mr-1" />
            Form
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {type}
          </Badge>
        );
    }
  };

  // Render task item
  const renderTaskItem = (task: HumanInputRequest) => {
    const isSelected = selectedTask?.id === task.id;
    const isExpired = task.expiresAt && new Date() > task.expiresAt;
    const isAssignedToMe = task.options?.assignedTo === user?.id;
    
    return (
      <div
        key={task.id}
        className={`p-3 border rounded-md mb-2 cursor-pointer transition-colors ${
          isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
        } ${isExpired ? 'opacity-60' : ''}`}
        onClick={() => selectTask(task)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-1 rounded bg-blue-100">
              <User className="h-4 w-4 text-blue-700" />
            </div>
            <div>
              <p className="font-medium line-clamp-1">
                {task.prompt.length > 30 ? `${task.prompt.substring(0, 30)}...` : task.prompt}
              </p>
              <p className="text-xs text-gray-500">
                {task.workflowName || 'Workflow'} • {new Date(task.createdAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            {renderTaskStatus(task)}
            <div className="flex items-center mt-1 space-x-1">
              {renderInputType(task.inputType)}
              {isAssignedToMe && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  You
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        {task.expiresAt && (
          <div className="mt-2 flex items-center text-xs text-gray-500">
            <Clock className="h-3 w-3 mr-1" />
            {isExpired ? 'Expired' : 'Expires'}: {new Date(task.expiresAt).toLocaleString()}
          </div>
        )}
      </div>
    );
  };

  // Render response form based on input type
  const renderResponseForm = () => {
    if (!selectedTask) return null;
    
    switch (selectedTask.inputType) {
      case 'text':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="text-response" className="text-sm font-medium">
                Your Response
              </label>
              <Textarea
                id="text-response"
                placeholder="Type your response here..."
                value={textResponse}
                onChange={(e) => setTextResponse(e.target.value)}
                rows={5}
                className="mt-1"
              />
            </div>
            <Button 
              onClick={submitResponse} 
              disabled={isSubmitting || !textResponse.trim()}
              className="w-full"
            >
              {isSubmitting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Submit Response
            </Button>
          </div>
        );
      
      case 'choice':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                Select an option
              </label>
              <RadioGroup 
                value={choiceResponse} 
                onValueChange={setChoiceResponse}
                className="mt-2 space-y-2"
              >
                {selectedTask.options?.choices?.map((choice, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={choice} id={`choice-${index}`} />
                    <Label htmlFor={`choice-${index}`}>{choice}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <Button 
              onClick={submitResponse} 
              disabled={isSubmitting || !choiceResponse}
              className="w-full"
            >
              {isSubmitting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Submit Selection
            </Button>
          </div>
        );
      
      case 'approval':
        return (
          <div className="space-y-4">
            <div className="flex space-x-2">
              <Button 
                onClick={submitResponse} 
                disabled={isSubmitting}
                className="flex-1"
                variant="default"
              >
                {isSubmitting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Approve
              </Button>
              <Button 
                onClick={rejectTask} 
                disabled={isSubmitting}
                className="flex-1"
                variant="destructive"
              >
                {isSubmitting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Reject
              </Button>
            </div>
          </div>
        );
      
      case 'form':
        return (
          <div className="space-y-4">
            {selectedTask.options?.formFields?.map((field, index) => (
              <div key={index} className="space-y-1">
                <label htmlFor={`form-${field.name}`} className="text-sm font-medium">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                
                {field.type === 'text' && (
                  <Input
                    id={`form-${field.name}`}
                    value={formResponses[field.name] || ''}
                    onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                    required={field.required}
                  />
                )}
                
                {field.type === 'number' && (
                  <Input
                    id={`form-${field.name}`}
                    type="number"
                    value={formResponses[field.name] || ''}
                    onChange={(e) => handleFormFieldChange(field.name, Number(e.target.value))}
                    required={field.required}
                  />
                )}
                
                {field.type === 'boolean' && (
                  <div className="flex items-center space-x-2">
                    <input
                      id={`form-${field.name}`}
                      type="checkbox"
                      checked={formResponses[field.name] || false}
                      onChange={(e) => handleFormFieldChange(field.name, e.target.checked)}
                      required={field.required}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor={`form-${field.name}`} className="text-sm text-gray-700">
                      {field.label}
                    </label>
                  </div>
                )}
                
                {field.type === 'select' && (
                  <select
                    id={`form-${field.name}`}
                    value={formResponses[field.name] || ''}
                    onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                    required={field.required}
                    className="w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select an option</option>
                    {field.options?.map((option, i) => (
                      <option key={i} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
            
            <Button 
              onClick={submitResponse} 
              disabled={isSubmitting || !isFormValid()}
              className="w-full"
            >
              {isSubmitting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Submit Form
            </Button>
          </div>
        );
      
      case 'file':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="file-upload" className="text-sm font-medium">
                Upload File
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer rounded-md font-medium text-primary hover:text-primary/80"
                    >
                      <span>Upload a file</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, PDF up to 10MB
                  </p>
                </div>
              </div>
            </div>
            <Button 
              onClick={submitResponse} 
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Upload File
            </Button>
          </div>
        );
      
      default:
        return (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
            <p className="text-gray-500">Unsupported input type</p>
          </div>
        );
    }
  };

  // Check if form is valid
  const isFormValid = () => {
    if (!selectedTask || selectedTask.inputType !== 'form' || !selectedTask.options?.formFields) {
      return false;
    }
    
    return selectedTask.options.formFields.every(field => {
      if (field.required) {
        const value = formResponses[field.name];
        return value !== undefined && value !== '';
      }
      return true;
    });
  };

  // Render task details
  const renderTaskDetails = () => {
    if (!selectedTask) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <Inbox className="h-12 w-12 text-gray-300 mb-2" />
          <h3 className="text-lg font-medium text-gray-500">Select a task</h3>
          <p className="text-sm text-gray-400 mt-1">
            Select a task from the list to view details and respond
          </p>
        </div>
      );
    }
    
    const isExpired = selectedTask.expiresAt && new Date() > selectedTask.expiresAt;
    const isAssignedToMe = selectedTask.options?.assignedTo === user?.id;
    const isAssignedToOther = selectedTask.options?.assignedTo && selectedTask.options.assignedTo !== user?.id;
    
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-medium">Task Details</h3>
            {renderTaskStatus(selectedTask)}
          </div>
          <div className="flex items-center space-x-2">
            {renderInputType(selectedTask.inputType)}
            {isAssignedToMe && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Assigned to you
              </Badge>
            )}
            {isAssignedToOther && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                Assigned to others
              </Badge>
            )}
          </div>
        </div>
        
        <Card className="mb-4">
          <CardContent className="p-4">
            <h4 className="text-sm font-medium text-gray-500 mb-1">Prompt</h4>
            <p className="whitespace-pre-wrap">{selectedTask.prompt}</p>
          </CardContent>
        </Card>
        
        {selectedTask.workflowName && (
          <div className="mb-4 flex items-center text-sm text-gray-500">
            <Layers className="h-4 w-4 mr-1" />
            Workflow: {selectedTask.workflowName}
          </div>
        )}
        
        {selectedTask.expiresAt && (
          <div className="mb-4 flex items-center text-sm text-gray-500">
            <Clock className="h-4 w-4 mr-1" />
            {isExpired ? 'Expired' : 'Expires'}: {new Date(selectedTask.expiresAt).toLocaleString()}
          </div>
        )}
        
        {selectedTask.status === 'pending' && !isExpired && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Response</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {renderResponseForm()}
            </CardContent>
          </Card>
        )}
        
        {(selectedTask.status !== 'pending' || isExpired) && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {selectedTask.status === 'completed' ? 'Response' : 'Status'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {selectedTask.status === 'completed' && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Response</h4>
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded-md">
                    {typeof selectedTask.response === 'object'
                      ? JSON.stringify(selectedTask.response, null, 2)
                      : String(selectedTask.response)
                    }
                  </pre>
                  
                  {selectedTask.respondedAt && (
                    <div className="mt-2 flex items-center text-xs text-gray-500">
                      <Clock className="h-3 w-3 mr-1" />
                      Responded at: {new Date(selectedTask.respondedAt).toLocaleString()}
                    </div>
                  )}
                  
                  {selectedTask.respondedBy && (
                    <div className="mt-1 flex items-center text-xs text-gray-500">
                      <User className="h-3 w-3 mr-1" />
                      Responded by: {selectedTask.respondedBy === user?.id ? 'You' : selectedTask.respondedBy}
                    </div>
                  )}
                </div>
              )}
              
              {selectedTask.status === 'timeout' && (
                <div className="flex items-center text-yellow-600">
                  <Hourglass className="h-5 w-5 mr-2" />
                  <p>This task has timed out and can no longer be responded to.</p>
                </div>
              )}
              
              {selectedTask.status === 'cancelled' && (
                <div className="flex items-center text-gray-600">
                  <XCircle className="h-5 w-5 mr-2" />
                  <p>This task has been cancelled.</p>
                </div>
              )}
              
              {selectedTask.status === 'pending' && isExpired && (
                <div className="flex items-center text-yellow-600">
                  <Hourglass className="h-5 w-5 mr-2" />
                  <p>This task has expired and can no longer be responded to.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Human Input Tasks</CardTitle>
            <CardDescription>
              Review and respond to workflow tasks requiring human input
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPolling(!isPolling)}
            >
              {isPolling ? (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  Pause
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row h-[600px] gap-4">
          <div className="w-full md:w-1/3 border rounded-md overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b px-3">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="pending">
                    <Inbox className="h-4 w-4 mr-1" />
                    Pending ({pendingTasks.length})
                  </TabsTrigger>
                  <TabsTrigger value="completed">
                    <History className="h-4 w-4 mr-1" />
                    History ({completedTasks.length})
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <div className="border-b p-2 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`text-xs h-7 ${filter === 'all' ? 'bg-gray-200' : ''}`}
                      onClick={() => setFilter('all')}
                    >
                      All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`text-xs h-7 ${filter === 'assigned' ? 'bg-gray-200' : ''}`}
                      onClick={() => setFilter('assigned')}
                    >
                      Assigned to me
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`text-xs h-7 ${filter === 'unassigned' ? 'bg-gray-200' : ''}`}
                      onClick={() => setFilter('unassigned')}
                    >
                      Unassigned
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs h-7">
                    <Filter className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              <TabsContent value="pending" className="m-0 p-0">
                <ScrollArea className="h-[500px]">
                  <div className="p-3">
                    {getFilteredTasks(pendingTasks).length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 text-center">
                        <Inbox className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-gray-500">No pending tasks</p>
                      </div>
                    ) : (
                      getFilteredTasks(pendingTasks).map(task => renderTaskItem(task))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="completed" className="m-0 p-0">
                <ScrollArea className="h-[500px]">
                  <div className="p-3">
                    {getFilteredTasks(completedTasks).length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 text-center">
                        <History className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-gray-500">No task history</p>
                      </div>
                    ) : (
                      getFilteredTasks(completedTasks).map(task => renderTaskItem(task))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
          
          <div className="w-full md:w-2/3 border rounded-md overflow-hidden">
            <ScrollArea className="h-[600px]">
              {renderTaskDetails()}
            </ScrollArea>
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-4">
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-gray-500">
            {isPolling ? (
              <span className="flex items-center">
                <span className="h-2 w-2 rounded-full bg-green-500 mr-1" />
                Auto-refreshing
              </span>
            ) : (
              <span className="flex items-center">
                <span className="h-2 w-2 rounded-full bg-yellow-500 mr-1" />
                Manual refresh
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {pendingTasks.length} pending tasks • {completedTasks.length} completed tasks
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}