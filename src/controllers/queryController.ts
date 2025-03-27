import { Request, Response } from 'express';
import prisma from '../config/db';
import { createTrinoClient, TrinoConfig } from '../config/trino';
import { Pool } from 'pg';
import { sanitizeSqlQuery } from '../utils/sanitizeSqlQuery';

/**
 * Execute a query against a database connection
 */
export async function executeQuery(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  
  try {
    const { query, connectionId } = req.body;
    const userId = req.users?.id;

    if (!query || !connectionId) {
      res.status(400).json({ message: "Query and connectionId are required" });
      return;
    }

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Get connection details
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
      include: {
        project: true
      }
    });

    if (!connection) {
      res.status(404).json({ message: "Connection not found" });
      return;
    }

    // Check user permissions
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId: connection.project.organizationId
      }
    });

    if (!membership) {
      res.status(403).json({ message: "User has no access to this organization" });
      return;
    }
    
    // VIEWER role security check - prevent DML/DDL operations
    if (membership.role === 'VIEWER') {
      const queryUpper = query.toUpperCase();
      const forbiddenOps = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE'];
      
      if (forbiddenOps.some(op => queryUpper.includes(op))) {
        res.status(403).json({ 
          message: "Viewers can only execute SELECT queries", 
          error: "Forbidden operation detected" 
        });
        return;
      }
    }
    
    let queryResult;
    let error = null;
    let resultSize = 0;
    
    // Execute query based on connection type
    try {
      if (connection.source === 'trino') {
        const trinoConfig: TrinoConfig = {
          server: connection.server,
          catalog: connection.catalog,
          schema: connection.schema,
          extraHeaders: {
            'X-Trino-User': 'trino_user',
          },
          auth: connection.auth as Record<string, any> || {},
          ssl: connection.ssl as Record<string, any> || {},
          source: connection.source
        };
        console.error(`connectionConfig :- ${trinoConfig}`);
        const client = await createTrinoClient(trinoConfig);
        const result = await client.query(query);
        
        // Handle Trino's iterator result format
        const rows = [];
        if (result && typeof result[Symbol.asyncIterator] === 'function') {
          for await (const row of result) {
            rows.push(row);
          }
        }
        queryResult = { rows };
        if (rows) { console.error(`Executed!!!`); }
        resultSize = rows.length;
        if (resultSize) console.error(`resultSize :- ${resultSize}`);
      } 
      else if (connection.source === 'postgres' || connection.source === 'neon') {
        const auth = connection.auth as Record<string, any>;
        const ssl = connection.ssl as Record<string, any>;
        
        const pool = new Pool({
          host: auth.host,
          port: auth.port,
          database: auth.database,
          user: auth.user,
          password: auth.password,
          ssl: Object.keys(ssl).length > 0 ? ssl : undefined
        });
        
        const client = await pool.connect();
        queryResult = await client.query(query);
        resultSize = queryResult.rowCount || 0;
        client.release();
        await pool.end();
      }
      else if (connection.source === 'supabase') {
        const auth = connection.auth as Record<string, any>;
        
        const response = await fetch(`${auth.url}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': auth.apiKey,
            'Authorization': `Bearer ${auth.apiKey}`
          },
          body: JSON.stringify({ query })
        });
        
        if (!response.ok) {
          throw new Error(`Supabase query failed: ${response.statusText}`);
        }
        
        queryResult = await response.json();
        resultSize = Array.isArray(queryResult) ? queryResult.length : 0;
      }
      else {
        throw new Error(`Unsupported connection type: ${connection.source}`);
      }
    } catch (err) {
      error = (err as Error).message;
      queryResult = null;
    }
    
    // Calculate execution time
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // Convert to seconds
    
    // Log the executed query
    const executedQuery = await prisma.executedQuery.create({
      data: {
        query,
        userId,  // Now we're sure userId is defined
        projectId: connection.projectId,
        connectionId,
        status: error ? 'ERROR' : 'SUCCESS',
        duration,
        error: error,
        resultSize
      }
    });
    
    if (error) {
      console.error(`${error}`)
      res.status(400).json({
        success: false,
        message: "Query execution failed",
        error,
        executedQueryId: executedQuery.id
      });
    } else {
      res.status(200).json({
        success: true,
        result: queryResult,
        executionTime: duration,
        executedQueryId: executedQuery.id
      });
    }
  } catch (error) {
    console.error('Execute query failed:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to execute query", 
      error: (error as Error).message 
    });
  }
}

/**
 * Get query execution history for a project
 */
export async function getQueryHistory(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.params;
    const userId = req.users?.id;
    
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    
    // Verify project exists and user has access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { organization: true }
    });
    
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }
    
    // Check user membership in organization
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId: project.organizationId
      }
    });
    
    if (!membership) {
      res.status(403).json({ message: "User has no access to this organization" });
      return;
    }
    
    // Get query history
    const executedQueries = await prisma.executedQuery.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        connection: {
          select: { id: true, name: true, source: true }
        },
        feedbacks: {
          select: {
            id: true,
            rating: true,
            text: true,
            createdAt: true
          }
        }
      },
      orderBy: { executedAt: 'desc' },
      take: 100  // Limit to recent queries
    });
    
    res.status(200).json({
      success: true,
      executedQueries
    });
  } catch (error) {
    console.error('Get query history failed:', error);
    res.status(500).json({ 
      message: "Failed to retrieve query history", 
      error: (error as Error).message 
    });
  }
}

/**
 * Provide feedback for an executed query
 */
export async function provideFeedback(req: Request, res: Response): Promise<void> {
  try {
    const { executedQueryId, rating, text } = req.body;
    const userId = req.users?.id;
    
    if (!executedQueryId || rating === undefined) {
      res.status(400).json({ message: "ExecutedQueryId and rating are required" });
      return;
    }
    
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    
    // Verify query exists and user has access
    const executedQuery = await prisma.executedQuery.findUnique({
      where: { id: executedQueryId },
      include: { project: true }
    });
    
    if (!executedQuery) {
      res.status(404).json({ message: "Query not found" });
      return;
    }
    
    // Check membership in organization
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId: executedQuery.project.organizationId
      }
    });
    
    if (!membership) {
      res.status(403).json({ message: "User has no access to this organization" });
      return;
    }
    
    // Create feedback
    const feedback = await prisma.queryFeedback.create({
      data: {
        executedQueryId,
        rating,
        text: text || null,
        userId,
        rawQuery: executedQuery.query
      }
    });
    
    res.status(201).json({
      success: true,
      feedback
    });
  } catch (error) {
    console.error('Provide feedback failed:', error);
    res.status(500).json({ 
      message: "Failed to save feedback", 
      error: (error as Error).message 
    });
  }
}

export default {
  executeQuery,
  getQueryHistory,
  provideFeedback
};
