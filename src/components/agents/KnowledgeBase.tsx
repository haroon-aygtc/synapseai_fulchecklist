import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { useApixEvents, useApixPublish } from '@/lib/apix/hooks';
import { APIX_CHANNELS } from '@/lib/apix/types';
import { useAuth } from '@/lib/auth/auth-context';
import {
  Search,
  FileText,
  Upload,
  RefreshCw,
  Database,
  Folder,
  Plus,
  Filter,
  BookOpen,
  FileQuestion,
  BarChart3,
  Trash2,
  Edit,
  Download,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  type: string;
  settings: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

interface Collection {
  id: string;
  name: string;
  description?: string;
  knowledgeBaseId: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    documents: number;
  };
}

interface Document {
  id: string;
  title: string;
  content: string;
  type: string;
  source?: string;
  url?: string;
  knowledgeBaseId: string;
  collectionId?: string;
  isProcessed: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  collection?: {
    id: string;
    name: string;
  };
  chunks?: DocumentChunk[];
}

interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  position: number;
  embeddings?: number[];
  metadata: Record<string, any>;
  createdAt: Date;
}

interface SearchResult {
  document: Document;
  relevanceScore: number;
  matchingChunks: Array<{
    content: string;
    score: number;
    position: number;
  }>;
}

interface KnowledgeBaseProps {
  agentId?: string;
  onDocumentSelect?: (document: Document) => void;
  onSearchResults?: (results: SearchResult[]) => void;
  className?: string;
}

