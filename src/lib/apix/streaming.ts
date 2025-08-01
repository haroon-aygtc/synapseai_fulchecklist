import { useCallback, useEffect, useState, useRef } from 'react';
import { useApixClient } from './hooks';
import { ApixEvent, APIX_CHANNELS } from './types';

interface StreamingOptions {
  onChunk?: (chunk: any, index: number, total: number) => void;
  onComplete?: (data: any[]) => void;
  onError?: (error: Error) => void;
  onStart?: () => void;
  abortSignal?: AbortSignal;
  timeout?: number;
  metadata?: Record<string, any>;
}

/**
 * Hook for handling LLM streaming responses through APIX
 */
export function useApixStreamingLLM() {
  const client = useApixClient();
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const activeStreamRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clean up function to handle stream cancellation
  const cancelStream = useCallback(() => {
    if (activeStreamRef.current) {
      client.publish({
        type: 'STREAM_CANCEL',
        channel: APIX_CHANNELS.STREAMING,
        data: { streamId: activeStreamRef.current },
        metadata: { timestamp: new Date() }
      });
      
      activeStreamRef.current = null;
      setIsStreaming(false);
      setProgress(0);
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  }, [client]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancelStream();
    };
  }, [cancelStream]);

  /**
   * Stream text from an LLM provider through APIX
   */
  const streamText = useCallback(async (
    provider: string,
    model: string,
    prompt: string | string[],
    options: StreamingOptions = {}
  ) => {
    if (isStreaming) {
      cancelStream();
    }

    setIsStreaming(true);
    setProgress(0);
    setError(null);

    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    activeStreamRef.current = streamId;
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;
    
    // Set up timeout if specified
    let timeoutId: NodeJS.Timeout | undefined;
    if (options.timeout) {
      timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort('Timeout');
        }
      }, options.timeout);
    }

    try {
      // Subscribe to stream events
      const unsubscribe = client.subscribe((event: ApixEvent) => {
        if (event.streamId !== streamId) return;
        
        if (event.type === 'STREAM_START') {
          options.onStart?.();
        } else if (event.type === 'STREAM_CHUNK') {
          const { data, chunkIndex, totalChunks } = event;
          options.onChunk?.(data, chunkIndex || 0, totalChunks || 0);
          
          if (totalChunks) {
            setProgress(((chunkIndex || 0) + 1) / totalChunks);
          }
        } else if (event.type === 'STREAM_END' || event.type === 'STREAM_COMPLETED') {
          setIsStreaming(false);
          setProgress(1);
          
          if (event.data) {
            options.onComplete?.(Array.isArray(event.data) ? event.data : [event.data]);
          }
          
          unsubscribe();
          activeStreamRef.current = null;
          
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        } else if (event.type === 'STREAM_ERROR') {
          setIsStreaming(false);
          setError(new Error(event.data?.message || 'Stream error'));
          options.onError?.(new Error(event.data?.message || 'Stream error'));
          
          unsubscribe();
          activeStreamRef.current = null;
          
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      }, {
        channel: APIX_CHANNELS.STREAMING,
        filters: { streamId }
      });

      // Set up abort handler
      signal.addEventListener('abort', () => {
        cancelStream();
        unsubscribe();
        
        if (signal.reason === 'Timeout') {
          setError(new Error('Stream timeout'));
          options.onError?.(new Error('Stream timeout'));
        }
        
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      });

      // Initiate streaming request
      client.publish({
        type: 'LLM_STREAM_REQUEST',
        channel: APIX_CHANNELS.STREAMING,
        data: {
          provider,
          model,
          prompt: Array.isArray(prompt) ? prompt : [prompt],
          streamId,
          options: options.metadata || {}
        },
        metadata: {
          timestamp: new Date(),
          streamId
        }
      });

      return {
        streamId,
        cancel: cancelStream
      };
    } catch (err) {
      setIsStreaming(false);
      setError(err instanceof Error ? err : new Error(String(err)));
      options.onError?.(err instanceof Error ? err : new Error(String(err)));
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      return { streamId: null, cancel: () => {} };
    }
  }, [client, isStreaming, cancelStream]);

  return {
    streamText,
    cancelStream,
    isStreaming,
    progress,
    error
  };
}

/**
 * Hook for handling streaming file uploads through APIX
 */
