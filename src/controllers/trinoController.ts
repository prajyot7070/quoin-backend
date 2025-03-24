import { Request, Response } from 'express';
import trinoService from '../services/trinoService';
import { QueryIterator } from 'trino-client';
import { PrismaClient } from "@prisma/client";

import prisma from '../config/db';

export const testConnection = async (req: Request, res: Response) => {
  const { server, catalog, schema } = req.body;
  try {
    const result = await trinoService.testConnection({
      server,
      catalog,
      schema,
    });
    if (result.success) {
      res.status(200).json({ message: "Connection successful", result: result.result });
    } else {
      res.status(500).json({ message: "Connection failed", error: result.error });
    }
  } catch (error) {
    res.status(500).json({ message: "An unexpected error occurred", error: (error as Error).message });
  }
};

export const getProject = async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    console.log(`Project Id extracted :- ${projectId}`);
    
    if (isNaN(projectId)) {
      res.status(400).json({ message: "Invalid project ID" });
      return;
    }
    
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        connections: {
          select: {
            id: true,
            name: true,
            server: true,
            catalog: true,
            schema: true,
            source: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });
    
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }
    
    res.status(200).json({
      message: "Project retrieved successfully",
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        user: project.user,
        connections: project.connections,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      }
    });
  } catch (error) {
    console.error('Get project failed:', error);
    res.status(500).json({ 
      message: "Failed to retrieve project", 
      error: (error instanceof Error ? error.message : String(error))
    });
  }
};export const createProject = async (req: Request, res: Response) => {
  const { name, description, userId } = req.body;
  try {
    const result = await trinoService.createProject({
      name,
      description,
      userId
    });
    if (result.success) {
      res.status(201).json({ message: "Project created successfully", project: result.project });
    } else {
      res.status(500).json({ message: "Failed to create project", error: result.error });
    }
  } catch (error) {
    res.status(500).json({ message: "An unexpected error occurred", error: (error as Error).message });
  }
};

export const createConnection = async (req: Request, res: Response) => {
  const { name, server, catalog, schema, projectId } = req.body;
  try {
    const result = await trinoService.createConnection({
      name,
      server,
      catalog,
      schema,
      projectId
    });
    if (result.success) {
      res.status(201).json({ message: "Connection created successfully", connection: result.connection });
    } else {
      res.status(500).json({ message: "Failed to create connection", error: result.error });
    }
  } catch (error) {
    res.status(500).json({ message: "An unexpected error occurred", error: (error as Error).message });
  }
};

export const executeQuery = async (req: Request, res: Response) => {
  const { connectionId, query } = req.body;
  try {
    const result = await trinoService.executeQuery(connectionId, query);
    const rows = [];
    
    // Add defensive checks
    if (result.success && result.result) {
      if (typeof result.result[Symbol.asyncIterator] === 'function') {
        // If it's an async iterable as expected
        for await (const row of result.result) {
          rows.push(row);
        }
      } else if (Array.isArray(result.result)) {
        // If it's already an array
        rows.push(...result.result);
      } else if (result.result.rows) {
        // Some clients return data in a 'rows' property
        rows.push(...result.result.rows);
      } else {
        // Just return whatever we got
        res.status(200).json({ 
          message: "Query executed successfully", 
          result: result,
          data: result.result 
        });
      }
      
      res.status(200).json({ 
        message: "Query executed successfully", 
        result: result, 
        data: rows 
      });
    } else {
      res.status(500).json({ 
        message: "Failed to execute query", 
        error: result 
      });
    }
  } catch (error) {
    console.error('Execute query error:', error);
    res.status(500).json({ 
      message: "An unexpected error occurred", 
      error: (error as Error).message,
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    });
  }
};
