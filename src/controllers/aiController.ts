import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../config/db';
import { sanitizeSqlQuery } from '../utils/sanitizeSqlQuery';
import { createTrinoClient, TrinoConfig } from '../config/trino';
import { processTrinoSchemaResponse, SchemaRow } from '../utils/schemaformater';

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
      //userId
    } = req.body;
    const userId = req.users?.id;

    
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

    // Check user permissions for DML security
    const userMembership = await prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId: connection.project.organizationId
      }
    });

    //query to get Database schema
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
                t.table_schema, t.table_name, c.ordinal_position`

    const trinoConfig: TrinoConfig = {
       server: connection.server,
        catalog: connection.catalog,
        schema: connection.schema,
        source: connection.source || undefined,
        extraHeaders: {
          'X-Trino-User': 'trino_user',
        }
    }
    const client = await createTrinoClient(trinoConfig);
    let processedRows = [];
		
		try {
		  const resultIterator = await client.query(queryDatabaseSchema);
		  processedRows = await processTrinoSchemaResponse(resultIterator);
		  console.log(`Fetched schema for ${processedRows.length}`);
		  
		} catch (error) {
		  console.error('Error processing query results:', error);
		  throw error;
		}
//        
//        if (query_response.success && query_response.result) {
//            // Check if the query_response.is an async iterable
//            if (typeof query_response.result[Symbol.asyncIterator] === 'function') {
//                console.log('Processing async iterable...');
//                for await (const row of query_response.result) {
//                    // Capture the first raw row
//                    if (!rawData) {
//                        rawData = row;
//                        //console.log('Raw row:', row);
//                    }
//                    
//                    // Process rows
//                    if (row.data && Array.isArray(row.data)) {
//                        processedRows.push({
//                            table_schema: row.data[0],
//                            table_name: row.data[1],
//                            column_name: row.data[2],
//                            data_type: row.data[3]
//                        });
//                    }
//                }
//            }
//        }
    
    console.log(`Fetched schema for ${processedRows.length} tables`);
    
    const schemaContext = processedRows.map(row => `${row.table_schema},${row.table_name},${row.column_name},${row.data_type}`).join('\n');

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
  } catch (error) {
    console.error('Generate query failed:', error);
    res.status(500).json({ 
      message: "Failed to generate query", 
      error: (error as Error).message 
    });
  }
}

export async function refineQuery(req: Request, res: Response): Promise<void> {
  try {
    const { 
      originalQuery, 
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
    try {
      // For Prisma direct database access, we'll use a different approach based on connection type
      // This example assumes a PostgreSQL-compatible database
      if (connection.source === 'postgres' || connection.source === 'neon' || connection.source === 'supabase') {
        // Get tables in the schema
        const tables = await prisma.$queryRaw`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = ${connection.schema}
          AND table_type = 'BASE TABLE'
        `;
        
        // Get columns for each table
        for (const table of Array.isArray(tables) ? tables : [tables]) {
          const columns = await prisma.$queryRaw`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_schema = ${connection.schema} 
            AND table_name = ${table.table_name}
            ORDER BY ordinal_position
          `;
          
          tableInfo.push({
            table_name: table.table_name,
            columns: columns
          });
        }
      } else {
        // For other connection types, we might need to implement alternative approaches
        tableInfo = [{
          message: "Schema information not available for this connection type via Prisma directly",
          note: "AI will refine based on the original query structure"
        }];
      }
    } catch (error) {
      console.error('Error fetching schema:', error);
      tableInfo = [{
        error: "Failed to fetch schema information",
        message: (error as Error).message
      }];
    }

    // Create a refinement context
    const refinementContext = `You are an AI assistant that specializes in refining and improving SQL queries.
INSTRUCTIONS:
1. You are given an original SQL query and a request to refine it
2. Modify the query to meet the refinement request while maintaining correctness
3. Use EXACT table and column names as provided in the schema details
4. Focus on performance and efficiency in your refined query
5. Do not include any explanation, markdown formatting, or comments in your response
6. Return ONLY the refined SQL query

CONNECTION DETAILS:
- Catalog: ${connection.catalog}
- Schema: ${connection.schema}
- Source Type: ${connection.source}
- Tables and Columns: ${JSON.stringify(tableInfo, null, 2)}

ORIGINAL QUERY:
${originalQuery}

${userMembership?.role === 'VIEWER' ? viewerSecurityContext : ''}`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
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
      connectionId 
    });
  } catch (error) {
    console.error('Refine query failed:', error);
    res.status(500).json({ 
      message: "Failed to refine query", 
      error: (error as Error).message 
    });
  }
}