export function useApixStreamingUpload() {
  const client = useApixClient();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const activeUploadRef = useRef<string | null>(null);

  const cancelUpload = useCallback(() => {
    if (activeUploadRef.current) {
      client.publish({
        type: 'UPLOAD_CANCEL',
        channel: APIX_CHANNELS.STREAMING,
        data: { uploadId: activeUploadRef.current },
        metadata: { timestamp: new Date() }
      });
      
      activeUploadRef.current = null;
      setIsUploading(false);
      setProgress(0);
    }
  }, [client]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancelUpload();
    };
  }, [cancelUpload]);

  /**
   * Stream file upload through APIX
   */
  const uploadFile = useCallback(async (
    file: File,
    destination: string,
    options: {
      onProgress?: (progress: number) => void;
      onComplete?: (url: string) => void;
      onError?: (error: Error) => void;
      metadata?: Record<string, any>;
    } = {}
  ) => {
    if (isUploading) {
      cancelUpload();
    }

    setIsUploading(true);
    setProgress(0);
    setError(null);

    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    activeUploadRef.current = uploadId;

    try {
      // Subscribe to upload events
      const unsubscribe = client.subscribe((event: ApixEvent) => {
        if (event.metadata?.uploadId !== uploadId) return;
        
        if (event.type === 'UPLOAD_PROGRESS') {
          const progressValue = event.data?.progress || 0;
          setProgress(progressValue);
          options.onProgress?.(progressValue);
        } else if (event.type === 'UPLOAD_COMPLETE') {
          setIsUploading(false);
          setProgress(1);
          
          if (event.data?.url) {
            options.onComplete?.(event.data.url);
          }
          
          unsubscribe();
          activeUploadRef.current = null;
        } else if (event.type === 'UPLOAD_ERROR') {
          setIsUploading(false);
          setError(new Error(event.data?.message || 'Upload error'));
          options.onError?.(new Error(event.data?.message || 'Upload error'));
          
          unsubscribe();
          activeUploadRef.current = null;
        }
      }, {
        channel: APIX_CHANNELS.STREAMING,
        filters: { uploadId }
      });

      // Create file reader to stream file in chunks
      const reader = new FileReader();
      const chunkSize = 1024 * 1024; // 1MB chunks
      let offset = 0;
      const totalSize = file.size;
      const totalChunks = Math.ceil(totalSize / chunkSize);
      
      const readNextChunk = () => {
        const slice = file.slice(offset, offset + chunkSize);
        reader.readAsArrayBuffer(slice);
      };
      
      reader.onload = (e) => {
        const chunk = e.target?.result;
        if (!chunk) return;
        
        const chunkIndex = Math.floor(offset / chunkSize);
        
        // Send chunk
        client.publish({
          type: 'UPLOAD_CHUNK',
          channel: APIX_CHANNELS.STREAMING,
          data: {
            uploadId,
            chunkIndex,
            totalChunks,
            chunk: Array.from(new Uint8Array(chunk as ArrayBuffer)),
            fileName: file.name,
            fileType: file.type,
            destination,
            isLastChunk: offset + chunkSize >= totalSize
          },
          metadata: {
            timestamp: new Date(),
            uploadId
          }
        });
        
        offset += chunkSize;
        
        if (offset < totalSize) {
          readNextChunk();
        }
      };
      
      reader.onerror = () => {
        setIsUploading(false);
        setError(new Error('File read error'));
        options.onError?.(new Error('File read error'));
        unsubscribe();
      };
      
      // Start reading
      readNextChunk();

      return {
        uploadId,
        cancel: cancelUpload
      };
    } catch (err) {
      setIsUploading(false);
      setError(err instanceof Error ? err : new Error(String(err)));
      options.onError?.(err instanceof Error ? err : new Error(String(err)));
      
      return { uploadId: null, cancel: () => {} };
    }
  }, [client, isUploading, cancelUpload]);

  return {
    uploadFile,
    cancelUpload,
    isUploading,
    progress,
    error
  };
}

/**
 * Hook for handling real-time collaboration through APIX
 */
export function useApixCollaboration(roomId: string) {
  const client = useApixClient();
  const [participants, setParticipants] = useState<string[]>([]);
  const [cursors, setCursors] = useState<Record<string, any>>({});
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Join room on mount
  useEffect(() => {
    let unsubscribe: () => void;
    
    const joinRoom = async () => {
      try {
        await client.joinRoom(roomId);
        setIsJoined(true);
        
        // Subscribe to room events
        unsubscribe = client.subscribe((event: ApixEvent) => {
          if (event.metadata?.roomId !== roomId) return;
          
          if (event.type === 'USER_CONNECTED') {
            setParticipants(prev => [...new Set([...prev, event.metadata.userId!])]);
          } else if (event.type === 'USER_DISCONNECTED') {
            setParticipants(prev => prev.filter(id => id !== event.metadata.userId));
            setCursors(prev => {
              const newCursors = { ...prev };
              delete newCursors[event.metadata.userId!];
              return newCursors;
            });
          } else if (event.type === 'USER_ACTION' && event.data.type === 'cursor_move') {
            setCursors(prev => ({
              ...prev,
              [event.metadata.userId!]: event.data.cursor
            }));
          }
        }, {
          channel: APIX_CHANNELS.USER_EVENTS,
          filters: { roomId }
        });
        
        // Announce presence
        client.publish({
          type: 'USER_CONNECTED',
          channel: APIX_CHANNELS.USER_EVENTS,
          data: {},
          metadata: {
            timestamp: new Date(),
            roomId
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    };
    
    if (client.isConnectedToServer()) {
      joinRoom();
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      
      if (client.isConnectedToServer()) {
        client.leaveRoom(roomId).catch(console.error);
        
        // Announce departure
        client.publish({
          type: 'USER_DISCONNECTED',
          channel: APIX_CHANNELS.USER_EVENTS,
          data: {},
          metadata: {
            timestamp: new Date(),
            roomId
          }
        });
      }
    };
  }, [client, roomId]);

  // Send cursor position
  const updateCursor = useCallback((position: any) => {
    if (!isJoined) return;
    
    client.publish({
      type: 'USER_ACTION',
      channel: APIX_CHANNELS.USER_EVENTS,
      data: {
        type: 'cursor_move',
        cursor: position
      },
      metadata: {
        timestamp: new Date(),
        roomId
      }
    });
  }, [client, roomId, isJoined]);

  // Send user action
  const sendAction = useCallback((action: any) => {
    if (!isJoined) return;
    
    client.publish({
      type: 'USER_ACTION',
      channel: APIX_CHANNELS.USER_EVENTS,
      data: {
        type: 'user_action',
        action
      },
      metadata: {
        timestamp: new Date(),
        roomId
      }
    });
  }, [client, roomId, isJoined]);

  return {
    isJoined,
    participants,
    cursors,
    updateCursor,
    sendAction,
    error
  };
}