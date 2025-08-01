import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Template, 
  Search, 
  Filter, 
  Star, 
  Download, 
  Eye, 
  Copy,
  Plus,
  Save,
  Bookmark,
  BookmarkCheck,
  Grid3X3,
  List,
  Clock,
  Users,
  TrendingUp,
  Award,
  Zap,
  Bot,
  GitBranch,
  Database,
  Globe,
  Code,
  Layers
} from 'lucide-react';
import { workflowService } from '@/lib/services/workflow-service';
import { WorkflowTemplate, Workflow } from '@/lib/workflows/types';
import { cn } from '@/lib/utils';

interface WorkflowTemplatesProps {
  onCreateFromTemplate?: (template: WorkflowTemplate, customizations: any) => void;
  onSaveAsTemplate?: (workflow: Workflow) => void;
  currentWorkflow?: Workflow;
  className?: string;
}

interface TemplateFilters {
  category: string;
  complexity: string;
  tags: string[];
  search: string;
  sortBy: 'popular' | 'recent' | 'rating' | 'name';
}

const templateCategories = [
  { value: '', label: 'All Categories' },
  { value: 'automation', label: 'Automation' },
  { value: 'data-processing', label: 'Data Processing' },
  { value: 'ai-workflows', label: 'AI Workflows' },
  { value: 'integration', label: 'Integration' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'customer-service', label: 'Customer Service' },
  { value: 'content-generation', label: 'Content Generation' },
  { value: 'analytics', label: 'Analytics' }
];

const complexityLevels = [
  { value: '', label: 'All Levels' },
  { value: 'SIMPLE', label: 'Simple' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'COMPLEX', label: 'Complex' }
];

