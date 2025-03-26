import { NextFunction, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import trinoService from '../services/trinoService';
import { getDatabaseSchema } from '../utils/schemaformater';
import { stringify } from 'querystring';

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
    
    // Dynamically fetch schema 
    const { rawData, processedRows } = await getDatabaseSchema(connectionId, connection.catalog);
    console.log(`Fetched schema rows: ${processedRows.length}`);
    
    // Prepare the system prompt
    const systemPrompt = `You are an AI assistant that generates TrinoSQL queries. 
    The user is connected to a Trino database with the following details:
    - Catalog: ${connection.catalog}
    - Schema: ${connection.schema}
    - Tables and Columns: ${JSON.stringify(rawData, null, 2)}
    
    Generate a valid TrinoSQL query based on the user's request. 
    ONLY the SQL query without any explanation or comments.
    INSTRUCTIONS:
1. Generate a valid TrinoSQL query that precisely matches the user's request
2. Use EXACT table and column names as provided in the schema details - do not modify or assume names
3. Pay special attention to singular/plural forms (use "project" not "projects" if that's how it's defined)
4. Include appropriate Trino joins when information is needed from multiple tables
5. Add appropriate filtering conditions based on user's request
6. Use appropriate TrinoSQL functions and operators when needed (COUNT, SUM, GROUP BY, etc.)
7.  ONLY the SQL query without any explanation, markdown formatting, or comments
IMPORTANT: Use ONLY the exact table and column names provided in the schema details. Use <catalog>.<schema>.tablename when executing queries on tables`    
    
    //console.log('systemPrompt:', systemPrompt);
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
