import { createTrinoClient } from "../config/trino";
import { TrinoConfig } from "../config/trino";
import { Trino } from "trino-client";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

class TrinoService {
  // Test the connection
  async testConnection(connectionData: TrinoConfig) {
    try {
      // Initialize extraHeaders if it doesn't exist
      if (!connectionData.extraHeaders) {
        connectionData.extraHeaders = {};
      }
      
      // Now it's safe to set the property
      connectionData.extraHeaders['X-Trino-User'] = 'trino_user';
      
      const client = await createTrinoClient(connectionData);
      const query = 'SELECT 1 AS success';
      const result = await client.query(query);
      return { success: true, result };
    } catch (error) {
      console.error('Connection test failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }  

  // Save a new project
  async createProject(projectData: { name: string; description?: string; userId: number }) {
    try {
      const project = await prisma.project.create({
        data: projectData
      });
      return { success: true, project };
    } catch (error) {
      console.error('Create project failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  // Save a new connection
  async createConnection(connectionData: {
    name: string;
    server: string;
    catalog: string;
    schema: string;
    projectId: number;
    source?: string;
  }) {
    try {
      const connection = await prisma.connection.create({
        data: connectionData
      });
      return { success: true, connection };
    } catch (error) {
      console.error('Create connection failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  // Get a connection by ID
  async getConnection(connectionId: number): Promise<any> {
    try {
      const connection = await prisma.connection.findUnique({
        where: { id: connectionId }
      });
      
      if (!connection) {
        return { success: false, error: 'Connection not found' };
      }
      
      return { success: true, connection };
    } catch (error) {
      console.error('Get connection failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  // Execute a query with a given connection
  async executeQuery(connectionId: number, query: string) {
    try {
      // First, get the connection details
      const connectionResult = await this.getConnection(connectionId);
      if (!connectionResult.success) {
        return connectionResult;
      }
      
      const connection = connectionResult.connection;
      
      // Create a client with the connection details
      const client = await createTrinoClient({
        server: connection.server,
        catalog: connection.catalog,
        schema: connection.schema,
        source: connection.source || undefined
      });
      
      // Execute the query
      const result = await client.query(query);
      console.log(`Query result type : `, typeof result);
      console.log('Query result structure:', JSON.stringify(result, (key, value) => {
      if (typeof value === 'function') return 'function';
      if (value && typeof value === 'object' && Symbol.asyncIterator in value) return 'asyncIterable';
      return value;
      }, 2));
      return { success: true, result };
    } catch (error) {
      console.error('Execute query failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }
}

export default new TrinoService();
