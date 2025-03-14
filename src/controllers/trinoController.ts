import { Request, Response } from 'express';
import trinoService from '../services/trinoService';
import { QueryIterator } from 'trino-client';

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

export const createProject = async (req: Request, res: Response) => {
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
    for await (const row of result.result) {
      rows.push(row);
    }
    if (result.success) {
      res.status(200).json({ message: "Query executed successfully", result: result, data: rows });
    } else {
      res.status(500).json({ message: "Failed to execute query", error: result });
    }
  } catch (error) {
    res.status(500).json({ message: "An unexpected error occurred", error: (error as Error).message });
  }
};
