import { Trino } from "trino-client";

export interface TrinoConfig {
    auth?: any;
    catalog?: string;
    extraCredential?: any;
    extraHeaders?: any;
    schema?: string;
    server?: string; //'http://localhost:8080',
    session?: any;
    source?: string;
    ssl?: any;
} 

export const createTrinoClient = async (config: TrinoConfig) => {
  try {
    const trinoClient = Trino.create({
      server: config.server,
      catalog: config.catalog,
      schema: config.schema,
      source: config.source,
      auth: config.auth,
      extraCredential: config.extraCredential,
      extraHeaders: config.extraHeaders,
      session: config.session,
      ssl: config.ssl
    });

    if (!trinoClient) {
      console.error("Error while creating TrinoClient: null trinoClient");
      throw new Error("Failed to create Trino client");
    }
    return trinoClient;
  } catch (error) {
    console.error("Failed to connect to Trino", error);
    throw error;
  }
};
