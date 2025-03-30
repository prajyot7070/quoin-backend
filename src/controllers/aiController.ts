import { Request, Response } from 'express';
import { diffChars } from 'diff';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../config/db';
import { sanitizeSqlQuery } from '../utils/sanitizeSqlQuery';
import { createTrinoClient, TrinoConfig } from '../config/trino';
//import { processTrinoSchemaResponse, SchemaRow } from '../utils/schemaformater';
import { getCachedSchema } from './cacheController';
import { createClient } from '@supabase/supabase-js';
import { error } from 'console';
import { json } from 'stream/consumers';

const API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

// Base context for generating good database queries
const baseContext = `You are an AI assistant that specializes in generating highly efficient SQL queries and schema designs.
INSTRUCTIONS:
1. Generate valid SQL queries that precisely match the user's request
2. Use EXACT table and column names as provided in the schema details
3. Pay special attention to singular/plural forms in table names
4. Include appropriate joins when information is needed from multiple tables
5. Add appropriate filtering conditions based on user's request
6. Use appropriate SQL functions and operators when needed (COUNT, SUM, GROUP BY, etc.)
7. Focus on performance and efficiency in your queries
8. Incorporate query optimization techniques specific to the dialect
9. Do not include any explanation, markdown formatting, or comments in your response
10. Return ONLY the SQL query and do not add /n or any other formatting characters just the raw sql query.`;

// Additional dialect-specific contexts
const dialectContexts = {
  trino: `This is a Trino SQL query. Optimize accordingly:
1. Always use <catalog>.<schema>.tablename syntax when referring to tables
2. Use Trino-specific functions like UNNEST for array operations
3. Leverage Trino's array and map functions for complex data structures
4. Use TABLESAMPLE when working with large datasets that don't require exact results
5. For table definitions, use WITH (partitioned_by = ARRAY['column']) for partitioning
6. Implement proper bucketing with WITH (bucketed_by = ARRAY['column'], bucket_count = N)
7. Use approximate functions (approx_distinct, approx_percentile) for large datasets
8. Leverage GROUPING SETS, CUBE, or ROLLUP for multi-dimensional aggregations`,
  
  spark: `This is a Spark SQL query. Optimize accordingly:
1. Use Spark-specific functions like EXPLODE for array operations
2. Optimize joins with broadcast hints when appropriate: /*+ BROADCAST(table) */
3. For table definitions, use PARTITIONED BY (column) for partitioning
4. Implement proper data clustering with CLUSTERED BY (columns) INTO N BUCKETS
5. Specify STORED AS PARQUET (or other columnar formats) for better performance
6. Use window functions with proper partitioning and ordering
7. Leverage Spark's approximate functions for large datasets
8. Consider data skew and use SKEW('column', 'value') when applicable`,
  
  postgres: `This is a PostgreSQL query. Optimize accordingly:
1. Use PostgreSQL's rich feature set including CTEs and window functions
2. Leverage PostgreSQL's JSON/JSONB functions for complex data operations
3. Use proper indexing hints when appropriate
4. Implement table partitioning with PARTITION BY RANGE/LIST/HASH
5. Use EXPLAIN ANALYZE to suggest performance optimizations
6. Consider materialized views for complex aggregations
7. Use appropriate PostgreSQL-specific data types (like JSONB, ARRAY, etc.)
8. Leverage Common Table Expressions (CTEs) for complex queries`
};

// OLAP-specific context
const olapContext = `Optimize this schema/query for OLAP (Online Analytical Processing) workloads:
1. Implement star or snowflake schema design with clear fact and dimension tables
2. Use appropriate partitioning strategies based on common query patterns:
   - Date/time-based partitioning for time-series data
   - Geographic partitioning for location-based queries
3. Implement columnar storage formats (Parquet, ORC) for better compression and query performance
4. Use proper bucketing/clustering on high-cardinality join columns
5. Pre-aggregate common metrics at various granularities
6. Optimize sort orders within partitions for better data locality
7. Denormalize where appropriate to reduce expensive joins
8. Consider materialized views for frequently accessed aggregations
9. Use proper data types to minimize storage (e.g., INT vs BIGINT when appropriate)
10. Implement appropriate indexing strategies for dimension tables`;

// DML security context (for viewers)
const viewerSecurityContext = `IMPORTANT SECURITY RESTRICTION:
This user has VIEW-ONLY permissions. 
DO NOT generate any queries that modify the database (INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, etc.).
Generate only SELECT statements that read data.`;

