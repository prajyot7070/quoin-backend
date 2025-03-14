import { NextFunction, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import trinoService from '../services/trinoService';
import { formatSchemaForPrompt, getDatabaseSchema } from '../utils/schemaformater';
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

    const schemaInfo = await getDatabaseSchema(connectionId, connection.catalog);
    const formattedSchema = `[
  {
    "table_schema": "public",
    "table_name": "_prisma_migrations",
    "column_name": "id",
    "data_type": "varchar(36)"
  },
  {
    "table_schema": "public",
    "table_name": "_prisma_migrations",
    "column_name": "checksum",
    "data_type": "varchar(64)"
  },
  {
    "table_schema": "public",
    "table_name": "_prisma_migrations",
    "column_name": "finished_at",
    "data_type": "timestamp(6) with time zone"
  },
  {
    "table_schema": "public",
    "table_name": "_prisma_migrations",
    "column_name": "migration_name",
    "data_type": "varchar(255)"
  },
  {
    "table_schema": "public",
    "table_name": "_prisma_migrations",
    "column_name": "logs",
    "data_type": "varchar"
  },
  {
    "table_schema": "public",
    "table_name": "_prisma_migrations",
    "column_name": "rolled_back_at",
    "data_type": "timestamp(6) with time zone"
  },
  {
    "table_schema": "public",
    "table_name": "_prisma_migrations",
    "column_name": "started_at",
    "data_type": "timestamp(6) with time zone"
  },
  {
    "table_schema": "public",
    "table_name": "_prisma_migrations",
    "column_name": "applied_steps_count",
    "data_type": "integer"
  },
  {
    "table_schema": "public",
    "table_name": "connection",
    "column_name": "id",
    "data_type": "integer"
  },
  {
    "table_schema": "public",
    "table_name": "connection",
    "column_name": "name",
    "data_type": "varchar"
  },
  {
    "table_schema": "public",
    "table_name": "connection",
    "column_name": "server",
    "data_type": "varchar"
  },
  {
    "table_schema": "public",
    "table_name": "connection",
    "column_name": "catalog",
    "data_type": "varchar"
  },
  {
    "table_schema": "public",
    "table_name": "connection",
    "column_name": "schema",
    "data_type": "varchar"
  },
  {
    "table_schema": "public",
    "table_name": "connection",
    "column_name": "projectid",
    "data_type": "integer"
  },
  {
    "table_schema": "public",
    "table_name": "connection",
    "column_name": "auth",
    "data_type": "json"
  },
  {
    "table_schema": "public",
    "table_name": "connection",
    "column_name": "extracredential",
    "data_type": "json"
  },
  {
    "table_schema": "public",
    "table_name": "connection",
    "column_name": "extraheaders",
    "data_type": "json"
  },
  {
    "table_schema": "public",
    "table_name": "connection",
    "column_name": "session",
    "data_type": "json"
  },
  {
    "table_schema": "public",
    "table_name": "connection",
    "column_name": "source",
    "data_type": "varchar"
  },
  {
    "table_schema": "public",
    "table_name": "connection",
    "column_name": "ssl",
    "data_type": "json"
  },
  {
    "table_schema": "public",
    "table_name": "connection",
    "column_name": "createdat",
    "data_type": "timestamp(3)"
  },
  {
    "table_schema": "public",
    "table_name": "connection",
    "column_name": "updatedat",
    "data_type": "timestamp(3)"
  },
  {
    "table_schema": "public",
    "table_name": "organization",
    "column_name": "id",
    "data_type": "integer"
  },
  {
    "table_schema": "public",
    "table_name": "organization",
    "column_name": "name",
    "data_type": "varchar"
  },
  {
    "table_schema": "public",
    "table_name": "organization",
    "column_name": "email",
    "data_type": "varchar"
  },
  {
    "table_schema": "public",
    "table_name": "organization",
    "column_name": "createdat",
    "data_type": "timestamp(3)"
  },
  {
    "table_schema": "public",
    "table_name": "organization",
    "column_name": "updatedat",
    "data_type": "timestamp(3)"
  },
  {
    "table_schema": "public",
    "table_name": "project",
    "column_name": "id",
    "data_type": "integer"
  },
  {
    "table_schema": "public",
    "table_name": "project",
    "column_name": "name",
    "data_type": "varchar"
  },
  {
    "table_schema": "public",
    "table_name": "project",
    "column_name": "description",
    "data_type": "varchar"
  },
  {
    "table_schema": "public",
    "table_name": "project",
    "column_name": "userid",
    "data_type": "integer"
  },
  {
    "table_schema": "public",
    "table_name": "project",
    "column_name": "createdat",
    "data_type": "timestamp(3)"
  },
  {
    "table_schema": "public",
    "table_name": "project",
    "column_name": "updatedat",
    "data_type": "timestamp(3)"
  },
  {
    "table_schema": "public",
    "table_name": "users",
    "column_name": "id",
    "data_type": "integer"
  },
  {
    "table_schema": "public",
    "table_name": "users",
    "column_name": "email",
    "data_type": "varchar"
  },
  {
    "table_schema": "public",
    "table_name": "users",
    "column_name": "password",
    "data_type": "varchar"
  },
  {
    "table_schema": "public",
    "table_name": "users",
    "column_name": "name",
    "data_type": "varchar"
  },
  {
    "table_schema": "public",
    "table_name": "users",
    "column_name": "role",
    "data_type": "varchar"
  },
  {
    "table_schema": "public",
    "table_name": "users",
    "column_name": "organizationid",
    "data_type": "integer"
  },
  {
    "table_schema": "public",
    "table_name": "users",
    "column_name": "createdat",
    "data_type": "timestamp(3)"
  },
  {
    "table_schema": "public",
    "table_name": "users",
    "column_name": "updatedat",
    "data_type": "timestamp(3)"
  }
]
 `

    const systemPrompt = `You are an AI assistant that generates TrinoSQL queries. 
    The user is connected to a Trino database with the following details:
    - Catalog: ${connection.catalog}
    - Schema: ${connection.schema}
    - Tables and Columns: ${formattedSchema}
    
    Generate a valid TrinoSQL query based on the user's request. 
     ONLY the SQL query without any explanation or comments.
    
INSTRUCTIONS:
1. Generate a valid TrinoSQL query that precisely matches the user's request
2. Use EXACT table and column names as provided in the schema details - do not modify or assume names
3. Pay special attention to singular/plural forms (use "project" not "projects" if that's how it's defined)
4. Include appropriate Trino joins when information is needed from multiple tables
5. Add appropriate filtering conditions based on user's request
6. Use appropriate TrinoSQL functions and operators when needed (COUNT, SUM, GROUP BY, etc.)
7. Return ONLY the SQL query without any explanation, markdown formatting, or comments

IMPORTANT: Use ONLY the exact table and column names provided in the schema details. Use <catalog>.<schema>.tablename when executing queries on tables. `;

    console.log(`=========================================================\n System Prompt (aiController.ts) :- ${systemPrompt}`);

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
