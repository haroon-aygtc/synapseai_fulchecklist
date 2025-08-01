/**
 * APIX Event Playback Component
 * 
 * Records and replays sequences of APIX events for testing and debugging purposes.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { 
  useApixContext,
  useApixEvents,
  useApixPublish,
  APIX_CHANNELS,
  ApixEvent,
  ApixChannel
} from '@/lib/apix';
import { 
  Play, 
  Pause, 
  Square, 
  SkipBack, 
  SkipForward,
  Download,
  Upload,
  Save,
  Trash2,
  Clock,
  Activity,
  FileText
} from 'lucide-react';

interface EventSequence {
  id: string;
  name: string;
  description: string;
  events: ApixEvent[];
  createdAt: Date;
  duration: number;
}

interface PlaybackState {
  isRecording: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  currentIndex: number;
  playbackSpeed: number;
  startTime?: Date;
}

interface ApixEventPlaybackProps {
  className?: string;
  maxRecordingDuration?: number;
}

export default function ApixEventPlayback({ 
  className = '',
  maxRecordingDuration = 300000 // 5 minutes
}: ApixEventPlaybackProps) {
  const { isConnected, status } = useApixContext();
  const publish = useApixPublish();
  
  const [sequences, setSequences] = useState<EventSequence[]>([]);
  const [selectedSequence, setSelectedSequence] = useState<EventSequence | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isRecording: false,
    isPlaying: false,
    isPaused: false,
    currentIndex: 0,
    playbackSpeed: 1.0
  });
  const [recordingEvents, setRecordingEvents] = useState<ApixEvent[]>([]);
  const [sequenceName, setSequenceName] = useState('');
  const [sequenceDescription, setSequenceDescription] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<ApixChannel | 'all'>('all');
  
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<Date | null>(null);

  // Subscribe to all events for recording
  const allChannelEvents = useApixEvents({
    channel: selectedChannel === 'all' ? undefined : selectedChannel,
    includeHistory: false
  });

  // Record events when recording is active
  useEffect(() => {
    if (playbackState.isRecording && allChannelEvents.length > 0) {
      const latestEvent = allChannelEvents[allChannelEvents.length - 1];
      
      // Check if this is a new event (not already recorded)
      const isNewEvent = !recordingEvents.some(event => event.id === latestEvent.id);
      
      if (isNewEvent) {
        setRecordingEvents(prev => {
          const newEvents = [...prev, latestEvent];
          
          // Check recording duration limit
          if (recordingStartTimeRef.current) {
            const duration = Date.now() - recordingStartTimeRef.current.getTime();
            if (duration > maxRecordingDuration) {
              stopRecording();
              return prev;
            }
          }
          
          return newEvents;
        });
      }
    }
  }, [allChannelEvents, playbackState.isRecording, recordingEvents, maxRecordingDuration]);

  const startRecording = () => {
    setRecordingEvents([]);
    recordingStartTimeRef.current = new Date();
    setPlaybackState(prev => ({
      ...prev,
      isRecording: true,
      isPlaying: false,
      isPaused: false
    }));
  };

  const stopRecording = () => {
    setPlaybackState(prev => ({
      ...prev,
      isRecording: false
    }));
    recordingStartTimeRef.current = null;
  };

  const saveSequence = () => {
    if (recordingEvents.length === 0 || !sequenceName.trim()) return;

    const duration = recordingEvents.length > 0 
      ? recordingEvents[recordingEvents.length - 1].metadata.timestamp.getTime() - 
        recordingEvents[0].metadata.timestamp.getTime()
      : 0;

    const newSequence: EventSequence = {
      id: `seq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: sequenceName.trim(),
      description: sequenceDescription.trim(),
      events: [...recordingEvents],
      createdAt: new Date(),
      duration
    };

    setSequences(prev => [...prev, newSequence]);
    setRecordingEvents([]);
    setSequenceName('');
    setSequenceDescription('');
    stopRecording();
  };

  const deleteSequence = (sequenceId: string) => {
    setSequences(prev => prev.filter(seq => seq.id !== sequenceId));
    if (selectedSequence?.id === sequenceId) {
      setSelectedSequence(null);
    }
  };

  const startPlayback = (sequence: EventSequence) => {
    if (!isConnected || sequence.events.length === 0) return;

    setSelectedSequence(sequence);
    setPlaybackState(prev => ({
      ...prev,
      isPlaying: true,
      isPaused: false,
      currentIndex: 0,
      startTime: new Date()
    }));

    playSequence(sequence, 0);
  };

  const playSequence = (sequence: EventSequence, startIndex: number) => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
    }

    let currentIndex = startIndex;
    const events = sequence.events;
    
    if (currentIndex >= events.length) {
      stopPlayback();
      return;
    }

    const playNextEvent = () => {
      if (currentIndex >= events.length || playbackState.isPaused) {
        stopPlayback();
        return;
      }

      const event = events[currentIndex];
      
      // Publish the event (replay it)
      try {
        publish({
          ...event,
          id: `replay_${event.id}_${Date.now()}`,
          metadata: {
            ...event.metadata,
            timestamp: new Date(),
            source: 'event-playback',
            originalEventId: event.id
          }
        });
      } catch (error) {
        console.error('Failed to replay event:', error);
      }

      setPlaybackState(prev => ({
        ...prev,
        currentIndex: currentIndex + 1
      }));

      currentIndex++;

      // Calculate delay to next event based on original timing and playback speed
      let delay = 1000; // Default 1 second
      if (currentIndex < events.length) {
        const currentEventTime = event.metadata.timestamp.getTime();
        const nextEventTime = events[currentIndex].metadata.timestamp.getTime();
        const originalDelay = nextEventTime - currentEventTime;
        delay = Math.max(100, originalDelay / playbackState.playbackSpeed);
      }

      playbackIntervalRef.current = setTimeout(playNextEvent, delay);
    };

    playNextEvent();
  };

  const pausePlayback = () => {
    setPlaybackState(prev => ({
      ...prev,
      isPaused: true
    }));
    if (playbackIntervalRef.current) {
      clearTimeout(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
  };

  const resumePlayback = () => {
    if (!selectedSequence) return;
    
    setPlaybackState(prev => ({
      ...prev,
      isPaused: false
    }));
    
    playSequence(selectedSequence, playbackState.currentIndex);
  };

  const stopPlayback = () => {
    setPlaybackState(prev => ({
      ...prev,
      isPlaying: false,
      isPaused: false,
      currentIndex: 0
    }));
    
    if (playbackIntervalRef.current) {
      clearTimeout(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
  };

  const skipToEvent = (index: number) => {
    if (!selectedSequence || !playbackState.isPlaying) return;
    
    setPlaybackState(prev => ({
      ...prev,
      currentIndex: index
    }));
    
    if (!playbackState.isPaused) {
      playSequence(selectedSequence, index);
    }
  };

  const exportSequence = (sequence: EventSequence) => {
    const dataStr = JSON.stringify(sequence, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `apix-sequence-${sequence.name.replace(/\s+/g, '-')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importSequence = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const sequence = JSON.parse(e.target?.result as string) as EventSequence;
        
        // Validate sequence structure
        if (sequence.id && sequence.name && sequence.events && Array.isArray(sequence.events)) {
          // Generate new ID to avoid conflicts
          sequence.id = `seq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          sequence.createdAt = new Date();
          
          setSequences(prev => [...prev, sequence]);
        } else {
          console.error('Invalid sequence file format');
        }
      } catch (error) {
        console.error('Failed to import sequence:', error);
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getPlaybackProgress = () => {
    if (!selectedSequence || selectedSequence.events.length === 0) return 0;
    return (playbackState.currentIndex / selectedSequence.events.length) * 100;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) {
        clearTimeout(playbackIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className={`bg-white ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            APIX Event Playback
          </CardTitle>
          <CardDescription>
            Record and replay sequences of APIX events for testing and debugging
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="text-sm font-medium">Status:</span>
            <Badge variant={isConnected ? 'default' : 'destructive'}>
              {status}
            </Badge>
          </div>

          {/* Recording Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recording</CardTitle>
              <CardDescription>
                Record a sequence of events from APIX channels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sequence-name">Sequence Name</Label>
                  <Input
                    id="sequence-name"
                    value={sequenceName}
                    onChange={(e) => setSequenceName(e.target.value)}
                    placeholder="Enter sequence name"
                    disabled={playbackState.isRecording}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="channel-filter">Channel Filter</Label>
                  <Select 
                    value={selectedChannel} 
                    onValueChange={(value: any) => setSelectedChannel(value)}
                    disabled={playbackState.isRecording}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Channels</SelectItem>
                      {Object.values(APIX_CHANNELS).map(channel => (
                        <SelectItem key={channel} value={channel}>
                          {channel.split('-').map(word => 
                            word.charAt(0).toUpperCase() + word.slice(1)
                          ).join(' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sequence-description">Description</Label>
                <Input
                  id="sequence-description"
                  value={sequenceDescription}
                  onChange={(e) => setSequenceDescription(e.target.value)}
                  placeholder="Optional description"
                  disabled={playbackState.isRecording}
                />
              </div>

              <div className="flex items-center gap-2">
                {!playbackState.isRecording ? (
                  <Button
                    onClick={startRecording}
                    disabled={!isConnected}
                    className="flex items-center gap-2"
                  >
                    <Activity className="h-4 w-4" />
                    Start Recording
                  </Button>
                ) : (
                  <Button
                    onClick={stopRecording}
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <Square className="h-4 w-4" />
                    Stop Recording
                  </Button>
                )}
                
                {recordingEvents.length > 0 && !playbackState.isRecording && (
                  <Button
                    onClick={saveSequence}
                    disabled={!sequenceName.trim()}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save Sequence
                  </Button>
                )}
              </div>

              {playbackState.isRecording && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                  Recording... ({recordingEvents.length} events captured)
                </div>
              )}
            </CardContent>
          </Card>

          {/* Playback Controls */}
          {selectedSequence && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Playback: {selectedSequence.name}</CardTitle>
                <CardDescription>
                  {selectedSequence.description || 'No description'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  {!playbackState.isPlaying ? (
                    <Button
                      onClick={() => startPlayback(selectedSequence)}
                      disabled={!isConnected}
                      className="flex items-center gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Play
                    </Button>
                  ) : playbackState.isPaused ? (
                    <Button
                      onClick={resumePlayback}
                      className="flex items-center gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Resume
                    </Button>
                  ) : (
                    <Button
                      onClick={pausePlayback}
                      className="flex items-center gap-2"
                    >
                      <Pause className="h-4 w-4" />
                      Pause
                    </Button>
                  )}
                  
                  <Button
                    onClick={stopPlayback}
                    variant="outline"
                    disabled={!playbackState.isPlaying}
                    className="flex items-center gap-2"
                  >
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                  
                  <Button
                    onClick={() => skipToEvent(Math.max(0, playbackState.currentIndex - 1))}
                    variant="outline"
                    disabled={!playbackState.isPlaying || playbackState.currentIndex === 0}
                  >
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    onClick={() => skipToEvent(Math.min(selectedSequence.events.length - 1, playbackState.currentIndex + 1))}
                    variant="outline"
                    disabled={!playbackState.isPlaying || playbackState.currentIndex >= selectedSequence.events.length - 1}
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progress</span>
                    <span>{playbackState.currentIndex} / {selectedSequence.events.length}</span>
                  </div>
                  <Progress value={getPlaybackProgress()} className="h-2" />
                </div>

                <div className="space-y-2">
                  <Label>Playback Speed: {playbackState.playbackSpeed}x</Label>
                  <Slider
                    value={[playbackState.playbackSpeed]}
                    onValueChange={(value) => setPlaybackState(prev => ({ ...prev, playbackSpeed: value[0] }))}
                    min={0.1}
                    max={5.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Saved Sequences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-lg">Saved Sequences</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => document.getElementById('import-file')?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Import
                  </Button>
                  <input
                    id="import-file"
                    type="file"
                    accept=".json"
                    onChange={importSequence}
                    className="hidden"
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {sequences.map((sequence) => (
                    <div
                      key={sequence.id}
                      className={`p-3 border rounded-lg hover:bg-gray-50 transition-colors ${
                        selectedSequence?.id === sequence.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{sequence.name}</div>
                          <div className="text-sm text-gray-600">
                            {sequence.events.length} events • {formatDuration(sequence.duration)}
                          </div>
                          {sequence.description && (
                            <div className="text-xs text-gray-500 mt-1">
                              {sequence.description}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedSequence(sequence)}
                          >
                            Select
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => exportSequence(sequence)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteSequence(sequence.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {sequences.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      No saved sequences. Record some events to get started.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}