export async function generateQuery(req: Request, res: Response): Promise<void> {
  try {
    const { 
      prompt, 
      connectionId, 
      dialect = 'trino',
      optimizeForOLAP = false,
    } = req.body;
    const userId = req.users?.id;
    console.log(`Dialect - ${dialect} \n Prompt - ${prompt} \n connectionId - ${connectionId}`);

    // Validate request data
    if (!prompt || !connectionId) {
      res.status(400).json({ 
        message: "Missing required fields", 
        error: "Prompt and connectionId are required" 
      });
      return;
    }

    // Get connection details
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
      include: {
        project: {
          include: {
            organization: true
          }
        }
      }
    });

    

    if (!connection) {
      res.status(404).json({ 
        message: "Connection not found" 
      });
      return;
    }

    console.log(`Connection details fetched \n Connection - ${connection}`);

    // Check user permissions for DML security
    const userMembership = await prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId: connection.project.organizationId
      }
    });

    //if (cachedSchema) console.log(`Got cachedSchema`);
    let processedRows = [];
    let schemaContext;
   
    if (dialect == 'trino') {
      console.log(`Inside trino`)
    // Try to get cached schema first
    const cachedSchema = await getCachedSchema(connectionId);
	    // If no cached schema, fetch it using the original method
	    if (!cachedSchema) {
	      const trinoConfig: TrinoConfig = {
	        server: connection.server,
	        catalog: connection.catalog,
	        schema: connection.schema,
	        source: connection.source || undefined,
	        extraHeaders: {
	          'X-Trino-User': 'trino_user',
	        }
	      };
	      
	      const client = await createTrinoClient(trinoConfig);
	      const queryDatabaseSchema = `
	        SELECT
	          t.table_schema,
	          t.table_name,
	          c.column_name,
	          c.data_type
	        FROM
	          ${connection.catalog}.information_schema.tables AS t
	        JOIN
	          ${connection.catalog}.information_schema.columns AS c
	        ON
	          t.table_schema = c.table_schema AND t.table_name = c.table_name
	        WHERE
	          t.table_schema NOT IN ('information_schema', 'pg_catalog') AND t.table_type = 'BASE TABLE'
	        ORDER BY
	          t.table_schema, t.table_name, c.ordinal_position`;
	      
	      const resultIterator = await client.query(queryDatabaseSchema);
	      processedRows = await processTrinoSchemaResponse(resultIterator);
	    } else {
	      processedRows = cachedSchema.tables;
	      //console.log('Using cached schema');
	    }
	    
	    //console.log(`Fetched schema for ${processedRows.length} tables`);
	    schemaContext = processedRows.map(row => 
	      `${row.table_schema},${row.table_name},${row.column_name},${row.data_type}`
	    ).join('\n');
    } else if(dialect == 'postgre') {
        console.log(`Inside postgres`);
        if(connection.source == 'supabase') {
        console.log(`Inside supabase`);
          // Try to get cached schema first
			    //const cachedSchema = await getCachedSchema(connectionId);
          let cachedSchema;
          //let schemaContext;
          //schema not received query database for schema and cache it
            if (!cachedSchema) {
              const auth = connection.auth as {url: string; apiKey: string};
              let { url , apiKey } = auth; 
              if (!url || !apiKey) {
                console.error("Supabase apikey or URL is missing");
              }
              apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvdWV5aGxob3ZmcnJkYXpwdnhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMDkwMTYzNSwiZXhwIjoyMDM2NDc3NjM1fQ.fzZz5u_iL_epqDE7sM_h3un4fnsDfE_pgbqi3To_U6o";
              console.log(`Creating supabase client`)
              const supabase = createClient(url, apiKey);
              console.log(`Created supabase client and sending query`)
              let { data, error } = await supabase.rpc('get_schema_info');
              if (error) {
                console.error("Error executing SQL query:", error);
                throw error;
              } 
              console.log(`Supabase Query executed! \n Data :- ${data}`);
              schemaContext = JSON.stringify(data, null,2);
              console.log(`schemaContext :- ${schemaContext}`);
            } else {
            // if we have schema received from the cache
            //do something
            }
        }
      }
    

    // Build the complete context based on filters and user role
    let completeContext = baseContext;
    
    // Add dialect-specific context
    const dialectKey = dialect as keyof typeof dialectContexts;
    if (dialectKey in dialectContexts) {
      completeContext += '\n\n' + dialectContexts[dialectKey];
    }
    
    // Add OLAP optimization context if requested
    if (optimizeForOLAP) {
      completeContext += '\n\n' + olapContext;
    }
    
    // Add viewer security context if user is a viewer
    if (userMembership?.role === 'VIEWER') {
      completeContext += '\n\n' + viewerSecurityContext;
    }
    
    // Add performance and storage optimization guidance
    completeContext += `\n\nPERFORMANCE AND STORAGE OPTIMIZATION:
1. For all queries, focus on:
   - Minimizing expensive operations (e.g., avoid CROSS JOIN, inefficient subqueries)
   - Pushing filters down as close to data sources as possible
   - Using appropriate join algorithms based on table sizes
   - Avoiding unnecessary columns in SELECT statements
2. For schema design:
   - Choose appropriate primary and secondary keys
   - Implement proper partitioning strategies for large tables
   - Use columnar storage formats when supported
   - Consider data access patterns when designing tables
   - Choose appropriate data types to minimize storage requirements
   - Implement bucketing/clustering for frequently joined columns`;
    
    // Add connection and schema details
    completeContext += `\n\nCONNECTION DETAILS:
- Catalog: ${connection.catalog}
- Schema: ${connection.schema}
- Source Type: ${connection.source}
- Tables and Columns: \ntable_schema,table_name,column_name,data_type \n${schemaContext}

EVALUATION CRITERIA:
1. Accuracy: Generated statements must be syntactically correct and semantically appropriate
2. Dialect-specific features: Use specialized functions for this dialect (${dialect})
3. Performance: Optimize for execution speed and resource efficiency
4. Storage efficiency: Consider data organization and compression when creating tables`;

    console.log(`Complete Context :- ${completeContext}`);
    // Generate the query
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent([
      { text: completeContext },
      { text: prompt }
    ]);
    
    const query = result.response.text();
    
    if (!userId) {
      res.status(401).json({message: "Unauthorized : userId not sent"});
      return;
    }

    // Log the executed query
    await prisma.executedQuery.create({
      data: {
        query,
        userId,
        projectId: connection.projectId,
        connectionId,
        status: 'GENERATED',
        duration: 0
      }
    });
    
    res.status(200).json({ 
      message: "Query generated successfully", 
      query,
      connectionId 
    });
    
    // Rest of the code remains the same...
  } catch (error) {
    console.error('Generate query failed:', error);
    res.status(500).json({ 
      message: "Failed to generate query", 
      error: (error as Error).message 
    });
  }
}

