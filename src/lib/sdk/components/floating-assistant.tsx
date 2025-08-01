import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  MessageCircle, 
  X, 
  Minimize2, 
  Maximize2, 
  Mic, 
  MicOff, 
  Camera, 
  Send,
  Settings,
  Globe,
  Lightbulb,
  Eye,
  EyeOff
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { FloatingAssistantConfig } from '@/lib/sdk/types';
import { useSynapseSDK, useRealtimeEvent } from '@/lib/sdk/hooks';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    suggestions?: string[];
    highlightedElements?: string[];
    context?: Record<string, any>;
  };
}

interface FloatingAssistantProps {
  config?: Partial<FloatingAssistantConfig>;
  onMessage?: (message: Message) => void;
  onSettingsChange?: (config: FloatingAssistantConfig) => void;
  className?: string;
}

const defaultConfig: FloatingAssistantConfig = {
  position: 'bottom-right',
  theme: 'auto',
  languages: ['en', 'ur', 'ar', 'ml'],
  features: {
    domHighlighting: true,
    contextualSuggestions: true,
    voiceInput: true,
    screenCapture: true
  },
  customization: {
    primaryColor: '#3b82f6',
    borderRadius: 12,
    glassmorphism: true
  }
};

export const FloatingAssistant: React.FC<FloatingAssistantProps> = ({
  config: propConfig,
  onMessage,
  onSettingsChange,
  className
}) => {
  const { t, i18n } = useTranslation();
  const { sdk } = useSynapseSDK();
  
  const [config, setConfig] = useState<FloatingAssistantConfig>({
    ...defaultConfig,
    ...propConfig
  });
  
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [highlightedElements, setHighlightedElements] = useState<string[]>([]);
  const [contextualSuggestions, setContextualSuggestions] = useState<string[]>([]);
  const [domHighlighting, setDomHighlighting] = useState(config.features.domHighlighting);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (config.features.voiceInput && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = i18n.language;

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [config.features.voiceInput, i18n.language]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // DOM highlighting
  useEffect(() => {
    if (!domHighlighting) {
      // Remove all highlights
      document.querySelectorAll('.synapse-highlight').forEach(el => {
        el.classList.remove('synapse-highlight');
      });
      return;
    }

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && !target.closest('.floating-assistant')) {
        target.classList.add('synapse-highlight');
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target) {
        target.classList.remove('synapse-highlight');
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const target = e.target as HTMLElement;
        if (target && !target.closest('.floating-assistant')) {
          const elementInfo = getElementInfo(target);
          addContextualSuggestion(`Clicked on ${elementInfo.tagName}: ${elementInfo.text}`);
        }
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('click', handleClick);
    };
  }, [domHighlighting]);

  // Realtime events
  useRealtimeEvent('assistant:message', (event) => {
    const message: Message = {
      id: `msg-${Date.now()}`,
      type: 'assistant',
      content: event.data.content,
      timestamp: new Date(),
      metadata: event.data.metadata
    };
    setMessages(prev => [...prev, message]);
    setIsTyping(false);
    
    if (onMessage) {
      onMessage(message);
    }
  });

  const getElementInfo = (element: HTMLElement) => {
    return {
      tagName: element.tagName.toLowerCase(),
      text: element.textContent?.slice(0, 50) || '',
      id: element.id,
      className: element.className,
      attributes: Array.from(element.attributes).reduce((acc, attr) => {
        acc[attr.name] = attr.value;
        return acc;
      }, {} as Record<string, string>)
    };
  };

  const addContextualSuggestion = (suggestion: string) => {
    setContextualSuggestions(prev => {
      const newSuggestions = [suggestion, ...prev.filter(s => s !== suggestion)].slice(0, 5);
      return newSuggestions;
    });
  };

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !sdk) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      type: 'user',
      content: content.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    if (onMessage) {
      onMessage(userMessage);
    }

    try {
      // Send to SDK for processing
      sdk.emit('assistant:user-message', {
        content: content.trim(),
        context: {
          url: window.location.href,
          timestamp: new Date().toISOString(),
          language: i18n.language,
          highlightedElements,
          suggestions: contextualSuggestions
        }
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsTyping(false);
    }
  }, [sdk, onMessage, i18n.language, highlightedElements, contextualSuggestions]);

  const startVoiceInput = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const captureScreen = async () => {
    if (!config.features.screenCapture) return;

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' }
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      video.addEventListener('loadedmetadata', () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            // Handle screenshot
            addContextualSuggestion('Screenshot captured');
          }
        });
        
        stream.getTracks().forEach(track => track.stop());
      });
    } catch (error) {
      console.error('Failed to capture screen:', error);
    }
  };

  const updateConfig = (updates: Partial<FloatingAssistantConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    
    if (onSettingsChange) {
      onSettingsChange(newConfig);
    }
  };

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  };

  const glassmorphismStyles = config.customization.glassmorphism ? {
    backdropFilter: 'blur(10px)',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.2)'
  } : {};

  return (
    <TooltipProvider>
      <div className={cn("floating-assistant fixed z-50", positionClasses[config.position], className)}>
        <style jsx>{`
          .synapse-highlight {
            outline: 2px solid ${config.customization.primaryColor} !important;
            outline-offset: 2px;
            background-color: ${config.customization.primaryColor}20 !important;
          }
        `}</style>

        <AnimatePresence>
          {!isOpen && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="relative"
            >
              <Button
                onClick={() => setIsOpen(true)}
                className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-shadow"
                style={{ 
                  backgroundColor: config.customization.primaryColor,
                  borderRadius: config.customization.borderRadius 
                }}
              >
                <MessageCircle className="w-6 h-6" />
              </Button>
              
              {contextualSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-16 right-0 w-64"
                >
                  <Card className="shadow-lg" style={glassmorphismStyles}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm font-medium">{t('suggestions')}</span>
                      </div>
                      <div className="space-y-1">
                        {contextualSuggestions.slice(0, 3).map((suggestion, index) => (
                          <div
                            key={index}
                            className="text-xs p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                            onClick={() => {
                              setIsOpen(true);
                              setInputValue(suggestion);
                            }}
                          >
                            {suggestion}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          )}

          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="w-80 h-96 flex flex-col"
            >
              <Card className="h-full shadow-xl" style={glassmorphismStyles}>
                <CardHeader className="p-3 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-5 h-5" style={{ color: config.customization.primaryColor }} />
                      <span className="font-medium">{t('assistant')}</span>
                      {sdk?.isConnected() && (
                        <Badge variant="outline" className="text-xs">
                          {t('connected')}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDomHighlighting(!domHighlighting)}
                          >
                            {domHighlighting ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {domHighlighting ? t('disable_highlighting') : t('enable_highlighting')}
                        </TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowSettings(!showSettings)}
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('settings')}</TooltipContent>
                      </Tooltip>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsMinimized(!isMinimized)}
                      >
                        {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsOpen(false)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {!isMinimized && (
                  <CardContent className="p-0 flex-1 flex flex-col">
                    {showSettings ? (
                      <div className="p-4 space-y-4">
                        <div>
                          <Label>{t('language')}</Label>
                          <Select
                            value={i18n.language}
                            onValueChange={(value) => i18n.changeLanguage(value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="en">English</SelectItem>
                              <SelectItem value="ur">اردو</SelectItem>
                              <SelectItem value="ar">العربية</SelectItem>
                              <SelectItem value="ml">മലയാളം</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label>{t('theme')}</Label>
                          <Select
                            value={config.theme}
                            onValueChange={(value: 'light' | 'dark' | 'auto') => 
                              updateConfig({ theme: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="light">{t('light')}</SelectItem>
                              <SelectItem value="dark">{t('dark')}</SelectItem>
                              <SelectItem value="auto">{t('auto')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <Separator />
                        
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label>{t('voice_input')}</Label>
                            <Switch
                              checked={config.features.voiceInput}
                              onCheckedChange={(checked) =>
                                updateConfig({
                                  features: { ...config.features, voiceInput: checked }
                                })
                              }
                            />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <Label>{t('screen_capture')}</Label>
                            <Switch
                              checked={config.features.screenCapture}
                              onCheckedChange={(checked) =>
                                updateConfig({
                                  features: { ...config.features, screenCapture: checked }
                                })
                              }
                            />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <Label>{t('contextual_suggestions')}</Label>
                            <Switch
                              checked={config.features.contextualSuggestions}
                              onCheckedChange={(checked) =>
                                updateConfig({
                                  features: { ...config.features, contextualSuggestions: checked }
                                })
                              }
                            />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <Label>{t('glassmorphism')}</Label>
                            <Switch
                              checked={config.customization.glassmorphism}
                              onCheckedChange={(checked) =>
                                updateConfig({
                                  customization: { ...config.customization, glassmorphism: checked }
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <ScrollArea className="flex-1 p-4">
                          <div className="space-y-4">
                            {messages.map((message) => (
                              <div
                                key={message.id}
                                className={cn(
                                  "flex",
                                  message.type === 'user' ? 'justify-end' : 'justify-start'
                                )}
                              >
                                <div
                                  className={cn(
                                    "max-w-[80%] p-3 rounded-lg text-sm",
                                    message.type === 'user'
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-gray-100 text-gray-900'
                                  )}
                                  style={message.type === 'user' ? {
                                    backgroundColor: config.customization.primaryColor
                                  } : {}}
                                >
                                  {message.content}
                                  
                                  {message.metadata?.suggestions && (
                                    <div className="mt-2 space-y-1">
                                      {message.metadata.suggestions.map((suggestion, index) => (
                                        <div
                                          key={index}
                                          className="text-xs p-1 bg-white/20 rounded cursor-pointer hover:bg-white/30"
                                          onClick={() => setInputValue(suggestion)}
                                        >
                                          {suggestion}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                            
                            {isTyping && (
                              <div className="flex justify-start">
                                <div className="bg-gray-100 p-3 rounded-lg">
                                  <div className="flex space-x-1">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          <div ref={messagesEndRef} />
                        </ScrollArea>

                        <div className="p-3 border-t">
                          <div className="flex items-center gap-2">
                            <Input
                              ref={inputRef}
                              value={inputValue}
                              onChange={(e) => setInputValue(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  sendMessage(inputValue);
                                }
                              }}
                              placeholder={t('type_message')}
                              className="flex-1"
                            />
                            
                            {config.features.voiceInput && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={isListening ? stopVoiceInput : startVoiceInput}
                                className={isListening ? 'bg-red-50 border-red-200' : ''}
                              >
                                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                              </Button>
                            )}
                            
                            {config.features.screenCapture && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={captureScreen}
                              >
                                <Camera className="w-4 h-4" />
                              </Button>
                            )}
                            
                            <Button
                              size="sm"
                              onClick={() => sendMessage(inputValue)}
                              disabled={!inputValue.trim()}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
};

export default FloatingAssistant;