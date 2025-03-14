import { NextFunction, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import trinoService from '../services/trinoService';
import { formatSchemaForPrompt, getDatabaseSchema } from '../utils/schemaformater';

// Initialize Gemini API
const API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

export const generateQuery = async (req: Request, res: Response, next?: NextFunction) => {
  const { prompt, connectionId } = req.body;
  
  try {
    const connectionResult = await trinoService.getConnection(connectionId);
    if (!connectionResult.success) {
       res.status(404).json({ message: "Connection not found", error: connectionResult.error });
    }

    const connection = connectionResult.connection;

    const schemaInfo = await getDatabaseSchema(connectionId, connection.catalog);
    const formattedSchema = formatSchemaForPrompt(schemaInfo);


    const systemPrompt = `You are an AI assistant that generates TrinoSQL queries. 
    The user is connected to a Trino database with the following details:
    - Catalog: ${connection.catalog}
    - Schema: ${connection.schema}
    - Tables and Columns: ${formattedSchema}
    
    Generate a valid TrinoSQL query based on the user's request. 
     ONLY the SQL query without any explanation or comments.`;
    console.log("SYSPROMTP" + systemPrompt);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: prompt }
    ]);

    const query = result.response.text();

    res.status(200).json({ 
      message: "Query generated successfully", 
      query,
      connectionId 
    });
  } catch (error) {
    console.error('Generate query failed:', error);
    res.status(500).json({ 
      message: "Failed to generate query", 
      error: (error as Error).message 
    });
  }
};

export const generateAndExecuteQuery = async (req: Request, res: Response, next?: NextFunction) => {
  const { prompt, connectionId } = req.body;
  
  try {
    // First generate the query
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    // Get connection details for context
    const connectionResult = await trinoService.getConnection(connectionId);
    if (!connectionResult.success) {
       res.status(404).json({ message: "Connection not found", error: connectionResult.error });
    }
    
    const connection = connectionResult.connection;
    
    // Generate a system prompt with the connection details
    const systemPrompt = `You are an AI assistant that generates TrinoSQL queries. 
    The user is connected to a Trino database with the following details:
    - Catalog: ${connection.catalog}
    - Schema: ${connection.schema}
    
    Generate a valid TrinoSQL query based on the user's request. 
     ONLY the SQL query without any explanation or comments.`;
    
    // Generate the query using Gemini
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: prompt }
    ]);
    
    const query = result.response.text();
    
    // Then execute the query
    const executionResult = await trinoService.executeQuery(connectionId, query);
    
    if (executionResult.success) {
      res.status(200).json({
        message: "Query generated and executed successfully",
        query,
        result: executionResult.result
      });
      ;
    } else {
      res.status(500).json({
        message: "Query generated but execution failed",
        query,
        error: executionResult.error
      });
      ;
    }
  } catch (error) {
    console.error('Generate and execute query failed:', error);
    res.status(500).json({ 
      message: "Failed to generate or execute query", 
      error: (error as Error).message 
    });
    ;
  }
};