// Helper function to process Trino schema response
async function processTrinoSchemaResponse(resultIterator: any): Promise<any[]> {
  const processedRows: any[] = [];
  
  for await (const row of resultIterator) {
    if (row.data && Array.isArray(row.data)) {
      processedRows.push({
        table_schema: row.data[0],
        table_name: row.data[1],
        column_name: row.data[2],
        data_type: row.data[3]
      });
    }
  }
  
  return processedRows;
}


export async function refineQuery(req: Request, res: Response): Promise<void> {
  try {
    const { 
      originalQuery, 
      executedQuery,
      refinementRequest, 
      connectionId,
      userId
    } = req.body;
    
    // Validate request data
    if (!originalQuery || !refinementRequest || !connectionId) {
      res.status(400).json({ 
        message: "Missing required fields", 
        error: "Original query, refinement request, and connectionId are required" 
      });
      return;
    }

    // Get connection details
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
      include: {
        project: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!connection) {
      res.status(404).json({ 
        message: "Connection not found" 
      });
      return;
    }

    // Check user permissions for DML security
    const userMembership = await prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId: connection.project.organizationId
      }
    });

    // Fetch schema information directly using Prisma
    let tableInfo = [];
    let schemaContextString = "Schema details not fetched via this method."; // Default

    try {
      if (connection.source === 'postgres' || connection.source === 'neon' || connection.source === 'supabase') {
        // Get tables in the schema (Original queryRaw)
        const tables: any = await prisma.$queryRaw`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = ${connection.schema}
          AND table_type = 'BASE TABLE'
        `;

        // Get columns for each table (Original queryRaw loop)
        // *** CHANGED: Made loop slightly safer using Promise.all for clarity ***
        const tablePromises = (Array.isArray(tables) ? tables : [tables]).map(async (table: any) => {
             const columns: any = await prisma.$queryRaw`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = ${connection.schema}
                AND table_name = ${table.table_name}
                ORDER BY ordinal_position
             `;
             return {
                table_name: table.table_name,
                // *** CHANGED: Format columns slightly differently for context string ***
                columns: (Array.isArray(columns) ? columns : [columns]).map((c: any) => `${c.column_name} (${c.data_type})`)
             };
        });
        tableInfo = await Promise.all(tablePromises);

        // *** ADDED: Create a string representation from tableInfo ***
        schemaContextString = tableInfo.map(t =>
            `Table: ${t.table_name}\n  Columns: ${t.columns.join(', ')}`
        ).join('\n');
        if (!schemaContextString) schemaContextString = "Schema fetched, but no tables/columns found.";


      } else {
        // Original fallback logic
        schemaContextString = `Schema information not fetched via Prisma for source type: ${connection.source}`;
        tableInfo = [{
          message: "Schema information not available for this connection type via Prisma directly",
          note: "AI will refine based on the original query structure"
        }];
      }
    } catch (error) {
      console.error('Error fetching schema:', error);
       // *** CHANGED: Update context string on error ***
      schemaContextString = `Failed to fetch schema information via Prisma. Error: ${(error as Error).message}`;
      tableInfo = [{
        error: "Failed to fetch schema information",
        message: (error as Error).message
      }];
    }


    // *** ADDED: Fetch Query History and Feedback ***
    let historyContext = "No recent query history available for this connection.";
    try {
      const history = await prisma.executedQuery.findMany({
        where: { connectionId: connectionId }, // Filter by this connection
        orderBy: { executedAt: 'desc' },
        take: 5, // Limit to last 5
        select: {
          query: true, // Include the query itself
          status: true, // Include the status
          cpuTime: true,
          physicalInputBytes: true,
          elapsedTime: true,
          wallTime: true,
          processedRows: true,
          processedBytes: true,
          queuedTime: true,
          feedbacks: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (history.length > 0) {
        historyContext = history.map((entry, index) => {
          const feedbackStrings = entry.feedbacks.map(fb =>
            `  - Feedback (Rating: ${fb.rating}): ${fb.text || 'No comment'}`
          ).join('\n');
          // Format for AI context
          return `--- History Entry ${index + 1} ---\n` +
                 `Query: ${entry.query}\n` +
                 `Status: ${entry.status}\n` +
                 `CPU Time: ${entry.cpuTime} s\n` +
                 `Elapsed Time: ${entry.elapsedTime} s\n` +
                 `Wall Time: ${entry.wallTime} s\n` +
                 `Processed Rows: ${entry.processedRows}\n` +
                 `Processed Bytes: ${entry.processedBytes}\n` +
                 `Physical Input Bytes: ${entry.physicalInputBytes}\n` +
                 `Queued Time: ${entry.queuedTime} s\n` +
                 `${feedbackStrings ? `Feedback:\n${feedbackStrings}` : 'No Feedback.'}`;
        }).join('\n\n');
      }
    } catch (historyError) {
      console.error(`Failed to fetch query history for connection ${connectionId}:`, historyError);
      // Keep default message on error
    }
    // *** END ADDED: Fetch Query History and Feedback ***
    let differenceContext;
    if(executedQuery) {
      if( executedQuery !== originalQuery ) {
        const changes  = diffChars(originalQuery, executedQuery);
        let diffText = "";
        changes.forEach((part) => {
          if(part.added) {
            diffText += `[Added: ${part.value}]`;
          } else if (part.removed) {
            diffText += `[Removed: ${part.value}]`;
          } else {
            diffText += part.value;
          }
        });
        differenceContext = `${diffText}`;
      }
    }


    // Create a refinement context (Original structure, but incorporating new history)
    // *** CHANGED: Modified context string to include history and structure better ***
    const refinementContext = `You are an AI assistant that specializes in refining and improving SQL queries.
INSTRUCTIONS:
1. You are given an original SQL query and a request to refine it.
2. Modify the query to meet the refinement request while maintaining correctness.
3. Use EXACT table and column names if schema details are provided below.
4. Consider the recent query history and feedback provided below for context.
5. Focus on performance and efficiency in your refined query.
6. Do not include any explanation, markdown formatting, or comments in your response.
7. Return ONLY the refined SQL query.

CONNECTION DETAILS:
- Catalog: ${connection.catalog}
- Schema: ${connection.schema}
- Source Type: ${connection.source || 'N/A'}

SCHEMA DETAILS (Fetched via Prisma for compatible sources):
${schemaContextString}

RECENT QUERY HISTORY & FEEDBACK (Last 5 for this connection):
${historyContext}

ORIGINAL QUERY TO REFINE:
${originalQuery}

${userMembership?.role === 'VIEWER' ? viewerSecurityContext : ''}

USER'S REFINEMENT REQUEST:
${refinementRequest}

CONTEXT ABOUT USER MODIFICATIONS TO PREVIOUS QUERY (if applicable):
${differenceContext || 'No prior modifications context available.'}

REFINED QUERY OUTPUT (Return ONLY the SQL):`; 
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    console.log(`Complete context :- ${refinementContext}`);
    const result = await model.generateContent([
      { text: refinementContext },
      { text: refinementRequest }
    ]);
    
    // Sanitize the query to remove formatting characters and code block markers
    const refinedQuery = sanitizeSqlQuery(result.response.text());
    
    await prisma.executedQuery.create({
      data: {
        query: refinedQuery,
        userId,
        projectId: connection.projectId,
        connectionId,
        status: 'REFINED',
        duration: 0
      }
    });
    
    res.status(200).json({ 
      message: "Query refined successfully", 
      originalQuery,
      refinedQuery,
      connectionId,
      generateContext: refinementContext,
    });
  } catch (error) {
    console.error('Refine query failed:', error);
    res.status(500).json({ 
      message: "Failed to refine query", 
      error: (error as Error).message 
    });
  }
}