export default function WorkflowTemplates({ 
  onCreateFromTemplate, 
  onSaveAsTemplate,
  currentWorkflow,
  className = '' 
}: WorkflowTemplatesProps) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<WorkflowTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<TemplateFilters>({
    category: '',
    complexity: '',
    tags: [],
    search: '',
    sortBy: 'popular'
  });
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [bookmarkedTemplates, setBookmarkedTemplates] = useState<Set<string>>(new Set());
  const [saveTemplateData, setSaveTemplateData] = useState({
    name: '',
    description: '',
    category: '',
    tags: '',
    complexity: 'SIMPLE' as const
  });

  useEffect(() => {
    loadTemplates();
    loadBookmarks();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [templates, filters]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await workflowService.getWorkflowTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBookmarks = () => {
    const saved = localStorage.getItem('workflow_template_bookmarks');
    if (saved) {
      setBookmarkedTemplates(new Set(JSON.parse(saved)));
    }
  };

  const saveBookmarks = (bookmarks: Set<string>) => {
    localStorage.setItem('workflow_template_bookmarks', JSON.stringify([...bookmarks]));
  };

  const applyFilters = () => {
    let filtered = [...templates];

    // Apply category filter
    if (filters.category) {
      filtered = filtered.filter(template => template.category === filters.category);
    }

    // Apply complexity filter
    if (filters.complexity) {
      filtered = filtered.filter(template => template.complexity === filters.complexity);
    }

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchTerm) ||
        template.description.toLowerCase().includes(searchTerm) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    // Apply tag filter
    if (filters.tags.length > 0) {
      filtered = filtered.filter(template =>
        filters.tags.every(tag => template.tags.includes(tag))
      );
    }

    // Apply sorting
    switch (filters.sortBy) {
      case 'popular':
        filtered.sort((a, b) => b.downloads - a.downloads);
        break;
      case 'recent':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'rating':
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    setFilteredTemplates(filtered);
  };

  const handleCreateFromTemplate = async (template: WorkflowTemplate) => {
    try {
      const workflow = await workflowService.createFromTemplate(template.id, {
        name: `${template.name} (Copy)`,
        description: template.description
      });
      onCreateFromTemplate?.(template, workflow);
    } catch (error) {
      console.error('Failed to create from template:', error);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!currentWorkflow) return;

    try {
      const template = await workflowService.saveAsTemplate(currentWorkflow.id, {
        name: saveTemplateData.name,
        description: saveTemplateData.description,
        category: saveTemplateData.category,
        tags: saveTemplateData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        difficulty: saveTemplateData.complexity.toLowerCase() as any
      });
      
      setTemplates(prev => [template, ...prev]);
      setIsSaveDialogOpen(false);
      setSaveTemplateData({
        name: '',
        description: '',
        category: '',
        tags: '',
        complexity: 'SIMPLE'
      });
      
      onSaveAsTemplate?.(currentWorkflow);
    } catch (error) {
      console.error('Failed to save as template:', error);
    }
  };

  const toggleBookmark = (templateId: string) => {
    const newBookmarks = new Set(bookmarkedTemplates);
    if (newBookmarks.has(templateId)) {
      newBookmarks.delete(templateId);
    } else {
      newBookmarks.add(templateId);
    }
    setBookmarkedTemplates(newBookmarks);
    saveBookmarks(newBookmarks);
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'SIMPLE': return 'bg-green-100 text-green-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLEX': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'automation': return Bot;
      case 'data-processing': return Database;
      case 'ai-workflows': return Zap;
      case 'integration': return Globe;
      case 'monitoring': return Eye;
      case 'customer-service': return Users;
      case 'content-generation': return Code;
      case 'analytics': return BarChart3;
      default: return Layers;
    }
  };

  const formatEstimatedTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const TemplateCard = ({ template }: { template: WorkflowTemplate }) => {
    const CategoryIcon = getCategoryIcon(template.category);
    const isBookmarked = bookmarkedTemplates.has(template.id);

    return (
      <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CategoryIcon className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{template.category}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleBookmark(template.id);
              }}
            >
              {isBookmarked ? (
                <BookmarkCheck className="h-4 w-4 text-blue-500" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {template.description}
          </p>
          
          <div className="flex items-center gap-2 mb-3">
            <Badge className={getComplexityColor(template.complexity)}>
              {template.complexity.toLowerCase()}
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {formatEstimatedTime(template.estimatedExecutionTime)}
            </Badge>
          </div>
          
          <div className="flex flex-wrap gap-1 mb-3">
            {template.tags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {template.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{template.tags.length - 3}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Download className="h-3 w-3" />
                {template.downloads}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {template.rating.toFixed(1)}
              </span>
            </div>
            <span>{new Date(template.createdAt).toLocaleDateString()}</span>
          </div>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => handleCreateFromTemplate(template)}
            >
              <Copy className="h-3 w-3 mr-1" />
              Use Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedTemplate(template);
                setIsPreviewOpen(true);
              }}
            >
              <Eye className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const TemplateListItem = ({ template }: { template: WorkflowTemplate }) => {
    const CategoryIcon = getCategoryIcon(template.category);
    const isBookmarked = bookmarkedTemplates.has(template.id);

    return (
      <Card className="group hover:shadow-md transition-all duration-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CategoryIcon className="h-5 w-5 text-blue-600" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium">{template.name}</h3>
                  <Badge className={getComplexityColor(template.complexity)}>
                    {template.complexity.toLowerCase()}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                  {template.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{template.category}</span>
                  <span className="flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    {template.downloads}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {template.rating.toFixed(1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatEstimatedTime(template.estimatedExecutionTime)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleBookmark(template.id)}
              >
                {isBookmarked ? (
                  <BookmarkCheck className="h-4 w-4 text-blue-500" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedTemplate(template);
                  setIsPreviewOpen(true);
                }}
              >
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </Button>
              
              <Button
                size="sm"
                onClick={() => handleCreateFromTemplate(template)}
              >
                <Copy className="h-4 w-4 mr-1" />
                Use Template
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Template className="h-8 w-8 animate-pulse mx-auto mb-2" />
            <p>Loading templates...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6 bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Template className="h-6 w-6" />
            Workflow Templates
          </h2>
          <p className="text-muted-foreground">
            Browse and use pre-built workflow templates
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {currentWorkflow && (
            <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save as Template
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save Workflow as Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="template-name">Template Name</Label>
                    <Input
                      id="template-name"
                      value={saveTemplateData.name}
                      onChange={(e) => setSaveTemplateData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter template name"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="template-description">Description</Label>
                    <Textarea
                      id="template-description"
                      value={saveTemplateData.description}
                      onChange={(e) => setSaveTemplateData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe what this template does"
                      rows={3}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="template-category">Category</Label>
                      <Select
                        value={saveTemplateData.category}
                        onValueChange={(value) => setSaveTemplateData(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {templateCategories.slice(1).map(category => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="template-complexity">Complexity</Label>
                      <Select
                        value={saveTemplateData.complexity}
                        onValueChange={(value: any) => setSaveTemplateData(prev => ({ ...prev, complexity: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {complexityLevels.slice(1).map(level => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="template-tags">Tags (comma-separated)</Label>
                    <Input
                      id="template-tags"
                      value={saveTemplateData.tags}
                      onChange={(e) => setSaveTemplateData(prev => ({ ...prev, tags: e.target.value }))}
                      placeholder="automation, ai, data-processing"
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveAsTemplate}>
                      Save Template
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>
            
            <Select
              value={filters.category}
              onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {templateCategories.map(category => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select
              value={filters.complexity}
              onValueChange={(value) => setFilters(prev => ({ ...prev, complexity: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Complexity" />
              </SelectTrigger>
              <SelectContent>
                {complexityLevels.map(level => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select
              value={filters.sortBy}
              onValueChange={(value: any) => setFilters(prev => ({ ...prev, sortBy: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredTemplates.length} templates found
          </p>
        </div>
        
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTemplates.map(template => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTemplates.map(template => (
              <TemplateListItem key={template.id} template={template} />
            ))}
          </div>
        )}
        
        {filteredTemplates.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <Template className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No templates found</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters or search terms
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Template Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Template Preview
            </DialogTitle>
          </DialogHeader>
          
          {selectedTemplate && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold">{selectedTemplate.name}</h3>
                    <p className="text-muted-foreground">{selectedTemplate.description}</p>
                  </div>
                  <Button onClick={() => handleCreateFromTemplate(selectedTemplate)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Use Template
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Category</label>
                    <p className="font-medium">{selectedTemplate.category}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Complexity</label>
                    <Badge className={getComplexityColor(selectedTemplate.complexity)}>
                      {selectedTemplate.complexity.toLowerCase()}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Est. Time</label>
                    <p className="font-medium">{formatEstimatedTime(selectedTemplate.estimatedExecutionTime)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Rating</label>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium">{selectedTemplate.rating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tags</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedTemplate.tags.map(tag => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {selectedTemplate.previewImage && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Preview</label>
                    <img
                      src={selectedTemplate.previewImage}
                      alt={selectedTemplate.name}
                      className="w-full rounded-lg border mt-2"
                    />
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Downloads</label>
                    <p className="font-medium">{selectedTemplate.downloads.toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                    <p className="font-medium">{new Date(selectedTemplate.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}