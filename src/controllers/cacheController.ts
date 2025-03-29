import { Request, Response } from 'express';
import prisma from '../config/db';
import redisClient from '../config/redis';
import { createTrinoClient, TrinoConfig } from '../config/trino';

interface SchemaTable {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
}

interface Relationship {
  constraint_name: string;
  source_schema: string;
  source_table: string;
  source_column: string;
  target_schema: string;
  target_table: string;
  target_column: string;
}

interface SchemaCache {
  tables: SchemaTable[];
  relationships: Relationship[];
  cachedAt: number;
}

/**
 * Cache the database schema for context
 */
export async function cacheSchema(req: Request, res: Response): Promise<void> {
  try {
    const { connectionId } = req.body;
    const userId = req.users?.id;

    // Validate input
    if (!connectionId) {
      res.status(400).json({ 
        message: "Connection ID is required" 
      });
      return;
    }

    // Fetch connection details
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

    // Verify user has access to this connection
    const userMembership = await prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId: connection.project.organizationId
      }
    });

    if (!userMembership) {
      res.status(403).json({ 
        message: "Unauthorized access to connection" 
      });
      return;
    }

    // Configure Trino client
    const trinoConfig: TrinoConfig = {
      server: connection.server,
      catalog: connection.catalog,
      schema: connection.schema,
      source: connection.source || undefined,
      extraHeaders: {
        'X-Trino-User': 'trino_user',
      }
    };

    // Create Trino client
    const client = await createTrinoClient(trinoConfig);

    // Query to fetch database schema (tables and columns)
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
        t.table_schema NOT IN ('information_schema', 'pg_catalog') 
        AND t.table_type = 'BASE TABLE'
      ORDER BY
        t.table_schema, t.table_name, c.ordinal_position
    `;

    // Query to fetch foreign key relationships
    const queryRelationships = `
  SELECT
    tc.constraint_name,
    kcu.table_schema AS source_schema,
    kcu.table_name AS source_table,
    kcu.column_name AS source_column,
    ccu.table_schema AS target_schema,
    ccu.table_name AS target_table,
    ccu.column_name AS target_column
  FROM
    ${connection.catalog}.information_schema.table_constraints AS tc
  JOIN
    ${connection.catalog}.information_schema.key_column_usage AS kcu
  ON
    tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN
    ${connection.catalog}.information_schema.constraint_column_usage AS ccu
  ON
    ccu.constraint_name = tc.constraint_name
  WHERE
    tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema NOT IN ('information_schema', 'pg_catalog')
`;

    // Execute schema query
    const schemaResultIterator = await client.query(queryDatabaseSchema);
    const processedTables = await processTrinoSchemaResponse(schemaResultIterator);

    // Execute relationships query
    const relationshipsResultIterator = await client.query(queryRelationships);
    console.log(`Raw relationships reponse - ${relationshipsResultIterator} `);
    const processedRelationships = await processTrinoRelationshipsResponse(relationshipsResultIterator);

    // Prepare cache object
    const schemaCache: SchemaCache = {
      tables: processedTables,
      relationships: processedRelationships,
      cachedAt: Date.now()
    };

    // Cache in Redis with expiration (24 hours)
    const cacheKey = `schema:${connectionId}`;
    await redisClient.set(cacheKey, JSON.stringify(schemaCache));

    // Respond with success
    res.status(200).json({ 
      message: "Schema cached successfully",
      tableCount: processedTables.length,
      relationshipCount: processedRelationships.length,
      cachedAt: schemaCache.cachedAt
    });

  } catch (error) {
    console.error('Schema caching failed:', error);
    res.status(500).json({ 
      message: "Failed to cache schema", 
      error: (error as Error).message 
    });
  }
}

// Helper function to process Trino schema response
async function processTrinoSchemaResponse(resultIterator: any): Promise<SchemaTable[]> {
  const processedRows: SchemaTable[] = [];
  
  for await (const response of resultIterator) {
      // Check if this is a data response with columns and data
      if (response.columns && response.data) {
        // Process each row in the data array
        for (const row of response.data) {
          if (Array.isArray(row) && row.length >= 4) {
            processedRows.push({
              table_schema: row[0],
              table_name: row[1],
              column_name: row[2],
              data_type: row[3]
            });
          }
        }
      }
  }
  return processedRows;
}

// Helper function to process Trino relationships response
async function processTrinoRelationshipsResponse(resultIterator: any): Promise<Relationship[]> {
  const processedRelationships: Relationship[] = [];
  
  for await (const response of resultIterator) {
    console.log(`Processing response - `, response);
      // Check if this is a data response with columns and data
      if (response.columns && response.data) {
        console.log(`Found data - `, response.data);
        // Process each row in the data array
        for (const row of response.data) {
          if (Array.isArray(row) && row.length >= 7) {
            processedRelationships.push({
              constraint_name: row[0],
              source_schema: row[1],
              source_table: row[2],
              source_column: row[3],
              target_schema: row[4],
              target_table: row[5],
              target_column: row[6]
            });
          } else {
          console.log(`Skipping malformed row: `, row);
        }
        }
      }
  }
  return processedRelationships;
}

// Function to retrieve cached schema from Redis
export async function getCachedSchema(connectionId: string): Promise<SchemaCache | null> {
  try {
    const cacheKey = `schema:${connectionId}`;
    //console.log(`getting cached schema from redis`)
    const cachedSchema = await redisClient.get(cacheKey);
    
    if (cachedSchema) {
      //console.log(`Got the cache`)
      // Check if cachedSchema is a string representation of an object
      if (typeof cachedSchema === 'string') {
        try {
          return JSON.parse(cachedSchema) as SchemaCache;
        } catch (parseError) {
          console.error('Failed to parse cached schema:', parseError);
          return null;
        }
      }
      
      // If it's already an object, return it directly
      return cachedSchema as SchemaCache;
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving cached schema:', error);
    return null;
  }
}