export default function KnowledgeBaseComponent({
  agentId,
  onDocumentSelect,
  onSearchResults,
  className = ''
}: KnowledgeBaseProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const publish = useApixPublish();
  
  const [activeTab, setActiveTab] = useState<string>('search');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [newKnowledgeBase, setNewKnowledgeBase] = useState({
    name: '',
    description: ''
  });
  const [newCollection, setNewCollection] = useState({
    name: '',
    description: ''
  });
  const [newDocument, setNewDocument] = useState({
    title: '',
    content: '',
    collectionId: ''
  });
  const [isCreatingKB, setIsCreatingKB] = useState<boolean>(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState<boolean>(false);
  const [isCreatingDocument, setIsCreatingDocument] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Subscribe to knowledge events
  const knowledgeEvents = useApixEvents({
    channel: APIX_CHANNELS.KNOWLEDGE_EVENTS,
    includeHistory: true,
    historyLimit: 50
  });

  // Process knowledge events
  useEffect(() => {
    for (const event of knowledgeEvents) {
      if (event.type === 'KNOWLEDGE_BASES_LIST_RESPONSE') {
        setKnowledgeBases(event.data.knowledgeBases || []);
        setIsLoading(false);
      } else if (event.type === 'COLLECTIONS_LIST_RESPONSE') {
        setCollections(event.data.collections || []);
      } else if (event.type === 'DOCUMENTS_LIST_RESPONSE') {
        setDocuments(event.data.documents || []);
      } else if (event.type === 'SEARCH_RESULTS') {
        setSearchResults(event.data.results || []);
        setIsSearching(false);
        
        // Notify parent component
        if (onSearchResults) {
          onSearchResults(event.data.results || []);
        }
      } else if (event.type === 'KNOWLEDGE_BASE_CREATED') {
        setKnowledgeBases(prev => [...prev, event.data.knowledgeBase]);
        setIsCreatingKB(false);
        setNewKnowledgeBase({ name: '', description: '' });
        
        toast({
          title: 'Knowledge Base Created',
          description: `Knowledge base "${event.data.knowledgeBase.name}" has been created.`,
        });
      } else if (event.type === 'COLLECTION_CREATED') {
        setCollections(prev => [...prev, event.data.collection]);
        setIsCreatingCollection(false);
        setNewCollection({ name: '', description: '' });
        
        toast({
          title: 'Collection Created',
          description: `Collection "${event.data.collection.name}" has been created.`,
        });
      } else if (event.type === 'DOCUMENT_CREATED') {
        setDocuments(prev => [...prev, event.data.document]);
        setIsCreatingDocument(false);
        setNewDocument({ title: '', content: '', collectionId: '' });
        
        toast({
          title: 'Document Created',
          description: `Document "${event.data.document.title}" has been created.`,
        });
      } else if (event.type === 'DOCUMENT_UPLOADED') {
        setDocuments(prev => [...prev, event.data.document]);
        setIsUploading(false);
        
        toast({
          title: 'Document Uploaded',
          description: `Document "${event.data.document.title}" has been uploaded.`,
        });
      } else if (event.type === 'DOCUMENT_PROCESSING_COMPLETED') {
        setDocuments(prev => 
          prev.map(doc => 
            doc.id === event.data.documentId 
              ? { ...doc, isProcessed: true } 
              : doc
          )
        );
        
        toast({
          title: 'Document Processing Completed',
          description: `Document has been processed and is ready for search.`,
        });
      } else if (event.type === 'DOCUMENT_PROCESSING_FAILED') {
        toast({
          title: 'Document Processing Failed',
          description: event.data.error || 'An error occurred during document processing.',
          variant: 'destructive'
        });
      } else if (event.type === 'DOCUMENT_DELETED') {
        setDocuments(prev => prev.filter(doc => doc.id !== event.data.documentId));
        
        if (selectedDocument?.id === event.data.documentId) {
          setSelectedDocument(null);
        }
        
        toast({
          title: 'Document Deleted',
          description: 'Document has been deleted.',
        });
      }
    }
  }, [knowledgeEvents, toast, onSearchResults]);

  // Load knowledge bases on mount
  useEffect(() => {
    publish({
      type: 'KNOWLEDGE_BASES_LIST_REQUEST',
      channel: APIX_CHANNELS.KNOWLEDGE_EVENTS,
      data: {}
    });
  }, [publish]);

  // Load collections when knowledge base is selected
  useEffect(() => {
    if (selectedKnowledgeBase) {
      publish({
        type: 'COLLECTIONS_LIST_REQUEST',
        channel: APIX_CHANNELS.KNOWLEDGE_EVENTS,
        data: { knowledgeBaseId: selectedKnowledgeBase.id }
      });
      
      publish({
        type: 'DOCUMENTS_LIST_REQUEST',
        channel: APIX_CHANNELS.KNOWLEDGE_EVENTS,
        data: { 
          knowledgeBaseId: selectedKnowledgeBase.id,
          collectionId: selectedCollection
        }
      });
    }
  }, [selectedKnowledgeBase, selectedCollection, publish]);

  // Handle knowledge base selection
  const selectKnowledgeBase = (kb: KnowledgeBase) => {
    setSelectedKnowledgeBase(kb);
    setSelectedCollection(null);
    setSelectedDocument(null);
    setSearchResults([]);
  };

  // Handle document selection
  const selectDocument = (document: Document) => {
    setSelectedDocument(document);
    
    // Notify parent component
    if (onDocumentSelect) {
      onDocumentSelect(document);
    }
  };

  // Handle collection selection
  const handleCollectionSelect = (collectionId: string | null) => {
    setSelectedCollection(collectionId);
    setSelectedDocument(null);
    
    if (selectedKnowledgeBase) {
      publish({
        type: 'DOCUMENTS_LIST_REQUEST',
        channel: APIX_CHANNELS.KNOWLEDGE_EVENTS,
        data: { 
          knowledgeBaseId: selectedKnowledgeBase.id,
          collectionId
        }
      });
    }
  };

  // Handle search
  const handleSearch = () => {
    if (!searchQuery.trim() || !selectedKnowledgeBase) return;
    
    setIsSearching(true);
    setSearchResults([]);
    
    publish({
      type: 'SEARCH_REQUEST',
      channel: APIX_CHANNELS.KNOWLEDGE_EVENTS,
      data: {
        knowledgeBaseId: selectedKnowledgeBase.id,
        query: searchQuery,
        limit: 10,
        threshold: 0.7,
        collectionIds: selectedCollection ? [selectedCollection] : undefined
      }
    });
  };

  // Create knowledge base
  const createKnowledgeBase = () => {
    if (!newKnowledgeBase.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a name for the knowledge base.',
        variant: 'destructive'
      });
      return;
    }
    
    setIsCreatingKB(true);
    
    publish({
      type: 'KNOWLEDGE_BASE_CREATE',
      channel: APIX_CHANNELS.KNOWLEDGE_EVENTS,
      data: {
        name: newKnowledgeBase.name,
        description: newKnowledgeBase.description,
        type: 'general'
      }
    });
  };

  // Create collection
  const createCollection = () => {
    if (!newCollection.name.trim() || !selectedKnowledgeBase) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a name for the collection and select a knowledge base.',
        variant: 'destructive'
      });
      return;
    }
    
    setIsCreatingCollection(true);
    
    publish({
      type: 'COLLECTION_CREATE',
      channel: APIX_CHANNELS.KNOWLEDGE_EVENTS,
      data: {
        knowledgeBaseId: selectedKnowledgeBase.id,
        name: newCollection.name,
        description: newCollection.description
      }
    });
  };

  // Create document
  const createDocument = () => {
    if (!newDocument.title.trim() || !newDocument.content.trim() || !selectedKnowledgeBase) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title and content for the document.',
        variant: 'destructive'
      });
      return;
    }
    
    setIsCreatingDocument(true);
    
    publish({
      type: 'DOCUMENT_CREATE',
      channel: APIX_CHANNELS.KNOWLEDGE_EVENTS,
      data: {
        knowledgeBaseId: selectedKnowledgeBase.id,
        title: newDocument.title,
        content: newDocument.content,
        collectionId: newDocument.collectionId || null,
        type: 'text'
      }
    });
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedKnowledgeBase) return;
    
    setIsUploading(true);
    
    // In a real implementation, you would upload the file to the server
    // For now, we'll simulate the upload
    setTimeout(() => {
      publish({
        type: 'DOCUMENT_UPLOAD',
        channel: APIX_CHANNELS.KNOWLEDGE_EVENTS,
        data: {
          knowledgeBaseId: selectedKnowledgeBase.id,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          collectionId: selectedCollection || null
        }
      });
    }, 1000);
  };

  // Delete document
  const deleteDocument = (documentId: string) => {
    if (!selectedKnowledgeBase) return;
    
    if (confirm('Are you sure you want to delete this document?')) {
      publish({
        type: 'DOCUMENT_DELETE',
        channel: APIX_CHANNELS.KNOWLEDGE_EVENTS,
        data: {
          knowledgeBaseId: selectedKnowledgeBase.id,
          documentId
        }
      });
    }
  };

  // Render document status badge
  const renderDocumentStatus = (document: Document) => {
    if (document.isProcessed) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Processed
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          <Clock className="h-3 w-3 mr-1" />
          Processing
        </Badge>
      );
    }
  };

  // Render document type badge
  const renderDocumentType = (type: string) => {
    switch (type) {
      case 'text':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <FileText className="h-3 w-3 mr-1" />
            Text
          </Badge>
        );
      case 'pdf':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <FileText className="h-3 w-3 mr-1" />
            PDF
          </Badge>
        );
      case 'docx':
        return (
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
            <FileText className="h-3 w-3 mr-1" />
            DOCX
          </Badge>
        );
      case 'html':
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            <FileText className="h-3 w-3 mr-1" />
            HTML
          </Badge>
        );
      case 'json':
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            <FileText className="h-3 w-3 mr-1" />
            JSON
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <FileText className="h-3 w-3 mr-1" />
            {type}
          </Badge>
        );
    }
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Knowledge Base</CardTitle>
            <CardDescription>
              Search and manage knowledge for agents
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <select
              className="text-sm border rounded px-2 py-1"
              value={selectedKnowledgeBase?.id || ''}
              onChange={(e) => {
                const kb = knowledgeBases.find(kb => kb.id === e.target.value);
                if (kb) selectKnowledgeBase(kb);
              }}
            >
              <option value="">Select Knowledge Base</option>
              {knowledgeBases.map(kb => (
                <option key={kb.id} value={kb.id}>{kb.name}</option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('create')}
            >
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading knowledge bases...</span>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="search">
                <Search className="h-4 w-4 mr-1" />
                Search
              </TabsTrigger>
              <TabsTrigger value="browse">
                <BookOpen className="h-4 w-4 mr-1" />
                Browse
              </TabsTrigger>
              <TabsTrigger value="upload">
                <Upload className="h-4 w-4 mr-1" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="create">
                <Plus className="h-4 w-4 mr-1" />
                Create
              </TabsTrigger>
            </TabsList>
            
            {/* Search Tab */}
            <TabsContent value="search" className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="Search knowledge base..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  disabled={!selectedKnowledgeBase}
                />
                <Button 
                  onClick={handleSearch} 
                  disabled={!searchQuery.trim() || !selectedKnowledgeBase || isSearching}
                >
                  {isSearching ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Search className="h-4 w-4 mr-1" />
                  )}
                  Search
                </Button>
              </div>
              
              {!selectedKnowledgeBase && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Database className="h-12 w-12 text-gray-300 mb-2" />
                  <h3 className="text-lg font-medium text-gray-500">No Knowledge Base Selected</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Please select a knowledge base to search
                  </p>
                </div>
              )}
              
              {selectedKnowledgeBase && searchResults.length === 0 && !isSearching && searchQuery && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <FileQuestion className="h-12 w-12 text-gray-300 mb-2" />
                  <h3 className="text-lg font-medium text-gray-500">No Results Found</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Try a different search query
                  </p>
                </div>
              )}
              
              {isSearching && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <RefreshCw className="h-12 w-12 text-primary animate-spin mb-2" />
                  <h3 className="text-lg font-medium text-gray-500">Searching...</h3>
                </div>
              )}
              
              {searchResults.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Search Results</h3>
                  <ScrollArea className="h-96">
                    <div className="space-y-4">
                      {searchResults.map((result, index) => (
                        <Card key={index} className="overflow-hidden">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">{result.document.title}</CardTitle>
                              <div className="flex items-center space-x-2">
                                {renderDocumentType(result.document.type)}
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  {Math.round(result.relevanceScore * 100)}% match
                                </Badge>
                              </div>
                            </div>
                            {result.document.collection && (
                              <CardDescription>
                                Collection: {result.document.collection.name}
                              </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent className="pb-2">
                            <div className="space-y-2">
                              {result.matchingChunks.map((chunk, chunkIndex) => (
                                <div key={chunkIndex} className="bg-yellow-50 p-2 rounded-md">
                                  <p className="text-sm">{chunk.content}</p>
                                  <div className="flex justify-between mt-1">
                                    <span className="text-xs text-gray-500">
                                      Chunk {chunk.position + 1}
                                    </span>
                                    <span className="text-xs text-blue-600">
                                      {Math.round(chunk.score * 100)}% relevance
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                          <CardFooter className="pt-0">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full"
                              onClick={() => selectDocument(result.document)}
                            >
                              View Full Document
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </TabsContent>
            
            {/* Browse Tab */}
            <TabsContent value="browse" className="space-y-4">
              {!selectedKnowledgeBase ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Database className="h-12 w-12 text-gray-300 mb-2" />
                  <h3 className="text-lg font-medium text-gray-500">No Knowledge Base Selected</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Please select a knowledge base to browse
                  </p>
                </div>
              ) : (
                <div className="flex h-[500px] gap-4">
                  <div className="w-1/4 border rounded-md overflow-hidden">
                    <div className="p-3 border-b bg-gray-50">
                      <h3 className="font-medium">Collections</h3>
                    </div>
                    <ScrollArea className="h-[460px]">
                      <div className="p-2">
                        <div
                          className={`p-2 rounded cursor-pointer ${
                            selectedCollection === null ? 'bg-primary/10' : 'hover:bg-gray-100'
                          }`}
                          onClick={() => handleCollectionSelect(null)}
                        >
                          <div className="flex items-center">
                            <Database className="h-4 w-4 mr-2 text-gray-500" />
                            <span>All Documents</span>
                          </div>
                        </div>
                        
                        {collections.map(collection => (
                          <div
                            key={collection.id}
                            className={`p-2 rounded cursor-pointer ${
                              selectedCollection === collection.id ? 'bg-primary/10' : 'hover:bg-gray-100'
                            }`}
                            onClick={() => handleCollectionSelect(collection.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <Folder className="h-4 w-4 mr-2 text-blue-500" />
                                <span>{collection.name}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {collection._count?.documents || 0}
                              </Badge>
                            </div>
                          </div>
                        ))}
                        
                        {collections.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-32 text-center">
                            <Folder className="h-8 w-8 text-gray-300 mb-2" />
                            <p className="text-gray-500">No collections</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                  
                  <div className="w-3/4 border rounded-md overflow-hidden">
                    <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
                      <h3 className="font-medium">
                        {selectedCollection 
                          ? `Documents in ${collections.find(c => c.id === selectedCollection)?.name}` 
                          : 'All Documents'}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <Input
                          placeholder="Filter documents..."
                          className="h-8 w-48"
                        />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Filter className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="h-[460px]">
                      <div className="p-3 space-y-2">
                        {documents.map(document => (
                          <div
                            key={document.id}
                            className={`p-3 border rounded-md cursor-pointer ${
                              selectedDocument?.id === document.id ? 'border-primary bg-primary/5' : 'hover:border-gray-300'
                            }`}
                            onClick={() => selectDocument(document)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium">{document.title}</h4>
                                <p className="text-xs text-gray-500 line-clamp-1">
                                  {document.content}
                                </p>
                              </div>
                              <div className="flex flex-col items-end space-y-1">
                                <div className="flex items-center space-x-1">
                                  {renderDocumentType(document.type)}
                                  {renderDocumentStatus(document)}
                                </div>
                                <span className="text-xs text-gray-500">
                                  {new Date(document.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {documents.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-32 text-center">
                            <FileText className="h-8 w-8 text-gray-300 mb-2" />
                            <p className="text-gray-500">No documents</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )}
              
              {selectedDocument && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle>{selectedDocument.title}</CardTitle>
                      <div className="flex items-center space-x-2">
                        {renderDocumentType(selectedDocument.type)}
                        {renderDocumentStatus(selectedDocument)}
                        <Button variant="ghost" size="sm" onClick={() => deleteDocument(selectedDocument.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>
                      {selectedDocument.collection?.name && `Collection: ${selectedDocument.collection.name}`}
                      {selectedDocument.source && ` • Source: ${selectedDocument.source}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64 border rounded-md p-3">
                      <pre className="whitespace-pre-wrap text-sm">
                        {selectedDocument.content}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            {/* Upload Tab */}
            <TabsContent value="upload" className="space-y-4">
              {!selectedKnowledgeBase ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Database className="h-12 w-12 text-gray-300 mb-2" />
                  <h3 className="text-lg font-medium text-gray-500">No Knowledge Base Selected</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Please select a knowledge base to upload documents
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Upload Document</CardTitle>
                      <CardDescription>
                        Upload documents to the knowledge base
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium">Collection (Optional)</label>
                          <select
                            className="w-full mt-1 rounded-md border border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            value={selectedCollection || ''}
                            onChange={(e) => setSelectedCollection(e.target.value || null)}
                          >
                            <option value="">No Collection</option>
                            {collections.map(collection => (
                              <option key={collection.id} value={collection.id}>
                                {collection.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        
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
                                  <input 
                                    id="file-upload" 
                                    name="file-upload" 
                                    type="file" 
                                    className="sr-only"
                                    onChange={handleFileUpload}
                                    disabled={isUploading}
                                  />
                                </label>
                                <p className="pl-1">or drag and drop</p>
                              </div>
                              <p className="text-xs text-gray-500">
                                PDF, DOCX, TXT, HTML, JSON up to 10MB
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {isUploading && (
                          <div className="flex items-center justify-center">
                            <RefreshCw className="h-5 w-5 animate-spin text-primary mr-2" />
                            <span>Uploading document...</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Import from URL</CardTitle>
                      <CardDescription>
                        Import content from a web URL
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium">URL</label>
                          <div className="flex space-x-2 mt-1">
                            <Input placeholder="https://example.com/document" />
                            <Button>
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Import
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
            
            {/* Create Tab */}
            <TabsContent value="create" className="space-y-4">
              <Tabs defaultValue="kb" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="kb">Knowledge Base</TabsTrigger>
                  <TabsTrigger value="collection">Collection</TabsTrigger>
                  <TabsTrigger value="document">Document</TabsTrigger>
                </TabsList>
                
                <TabsContent value="kb" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Create Knowledge Base</CardTitle>
                      <CardDescription>
                        Create a new knowledge base for your organization
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="kb-name" className="text-sm font-medium">
                            Name
                          </label>
                          <Input
                            id="kb-name"
                            placeholder="Enter knowledge base name"
                            value={newKnowledgeBase.name}
                            onChange={(e) => setNewKnowledgeBase(prev => ({ ...prev, name: e.target.value }))}
                            className="mt-1"
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="kb-description" className="text-sm font-medium">
                            Description (Optional)
                          </label>
                          <Textarea
                            id="kb-description"
                            placeholder="Enter description"
                            value={newKnowledgeBase.description}
                            onChange={(e) => setNewKnowledgeBase(prev => ({ ...prev, description: e.target.value }))}
                            className="mt-1"
                            rows={3}
                          />
                        </div>
                        
                        <Button 
                          onClick={createKnowledgeBase} 
                          disabled={isCreatingKB || !newKnowledgeBase.name.trim()}
                          className="w-full"
                        >
                          {isCreatingKB && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                          Create Knowledge Base
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Existing Knowledge Bases</h3>
                    <div className="border rounded-md overflow-hidden">
                      <ScrollArea className="h-64">
                        <div className="p-3 space-y-2">
                          {knowledgeBases.map(kb => (
                            <div
                              key={kb.id}
                              className="p-3 border rounded-md cursor-pointer hover:border-gray-300"
                              onClick={() => selectKnowledgeBase(kb)}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium">{kb.name}</h4>
                                  {kb.description && (
                                    <p className="text-xs text-gray-500">{kb.description}</p>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline">
                                    {kb.type}
                                  </Badge>
                                  <Button variant="ghost" size="sm">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {knowledgeBases.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-32 text-center">
                              <Database className="h-8 w-8 text-gray-300 mb-2" />
                              <p className="text-gray-500">No knowledge bases</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="collection" className="space-y-4 mt-4">
                  {!selectedKnowledgeBase ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                      <Database className="h-12 w-12 text-gray-300 mb-2" />
                      <h3 className="text-lg font-medium text-gray-500">No Knowledge Base Selected</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        Please select a knowledge base to create collections
                      </p>
                    </div>
                  ) : (
                    <>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Create Collection</CardTitle>
                          <CardDescription>
                            Create a new collection in {selectedKnowledgeBase.name}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div>
                              <label htmlFor="collection-name" className="text-sm font-medium">
                                Name
                              </label>
                              <Input
                                id="collection-name"
                                placeholder="Enter collection name"
                                value={newCollection.name}
                                onChange={(e) => setNewCollection(prev => ({ ...prev, name: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            
                            <div>
                              <label htmlFor="collection-description" className="text-sm font-medium">
                                Description (Optional)
                              </label>
                              <Textarea
                                id="collection-description"
                                placeholder="Enter description"
                                value={newCollection.description}
                                onChange={(e) => setNewCollection(prev => ({ ...prev, description: e.target.value }))}
                                className="mt-1"
                                rows={3}
                              />
                            </div>
                            
                            <Button 
                              onClick={createCollection} 
                              disabled={isCreatingCollection || !newCollection.name.trim()}
                              className="w-full"
                            >
                              {isCreatingCollection && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                              Create Collection
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">Existing Collections</h3>
                        <div className="border rounded-md overflow-hidden">
                          <ScrollArea className="h-64">
                            <div className="p-3 space-y-2">
                              {collections.map(collection => (
                                <div
                                  key={collection.id}
                                  className="p-3 border rounded-md cursor-pointer hover:border-gray-300"
                                  onClick={() => handleCollectionSelect(collection.id)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <h4 className="font-medium">{collection.name}</h4>
                                      {collection.description && (
                                        <p className="text-xs text-gray-500">{collection.description}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Badge variant="outline">
                                        {collection._count?.documents || 0} documents
                                      </Badge>
                                      <Button variant="ghost" size="sm">
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              
                              {collections.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-32 text-center">
                                  <Folder className="h-8 w-8 text-gray-300 mb-2" />
                                  <p className="text-gray-500">No collections</p>
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>
                
                <TabsContent value="document" className="space-y-4 mt-4">
                  {!selectedKnowledgeBase ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                      <Database className="h-12 w-12 text-gray-300 mb-2" />
                      <h3 className="text-lg font-medium text-gray-500">No Knowledge Base Selected</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        Please select a knowledge base to create documents
                      </p>
                    </div>
                  ) : (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Create Document</CardTitle>
                        <CardDescription>
                          Create a new document in {selectedKnowledgeBase.name}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <label htmlFor="document-title" className="text-sm font-medium">
                              Title
                            </label>
                            <Input
                              id="document-title"
                              placeholder="Enter document title"
                              value={newDocument.title}
                              onChange={(e) => setNewDocument(prev => ({ ...prev, title: e.target.value }))}
                              className="mt-1"
                            />
                          </div>
                          
                          <div>
                            <label htmlFor="document-collection" className="text-sm font-medium">
                              Collection (Optional)
                            </label>
                            <select
                              id="document-collection"
                              className="w-full mt-1 rounded-md border border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              value={newDocument.collectionId}
                              onChange={(e) => setNewDocument(prev => ({ ...prev, collectionId: e.target.value }))}
                            >
                              <option value="">No Collection</option>
                              {collections.map(collection => (
                                <option key={collection.id} value={collection.id}>
                                  {collection.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label htmlFor="document-content" className="text-sm font-medium">
                              Content
                            </label>
                            <Textarea
                              id="document-content"
                              placeholder="Enter document content"
                              value={newDocument.content}
                              onChange={(e) => setNewDocument(prev => ({ ...prev, content: e.target.value }))}
                              className="mt-1"
                              rows={10}
                            />
                          </div>
                          
                          <Button 
                            onClick={createDocument} 
                            disabled={isCreatingDocument || !newDocument.title.trim() || !newDocument.content.trim()}
                            className="w-full"
                          >
                            {isCreatingDocument && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                            Create Document
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
      <CardFooter className="border-t pt-4">
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-gray-500">
            {selectedKnowledgeBase ? (
              <span>
                Selected: <span className="font-medium">{selectedKnowledgeBase.name}</span>
              </span>
            ) : (
              <span>No knowledge base selected</span>
            )}
          </div>
          {selectedKnowledgeBase && (
            <div className="flex items-center space-x-4">
              <span className="text-xs text-gray-500">
                {documents.length} documents
              </span>
              <span className="text-xs text-gray-500">
                {collections.length} collections
              </span>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                <BarChart3 className="h-3 w-3 mr-1" />
                Analytics
              </Button>
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}