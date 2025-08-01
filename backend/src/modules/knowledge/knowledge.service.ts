import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ApixService } from '../apix/apix.service';
import { KnowledgeBase, Document, Collection, DocumentChunk } from '@prisma/client';
import { z } from 'zod';
import OpenAI from 'openai';
import * as pdf from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import axios from 'axios';

const CreateKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.string().default('general'),
  settings: z.record(z.any()).default({})
});

const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  metadata: z.record(z.any()).default({})
});

const CreateDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  type: z.string().default('text'),
  source: z.string().optional(),
  url: z.string().url().optional(),
  collectionId: z.string().optional(),
  metadata: z.record(z.any()).default({})
});

const SearchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(100).default(10),
  threshold: z.number().min(0).max(1).default(0.7),
  collectionIds: z.array(z.string()).optional(),
  filters: z.record(z.any()).default({})
});

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private apix: ApixService
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async createKnowledgeBase(
    userId: string,
    organizationId: string,
    data: z.infer<typeof CreateKnowledgeBaseSchema>
  ): Promise<KnowledgeBase> {
    const validatedData = CreateKnowledgeBaseSchema.parse(data);

    const knowledgeBase = await this.prisma.knowledgeBase.create({
      data: {
        ...validatedData,
        userId,
        organizationId,
        settings: validatedData.settings,
        metadata: {
          createdBy: userId,
          documentCount: 0,
          totalSize: 0,
          lastIndexed: null
        }
      }
    });

    await this.apix.publishEvent('knowledge-events', {
      type: 'KNOWLEDGE_BASE_CREATED',
      knowledgeBaseId: knowledgeBase.id,
      organizationId,
      data: knowledgeBase
    });

    return knowledgeBase;
  }

  async getKnowledgeBases(organizationId: string): Promise<KnowledgeBase[]> {
    return this.prisma.knowledgeBase.findMany({
      where: { organizationId, isActive: true },
      include: {
        collections: {
          include: {
            _count: {
              select: { documents: true }
            }
          }
        },
        _count: {
          select: { documents: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getKnowledgeBase(id: string, organizationId: string): Promise<KnowledgeBase> {
    const knowledgeBase = await this.prisma.knowledgeBase.findFirst({
      where: { id, organizationId },
      include: {
        collections: {
          include: {
            documents: {
              take: 10,
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        documents: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!knowledgeBase) {
      throw new NotFoundException('Knowledge base not found');
    }

    return knowledgeBase;
  }

  async updateKnowledgeBase(
    id: string,
    organizationId: string,
    data: Partial<z.infer<typeof CreateKnowledgeBaseSchema>>
  ): Promise<KnowledgeBase> {
    const existingKb = await this.prisma.knowledgeBase.findFirst({
      where: { id, organizationId }
    });

    if (!existingKb) {
      throw new NotFoundException('Knowledge base not found');
    }

    const knowledgeBase = await this.prisma.knowledgeBase.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });

    await this.apix.publishEvent('knowledge-events', {
      type: 'KNOWLEDGE_BASE_UPDATED',
      knowledgeBaseId: knowledgeBase.id,
      organizationId,
      data: knowledgeBase
    });

    return knowledgeBase;
  }

  async deleteKnowledgeBase(id: string, organizationId: string): Promise<void> {
    const knowledgeBase = await this.prisma.knowledgeBase.findFirst({
      where: { id, organizationId }
    });

    if (!knowledgeBase) {
      throw new NotFoundException('Knowledge base not found');
    }

    await this.prisma.knowledgeBase.delete({
      where: { id }
    });

    await this.apix.publishEvent('knowledge-events', {
      type: 'KNOWLEDGE_BASE_DELETED',
      knowledgeBaseId: id,
      organizationId
    });
  }

  async createCollection(
    knowledgeBaseId: string,
    organizationId: string,
    data: z.infer<typeof CreateCollectionSchema>
  ): Promise<Collection> {
    const validatedData = CreateCollectionSchema.parse(data);

    // Verify knowledge base exists and belongs to organization
    const knowledgeBase = await this.prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, organizationId }
    });

    if (!knowledgeBase) {
      throw new NotFoundException('Knowledge base not found');
    }

    const collection = await this.prisma.collection.create({
      data: {
        ...validatedData,
        knowledgeBaseId,
        metadata: validatedData.metadata
      }
    });

    await this.apix.publishEvent('knowledge-events', {
      type: 'COLLECTION_CREATED',
      collectionId: collection.id,
      knowledgeBaseId,
      organizationId,
      data: collection
    });

    return collection;
  }

  async getCollections(knowledgeBaseId: string, organizationId: string): Promise<Collection[]> {
    // Verify knowledge base exists and belongs to organization
    const knowledgeBase = await this.prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, organizationId }
    });

    if (!knowledgeBase) {
      throw new NotFoundException('Knowledge base not found');
    }

    return this.prisma.collection.findMany({
      where: { knowledgeBaseId },
      include: {
        _count: {
          select: { documents: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createDocument(
    knowledgeBaseId: string,
    organizationId: string,
    data: z.infer<typeof CreateDocumentSchema>
  ): Promise<Document> {
    const validatedData = CreateDocumentSchema.parse(data);

    // Verify knowledge base exists and belongs to organization
    const knowledgeBase = await this.prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, organizationId }
    });

    if (!knowledgeBase) {
      throw new NotFoundException('Knowledge base not found');
    }

    // Verify collection exists if provided
    if (validatedData.collectionId) {
      const collection = await this.prisma.collection.findFirst({
        where: { id: validatedData.collectionId, knowledgeBaseId }
      });

      if (!collection) {
        throw new NotFoundException('Collection not found');
      }
    }

    const document = await this.prisma.document.create({
      data: {
        ...validatedData,
        knowledgeBaseId,
        metadata: validatedData.metadata
      }
    });

    // Process document asynchronously
    this.processDocumentAsync(document).catch(error => {
      this.logger.error(`Document processing failed: ${error.message}`);
    });

    await this.apix.publishEvent('knowledge-events', {
      type: 'DOCUMENT_CREATED',
      documentId: document.id,
      knowledgeBaseId,
      organizationId,
      data: document
    });

    return document;
  }

  async uploadDocument(
    knowledgeBaseId: string,
    organizationId: string,
    file: Express.Multer.File,
    metadata?: any
  ): Promise<Document> {
    // Verify knowledge base exists and belongs to organization
    const knowledgeBase = await this.prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, organizationId }
    });

    if (!knowledgeBase) {
      throw new NotFoundException('Knowledge base not found');
    }

    let content: string;
    let type: string;

    try {
      // Extract content based on file type
      switch (file.mimetype) {
        case 'application/pdf':
          const pdfData = await pdf(file.buffer);
          content = pdfData.text;
          type = 'pdf';
          break;

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          const docxResult = await mammoth.extractRawText({ buffer: file.buffer });
          content = docxResult.value;
          type = 'docx';
          break;

        case 'text/plain':
          content = file.buffer.toString('utf-8');
          type = 'text';
          break;

        case 'text/html':
          const $ = cheerio.load(file.buffer.toString('utf-8'));
          content = $.text();
          type = 'html';
          break;

        case 'application/json':
          const jsonData = JSON.parse(file.buffer.toString('utf-8'));
          content = JSON.stringify(jsonData, null, 2);
          type = 'json';
          break;

        default:
          throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
      }

      const document = await this.prisma.document.create({
        data: {
          title: file.originalname,
          content,
          type,
          knowledgeBaseId,
          source: 'upload',
          metadata: {
            ...metadata,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            uploadedAt: new Date().toISOString()
          }
        }
      });

      // Process document asynchronously
      this.processDocumentAsync(document).catch(error => {
        this.logger.error(`Document processing failed: ${error.message}`);
      });

      await this.apix.publishEvent('knowledge-events', {
        type: 'DOCUMENT_UPLOADED',
        documentId: document.id,
        knowledgeBaseId,
        organizationId,
        data: document
      });

      return document;

    } catch (error) {
      throw new BadRequestException(`Failed to process file: ${error.message}`);
    }
  }

  async getDocuments(
    knowledgeBaseId: string,
    organizationId: string,
    filters?: {
      collectionId?: string;
      type?: string;
      search?: string;
    }
  ): Promise<Document[]> {
    // Verify knowledge base exists and belongs to organization
    const knowledgeBase = await this.prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, organizationId }
    });

    if (!knowledgeBase) {
      throw new NotFoundException('Knowledge base not found');
    }

    const where: any = { knowledgeBaseId };

    if (filters?.collectionId) {
      where.collectionId = filters.collectionId;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { content: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    return this.prisma.document.findMany({
      where,
      include: {
        collection: {
          select: { id: true, name: true }
        },
        chunks: {
          take: 3,
          orderBy: { position: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async searchDocuments(
    knowledgeBaseId: string,
    organizationId: string,
    data: z.infer<typeof SearchSchema>
  ): Promise<any> {
    const validatedData = SearchSchema.parse(data);

    // Verify knowledge base exists and belongs to organization
    const knowledgeBase = await this.prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, organizationId }
    });

    if (!knowledgeBase) {
      throw new NotFoundException('Knowledge base not found');
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(validatedData.query);

      // Search for similar document chunks
      const chunks = await this.findSimilarChunks(
        knowledgeBaseId,
        queryEmbedding,
        validatedData.limit,
        validatedData.threshold,
        validatedData.collectionIds
      );

      // Group chunks by document
      const documentMap = new Map();
      for (const chunk of chunks) {
        if (!documentMap.has(chunk.documentId)) {
          documentMap.set(chunk.documentId, {
            document: chunk.document,
            chunks: [],
            maxScore: 0
          });
        }
        
        const docData = documentMap.get(chunk.documentId);
        docData.chunks.push(chunk);
        docData.maxScore = Math.max(docData.maxScore, chunk.score);
      }

      // Sort by relevance score
      const results = Array.from(documentMap.values())
        .sort((a, b) => b.maxScore - a.maxScore)
        .slice(0, validatedData.limit);

      await this.apix.publishEvent('knowledge-events', {
        type: 'SEARCH_PERFORMED',
        knowledgeBaseId,
        organizationId,
        query: validatedData.query,
        resultCount: results.length
      });

      return {
        query: validatedData.query,
        results: results.map(result => ({
          document: result.document,
          relevanceScore: result.maxScore,
          matchingChunks: result.chunks.map(chunk => ({
            content: chunk.content,
            score: chunk.score,
            position: chunk.position
          }))
        })),
        totalResults: results.length
      };

    } catch (error) {
      this.logger.error(`Search failed: ${error.message}`);
      throw new BadRequestException(`Search failed: ${error.message}`);
    }
  }

  async deleteDocument(
    documentId: string,
    knowledgeBaseId: string,
    organizationId: string
  ): Promise<void> {
    // Verify knowledge base exists and belongs to organization
    const knowledgeBase = await this.prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, organizationId }
    });

    if (!knowledgeBase) {
      throw new NotFoundException('Knowledge base not found');
    }

    const document = await this.prisma.document.findFirst({
      where: { id: documentId, knowledgeBaseId }
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.prisma.document.delete({
      where: { id: documentId }
    });

    await this.apix.publishEvent('knowledge-events', {
      type: 'DOCUMENT_DELETED',
      documentId,
      knowledgeBaseId,
      organizationId
    });
  }

  private async processDocumentAsync(document: Document): Promise<void> {
    try {
      await this.apix.publishEvent('knowledge-events', {
        type: 'DOCUMENT_PROCESSING_STARTED',
        documentId: document.id,
        knowledgeBaseId: document.knowledgeBaseId
      });

      // Chunk the document
      const chunks = await this.chunkDocument(document);

      // Generate embeddings for each chunk
      const chunksWithEmbeddings = await Promise.all(
        chunks.map(async (chunk, index) => {
          const embedding = await this.generateEmbedding(chunk.content);
          return {
            documentId: document.id,
            content: chunk.content,
            embeddings: embedding,
            metadata: chunk.metadata || {},
            position: index
          };
        })
      );

      // Save chunks to database
      await this.prisma.documentChunk.createMany({
        data: chunksWithEmbeddings
      });

      // Update document as processed
      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          isProcessed: true,
          updatedAt: new Date()
        }
      });

      await this.apix.publishEvent('knowledge-events', {
        type: 'DOCUMENT_PROCESSING_COMPLETED',
        documentId: document.id,
        knowledgeBaseId: document.knowledgeBaseId,
        chunkCount: chunksWithEmbeddings.length
      });

    } catch (error) {
      this.logger.error(`Document processing failed: ${error.message}`);
      
      await this.apix.publishEvent('knowledge-events', {
        type: 'DOCUMENT_PROCESSING_FAILED',
        documentId: document.id,
        knowledgeBaseId: document.knowledgeBaseId,
        error: error.message
      });
    }
  }

  private async chunkDocument(document: Document): Promise<Array<{ content: string; metadata?: any }>> {
    const content = document.content;
    const chunks = [];
    
    // Simple chunking strategy - split by paragraphs and sentences
    const paragraphs = content.split(/\n\s*\n/);
    
    for (const paragraph of paragraphs) {
      if (paragraph.trim().length < 50) continue; // Skip very short paragraphs
      
      // If paragraph is too long, split by sentences
      if (paragraph.length > 1000) {
        const sentences = paragraph.split(/[.!?]+/);
        let currentChunk = '';
        
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > 1000 && currentChunk.length > 0) {
            chunks.push({
              content: currentChunk.trim(),
              metadata: { type: 'sentence_group' }
            });
            currentChunk = sentence;
          } else {
            currentChunk += (currentChunk ? '. ' : '') + sentence;
          }
        }
        
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            metadata: { type: 'sentence_group' }
          });
        }
      } else {
        chunks.push({
          content: paragraph.trim(),
          metadata: { type: 'paragraph' }
        });
      }
    }
    
    return chunks;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text
      });

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(`Embedding generation failed: ${error.message}`);
      throw new BadRequestException('Failed to generate embedding');
    }
  }

  private async findSimilarChunks(
    knowledgeBaseId: string,
    queryEmbedding: number[],
    limit: number,
    threshold: number,
    collectionIds?: string[]
  ): Promise<any[]> {
    // In a production environment, you would use a vector database like Pinecone, Weaviate, or pgvector
    // For this implementation, we'll use a simplified approach with PostgreSQL
    
    let whereClause = `d.knowledge_base_id = $1`;
    const params = [knowledgeBaseId];
    
    if (collectionIds && collectionIds.length > 0) {
      whereClause += ` AND d.collection_id = ANY($${params.length + 1})`;
      params.push(collectionIds);
    }

    // This is a simplified similarity search - in production, use proper vector similarity
    const query = `
      SELECT 
        dc.*,
        d.title,
        d.type,
        d.source,
        d.url,
        c.name as collection_name,
        -- Simplified cosine similarity calculation
        (
          SELECT SUM(a.val * b.val) / (
            SQRT(SUM(a.val * a.val)) * SQRT(SUM(b.val * b.val))
          )
          FROM jsonb_array_elements_text(dc.embeddings) WITH ORDINALITY a(val, idx)
          JOIN jsonb_array_elements_text($${params.length + 1}) WITH ORDINALITY b(val, idx) ON a.idx = b.idx
        ) as score
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      LEFT JOIN collections c ON d.collection_id = c.id
      WHERE ${whereClause}
        AND dc.embeddings IS NOT NULL
      ORDER BY score DESC
      LIMIT $${params.length + 2}
    `;

    params.push(JSON.stringify(queryEmbedding));
    params.push(limit);

    try {
      // This would be executed with proper vector similarity in production
      // For now, return mock results
      const chunks = await this.prisma.documentChunk.findMany({
        where: {
          document: {
            knowledgeBaseId,
            ...(collectionIds && collectionIds.length > 0 ? {
              collectionId: { in: collectionIds }
            } : {})
          }
        },
        include: {
          document: {
            include: {
              collection: {
                select: { id: true, name: true }
              }
            }
          }
        },
        take: limit
      });

      // Add mock similarity scores
      return chunks.map(chunk => ({
        ...chunk,
        score: Math.random() * 0.3 + 0.7 // Mock score between 0.7-1.0
      })).filter(chunk => chunk.score >= threshold);

    } catch (error) {
      this.logger.error(`Vector search failed: ${error.message}`);
      return [];
    }
  }

  async getKnowledgeBaseAnalytics(
    knowledgeBaseId: string,
    organizationId: string
  ): Promise<any> {
    const knowledgeBase = await this.getKnowledgeBase(knowledgeBaseId, organizationId);

    const documentCount = await this.prisma.document.count({
      where: { knowledgeBaseId }
    });

    const collectionCount = await this.prisma.collection.count({
      where: { knowledgeBaseId }
    });

    const chunkCount = await this.prisma.documentChunk.count({
      where: {
        document: { knowledgeBaseId }
      }
    });

    const processedDocuments = await this.prisma.document.count({
      where: { knowledgeBaseId, isProcessed: true }
    });

    const documentsByType = await this.prisma.document.groupBy({
      by: ['type'],
      where: { knowledgeBaseId },
      _count: { type: true }
    });

    return {
      knowledgeBase,
      documentCount,
      collectionCount,
      chunkCount,
      processedDocuments,
      processingRate: documentCount > 0 ? (processedDocuments / documentCount) * 100 : 0,
      documentsByType: documentsByType.map(item => ({
        type: item.type,
        count: item._count.type
      }))
    };
  }
}