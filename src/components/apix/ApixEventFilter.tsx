/**
 * APIX Event Filter Component
 * 
 * Advanced event filtering component for creating complex filters based on
 * event types, channels, metadata, and content.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range';
import { 
  APIX_CHANNELS,
  ApixEvent,
  ApixChannel,
  ApixEventType
} from '@/lib/apix/types';
import { 
  Filter, 
  Plus, 
  Minus, 
  Save, 
  Trash2, 
  Download,
  Upload,
  Search,
  X,
  Calendar,
  User,
  Tag
} from 'lucide-react';
import { DateRange } from 'react-day-picker';

interface FilterRule {
  id: string;
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'exists' | 'in' | 'between';
  value: any;
  enabled: boolean;
}

interface FilterGroup {
  id: string;
  name: string;
  description: string;
  rules: FilterRule[];
  logic: 'AND' | 'OR';
  enabled: boolean;
}

interface SavedFilter {
  id: string;
  name: string;
  description: string;
  groups: FilterGroup[];
  createdAt: Date;
  lastUsed?: Date;
}

interface ApixEventFilterProps {
  className?: string;
  events: ApixEvent[];
  onFilteredEvents: (events: ApixEvent[]) => void;
  showPreview?: boolean;
}

const FILTER_FIELDS = [
  { value: 'type', label: 'Event Type', type: 'string' },
  { value: 'channel', label: 'Channel', type: 'select' },
  { value: 'priority', label: 'Priority', type: 'select' },
  { value: 'metadata.userId', label: 'User ID', type: 'string' },
  { value: 'metadata.organizationId', label: 'Organization ID', type: 'string' },
  { value: 'metadata.sessionId', label: 'Session ID', type: 'string' },
  { value: 'metadata.source', label: 'Source', type: 'string' },
  { value: 'metadata.timestamp', label: 'Timestamp', type: 'date' },
  { value: 'data', label: 'Event Data', type: 'json' },
  { value: 'streamId', label: 'Stream ID', type: 'string' },
  { value: 'chunkIndex', label: 'Chunk Index', type: 'number' },
  { value: 'retryCount', label: 'Retry Count', type: 'number' }
];

const OPERATORS = {
  string: ['equals', 'contains', 'startsWith', 'endsWith', 'regex', 'exists'],
  select: ['equals', 'in'],
  number: ['equals', 'between', 'exists'],
  date: ['equals', 'between'],
  json: ['contains', 'exists']
};

export default function ApixEventFilter({ 
  className = '',
  events,
  onFilteredEvents,
  showPreview = true
}: ApixEventFilterProps) {
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [selectedSavedFilter, setSelectedSavedFilter] = useState<string>('');
  const [filterName, setFilterName] = useState('');
  const [filterDescription, setFilterDescription] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [quickFilters, setQuickFilters] = useState({
    channels: [] as ApixChannel[],
    priorities: [] as string[],
    eventTypes: [] as string[]
  });

  // Initialize with a default filter group
  useEffect(() => {
    if (filterGroups.length === 0) {
      addFilterGroup();
    }
  }, []);

  const addFilterGroup = () => {
    const newGroup: FilterGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `Filter Group ${filterGroups.length + 1}`,
      description: '',
      rules: [],
      logic: 'AND',
      enabled: true
    };
    setFilterGroups(prev => [...prev, newGroup]);
  };

  const removeFilterGroup = (groupId: string) => {
    setFilterGroups(prev => prev.filter(group => group.id !== groupId));
  };

  const updateFilterGroup = (groupId: string, updates: Partial<FilterGroup>) => {
    setFilterGroups(prev => prev.map(group => 
      group.id === groupId ? { ...group, ...updates } : group
    ));
  };

  const addFilterRule = (groupId: string) => {
    const newRule: FilterRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      field: 'type',
      operator: 'equals',
      value: '',
      enabled: true
    };

    updateFilterGroup(groupId, {
      rules: [...(filterGroups.find(g => g.id === groupId)?.rules || []), newRule]
    });
  };

  const removeFilterRule = (groupId: string, ruleId: string) => {
    const group = filterGroups.find(g => g.id === groupId);
    if (group) {
      updateFilterGroup(groupId, {
        rules: group.rules.filter(rule => rule.id !== ruleId)
      });
    }
  };

  const updateFilterRule = (groupId: string, ruleId: string, updates: Partial<FilterRule>) => {
    const group = filterGroups.find(g => g.id === groupId);
    if (group) {
      updateFilterGroup(groupId, {
        rules: group.rules.map(rule => 
          rule.id === ruleId ? { ...rule, ...updates } : rule
        )
      });
    }
  };

  const getFieldValue = (event: ApixEvent, field: string): any => {
    const keys = field.split('.');
    let value: any = event;
    
    for (const key of keys) {
      value = value?.[key];
    }
    
    return value;
  };

  const evaluateRule = (event: ApixEvent, rule: FilterRule): boolean => {
    if (!rule.enabled) return true;

    const fieldValue = getFieldValue(event, rule.field);
    const ruleValue = rule.value;

    switch (rule.operator) {
      case 'equals':
        return fieldValue === ruleValue;
      
      case 'contains':
        if (typeof fieldValue === 'string') {
          return fieldValue.toLowerCase().includes(ruleValue.toLowerCase());
        }
        if (typeof fieldValue === 'object') {
          return JSON.stringify(fieldValue).toLowerCase().includes(ruleValue.toLowerCase());
        }
        return false;
      
      case 'startsWith':
        return typeof fieldValue === 'string' && fieldValue.toLowerCase().startsWith(ruleValue.toLowerCase());
      
      case 'endsWith':
        return typeof fieldValue === 'string' && fieldValue.toLowerCase().endsWith(ruleValue.toLowerCase());
      
      case 'regex':
        try {
          const regex = new RegExp(ruleValue, 'i');
          return regex.test(String(fieldValue));
        } catch {
          return false;
        }
      
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      
      case 'in':
        const values = Array.isArray(ruleValue) ? ruleValue : ruleValue.split(',').map((v: string) => v.trim());
        return values.includes(fieldValue);
      
      case 'between':
        if (rule.field === 'metadata.timestamp' && Array.isArray(ruleValue) && ruleValue.length === 2) {
          const timestamp = new Date(fieldValue).getTime();
          const start = new Date(ruleValue[0]).getTime();
          const end = new Date(ruleValue[1]).getTime();
          return timestamp >= start && timestamp <= end;
        }
        if (typeof fieldValue === 'number' && Array.isArray(ruleValue) && ruleValue.length === 2) {
          return fieldValue >= ruleValue[0] && fieldValue <= ruleValue[1];
        }
        return false;
      
      default:
        return true;
    }
  };

  const evaluateGroup = (event: ApixEvent, group: FilterGroup): boolean => {
    if (!group.enabled || group.rules.length === 0) return true;

    const results = group.rules.map(rule => evaluateRule(event, rule));
    
    return group.logic === 'AND' 
      ? results.every(result => result)
      : results.some(result => result);
  };

  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    // Apply date range filter
    if (dateRange?.from && dateRange?.to) {
      filtered = filtered.filter(event => {
        const timestamp = event.metadata.timestamp;
        return timestamp >= dateRange.from! && timestamp <= dateRange.to!;
      });
    }

    // Apply quick filters
    if (quickFilters.channels.length > 0) {
      filtered = filtered.filter(event => quickFilters.channels.includes(event.channel));
    }

    if (quickFilters.priorities.length > 0) {
      filtered = filtered.filter(event => quickFilters.priorities.includes(event.priority));
    }

    if (quickFilters.eventTypes.length > 0) {
      filtered = filtered.filter(event => quickFilters.eventTypes.includes(event.type));
    }

    // Apply filter groups
    if (filterGroups.length > 0) {
      filtered = filtered.filter(event => {
        return filterGroups.every(group => evaluateGroup(event, group));
      });
    }

    return filtered;
  }, [events, filterGroups, dateRange, quickFilters]);

  // Notify parent of filtered events
  useEffect(() => {
    onFilteredEvents(filteredEvents);
  }, [filteredEvents, onFilteredEvents]);

  const saveFilter = () => {
    if (!filterName.trim()) return;

    const savedFilter: SavedFilter = {
      id: `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: filterName.trim(),
      description: filterDescription.trim(),
      groups: [...filterGroups],
      createdAt: new Date()
    };

    setSavedFilters(prev => [...prev, savedFilter]);
    setFilterName('');
    setFilterDescription('');
  };

  const loadSavedFilter = (filterId: string) => {
    const savedFilter = savedFilters.find(f => f.id === filterId);
    if (savedFilter) {
      setFilterGroups([...savedFilter.groups]);
      setSelectedSavedFilter(filterId);
      
      // Update last used timestamp
      setSavedFilters(prev => prev.map(f => 
        f.id === filterId ? { ...f, lastUsed: new Date() } : f
      ));
    }
  };

  const deleteSavedFilter = (filterId: string) => {
    setSavedFilters(prev => prev.filter(f => f.id !== filterId));
    if (selectedSavedFilter === filterId) {
      setSelectedSavedFilter('');
    }
  };

  const exportFilter = (filter: SavedFilter) => {
    const dataStr = JSON.stringify(filter, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `apix-filter-${filter.name.replace(/\s+/g, '-')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importFilter = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const filter = JSON.parse(e.target?.result as string) as SavedFilter;
        
        if (filter.id && filter.name && filter.groups) {
          filter.id = `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          filter.createdAt = new Date();
          
          setSavedFilters(prev => [...prev, filter]);
        }
      } catch (error) {
        console.error('Failed to import filter:', error);
      }
    };
    reader.readAsText(file);
    
    event.target.value = '';
  };

  const clearAllFilters = () => {
    setFilterGroups([]);
    setDateRange(undefined);
    setQuickFilters({ channels: [], priorities: [], eventTypes: [] });
    addFilterGroup();
  };

  const getFieldType = (field: string) => {
    return FILTER_FIELDS.find(f => f.value === field)?.type || 'string';
  };

  const getAvailableOperators = (field: string) => {
    const fieldType = getFieldType(field);
    return OPERATORS[fieldType as keyof typeof OPERATORS] || OPERATORS.string;
  };

  const renderRuleValueInput = (groupId: string, rule: FilterRule) => {
    const fieldType = getFieldType(rule.field);
    
    switch (fieldType) {
      case 'select':
        if (rule.field === 'channel') {
          return (
            <Select 
              value={rule.value} 
              onValueChange={(value) => updateFilterRule(groupId, rule.id, { value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select channel" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(APIX_CHANNELS).map(channel => (
                  <SelectItem key={channel} value={channel}>
                    {channel.split('-').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }
        if (rule.field === 'priority') {
          return (
            <Select 
              value={rule.value} 
              onValueChange={(value) => updateFilterRule(groupId, rule.id, { value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          );
        }
        break;
      
      case 'number':
        return (
          <Input
            type="number"
            value={rule.value}
            onChange={(e) => updateFilterRule(groupId, rule.id, { value: Number(e.target.value) })}
            placeholder="Enter number"
          />
        );
      
      case 'date':
        if (rule.operator === 'between') {
          return (
            <DatePickerWithRange
              date={rule.value}
              onDateChange={(date) => updateFilterRule(groupId, rule.id, { value: date })}
            />
          );
        }
        return (
          <Input
            type="datetime-local"
            value={rule.value}
            onChange={(e) => updateFilterRule(groupId, rule.id, { value: e.target.value })}
          />
        );
      
      default:
        return (
          <Input
            value={rule.value}
            onChange={(e) => updateFilterRule(groupId, rule.id, { value: e.target.value })}
            placeholder="Enter value"
          />
        );
    }
  };

  return (
    <div className={`bg-white ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              APIX Event Filter
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {filteredEvents.length} / {events.length} events
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={clearAllFilters}
              >
                <X className="h-4 w-4" />
                Clear All
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Create complex filters to focus on relevant events in your APIX stream
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="quick" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="quick">Quick Filters</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
              <TabsTrigger value="saved">Saved Filters</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            {/* Quick Filters */}
            <TabsContent value="quick" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Date Range</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DatePickerWithRange
                      date={dateRange}
                      onDateChange={setDateRange}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Channels</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.values(APIX_CHANNELS).map(channel => (
                        <div key={channel} className="flex items-center space-x-2">
                          <Checkbox
                            id={`channel-${channel}`}
                            checked={quickFilters.channels.includes(channel)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setQuickFilters(prev => ({
                                  ...prev,
                                  channels: [...prev.channels, channel]
                                }));
                              } else {
                                setQuickFilters(prev => ({
                                  ...prev,
                                  channels: prev.channels.filter(c => c !== channel)
                                }));
                              }
                            }}
                          />
                          <Label htmlFor={`channel-${channel}`} className="text-sm">
                            {channel.split('-').map(word => 
                              word.charAt(0).toUpperCase() + word.slice(1)
                            ).join(' ')}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Priorities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {['low', 'normal', 'high', 'critical'].map(priority => (
                        <div key={priority} className="flex items-center space-x-2">
                          <Checkbox
                            id={`priority-${priority}`}
                            checked={quickFilters.priorities.includes(priority)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setQuickFilters(prev => ({
                                  ...prev,
                                  priorities: [...prev.priorities, priority]
                                }));
                              } else {
                                setQuickFilters(prev => ({
                                  ...prev,
                                  priorities: prev.priorities.filter(p => p !== priority)
                                }));
                              }
                            }}
                          />
                          <Label htmlFor={`priority-${priority}`} className="text-sm capitalize">
                            {priority}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Advanced Filters */}
            <TabsContent value="advanced" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Filter Groups</h3>
                <Button onClick={addFilterGroup} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Group
                </Button>
              </div>

              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {filterGroups.map((group, groupIndex) => (
                    <Card key={group.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={group.enabled}
                              onCheckedChange={(checked) => 
                                updateFilterGroup(group.id, { enabled: !!checked })
                              }
                            />
                            <Input
                              value={group.name}
                              onChange={(e) => updateFilterGroup(group.id, { name: e.target.value })}
                              className="font-semibold"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              value={group.logic}
                              onValueChange={(value: 'AND' | 'OR') => 
                                updateFilterGroup(group.id, { logic: value })
                              }
                            >
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AND">AND</SelectItem>
                                <SelectItem value="OR">OR</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeFilterGroup(group.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {group.rules.map((rule, ruleIndex) => (
                          <div key={rule.id} className="flex items-center gap-2 p-2 border rounded">
                            <Checkbox
                              checked={rule.enabled}
                              onCheckedChange={(checked) => 
                                updateFilterRule(group.id, rule.id, { enabled: !!checked })
                              }
                            />
                            
                            <Select
                              value={rule.field}
                              onValueChange={(value) => 
                                updateFilterRule(group.id, rule.id, { field: value, value: '' })
                              }
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FILTER_FIELDS.map(field => (
                                  <SelectItem key={field.value} value={field.value}>
                                    {field.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Select
                              value={rule.operator}
                              onValueChange={(value: any) => 
                                updateFilterRule(group.id, rule.id, { operator: value, value: '' })
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {getAvailableOperators(rule.field).map(op => (
                                  <SelectItem key={op} value={op}>
                                    {op}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <div className="flex-1">
                              {renderRuleValueInput(group.id, rule)}
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeFilterRule(group.id, rule.id)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addFilterRule(group.id)}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Rule
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>

              {/* Save Filter */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Save Current Filter</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={filterName}
                      onChange={(e) => setFilterName(e.target.value)}
                      placeholder="Filter name"
                    />
                    <Input
                      value={filterDescription}
                      onChange={(e) => setFilterDescription(e.target.value)}
                      placeholder="Description (optional)"
                    />
                  </div>
                  <Button
                    onClick={saveFilter}
                    disabled={!filterName.trim()}
                    className="w-full"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Filter
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Saved Filters */}
            <TabsContent value="saved" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Saved Filters</h3>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => document.getElementById('import-filter')?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Import
                  </Button>
                  <input
                    id="import-filter"
                    type="file"
                    accept=".json"
                    onChange={importFilter}
                    className="hidden"
                  />
                </div>
              </div>

              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {savedFilters.map((filter) => (
                    <div
                      key={filter.id}
                      className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{filter.name}</div>
                          <div className="text-sm text-gray-600">
                            {filter.groups.length} groups • Created {filter.createdAt.toLocaleDateString()}
                          </div>
                          {filter.description && (
                            <div className="text-xs text-gray-500 mt-1">
                              {filter.description}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => loadSavedFilter(filter.id)}
                          >
                            Load
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => exportFilter(filter)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteSavedFilter(filter.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {savedFilters.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      No saved filters. Create and save a filter to reuse it later.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Preview */}
            <TabsContent value="preview" className="space-y-4">
              {showPreview && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Filtered Events Preview</CardTitle>
                    <CardDescription>
                      Showing {filteredEvents.length} of {events.length} events
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {filteredEvents.slice(0, 50).map((event, index) => (
                          <div
                            key={`${event.id}-${index}`}
                            className="flex items-center justify-between p-2 border rounded text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant={event.priority === 'critical' ? 'destructive' : 'default'}>
                                {event.type}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {event.channel}
                              </span>
                              {event.metadata.userId && (
                                <span className="text-xs text-gray-500">
                                  User: {event.metadata.userId.slice(-8)}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {event.metadata.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                        ))}
                        {filteredEvents.length === 0 && (
                          <div className="text-center text-gray-500 py-8">
                            No events match the current filters
                          </div>
                        )}
                        {filteredEvents.length > 50 && (
                          <div className="text-center text-gray-500 py-2">
                            ... and {filteredEvents.length - 50} more events
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}