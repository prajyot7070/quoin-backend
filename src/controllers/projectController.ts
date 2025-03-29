import { Request, Response } from 'express';
import prisma from '../config/db';
import { createTrinoClient, TrinoConfig } from "../config/trino";
import { Pool } from 'pg'; // For PostgreSQL testing

export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      name, 
      description, 
      organizationId, 
      connectionType,
      connectionDetails 
    } = req.body;
    const userId = req.users?.id;
    
    // Test connection based on type
    try {
      if (connectionType === 'trino') {
        const trinoConfig: TrinoConfig = {
          server: connectionDetails.server,
          catalog: connectionDetails.catalog,
          schema: connectionDetails.schema,
          extraHeaders: {
            'X-Trino-User': 'trino_user',
            ...(connectionDetails.headers || {})
          },
          auth: connectionDetails.auth,
          ssl: connectionDetails.ssl,
          source: connectionDetails.source
        };
        
        const client = await createTrinoClient(trinoConfig);
        await client.query('SELECT 1 AS success');
      } 
//      else if (connectionType === 'postgres' || connectionType === 'neon') {
//        const { host, port, database, user, password } = connectionDetails.auth;
//        
//        const pool = new Pool({
//          host,
//          port,
//          database,
//          user,
//          password,
//          ssl: connectionDetails.ssl || undefined
//        });
//        
//        // Test connection
//        const client = await pool.connect();
//        await client.query('SELECT 1');
//        client.release();
//        await pool.end();
//      } 
      else if (connectionType === 'supabase') {
        const { url, apiKey } = connectionDetails.auth;
        
        // Test Supabase connection using fetch
        const response = await fetch(`${url}/rest/v1/?apikey=${apiKey}`, {
          headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`Supabase connection failed: ${response.statusText}`);
        }
      } 
      else if (connectionType === 'firebase') {
        const { projectId, apiKey } = connectionDetails.auth;
        
        // Test Firebase connection with a simple REST call
        const response = await fetch(
          `https://firebaseio.com/${projectId}/.json?auth=${apiKey}`
        );
        
        if (!response.ok) {
          throw new Error(`Firebase connection failed: ${response.statusText}`);
        }
      }
    } catch (error) {
      res.status(400).json({ 
        success: false, 
        message: `Connection test failed for ${connectionType}`, 
        error: (error as Error).message 
      });
      return;
    }

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    
    // Create project and connection
    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name,
          description,
          userId,
          organizationId
        }
      });
      
      const connection = await tx.connection.create({
        data: {
          name: connectionDetails.name,
          server: connectionDetails.server || '',
          catalog: connectionDetails.catalog || 'default',
          schema: connectionDetails.schema || 'public',
          projectId: project.id,
          source: connectionType,
          auth: connectionDetails.auth || {},
          extraHeaders: connectionDetails.extraHeaders || {},
          ssl: connectionDetails.ssl || {},
          extraCredential: connectionDetails.extraCredential || {},
          session: connectionDetails.session || {}
        }
      });
      
      return { project, connection };
    });
    
    res.status(201).json({
      success: true,
      project: result.project,
      connection: result.connection
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ message: "Failed to create project" });
  }
};

export const getProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.id;
    
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
        },
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }
    
    res.status(200).json({
      success: true,
      project
    });
  } catch (error) {
    console.error('Get project failed:', error);
    res.status(500).json({ 
      message: "Failed to retrieve project", 
      error: (error as Error).message 
    });
  }
};

export const getProjectsForOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.params.organizationId;
    
    const projects = await prisma.project.findMany({
      where: { 
        organizationId,
        deletedAt: null
      },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        },
        connections: {
          select: {
            id: true,
            name: true,
            source: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    res.status(200).json({
      success: true,
      projects
    });
  } catch (error) {
    console.error('Get organization projects failed:', error);
    res.status(500).json({ 
      message: "Failed to retrieve projects", 
      error: (error as Error).message 
    });
  }
};

export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.id;
    const userId = req.users?.id;

    // Get user's role in the organization that owns this project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { organization: true }
    });

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId: project.organizationId
      }
    });

    // Check if user is ADMIN
    if (!membership || membership.role !== 'ADMIN') {
      res.status(403).json({ message: "Only administrators can delete projects" });
      return;
    }

    // Soft delete
    await prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() }
    });

    res.status(200).json({
      success: true,
      message: "Project deleted successfully"
    });
  } catch (error) {
    console.error('Delete project failed:', error);
    res.status(500).json({ 
      message: "Failed to delete project", 
      error: (error as Error).message 
    });
  }
};
