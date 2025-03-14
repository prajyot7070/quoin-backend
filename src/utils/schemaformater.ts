import trinoService from "../services/trinoService";

/**
 * Gets database schema information from Trino
 * Processes the response from trino-client
 */
export async function getDatabaseSchema(connectionId: number, catalog: string) {
    try {
        const query = `
            SELECT
                t.table_schema,
                t.table_name,
                c.column_name,
                c.data_type
            FROM
                ${catalog}.information_schema.tables AS t
            JOIN
                ${catalog}.information_schema.columns AS c
            ON
                t.table_schema = c.table_schema AND t.table_name = c.table_name
            WHERE
                t.table_schema NOT IN ('information_schema', 'pg_catalog') AND t.table_type = 'BASE TABLE'
            ORDER BY
                t.table_schema, t.table_name, c.ordinal_position
        `;
        const queryResponse = await trinoService.executeQuery(connectionId, query);
        
        if (!queryResponse.success) {
            console.error("Failed to get schema:", queryResponse.error);
            return [];
        }
        
        const queryResult = queryResponse.result;
        const formattedData = [];
        
        // Check if we have valid data
        if (Array.isArray(queryResult) && queryResult.length > 0 && queryResult[0].data) {
            const data = queryResult[0].data;
            
            // Process each row into a structured object
            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                if (Array.isArray(row) && row.length >= 4) {
                    formattedData.push({
                        table_schema: row[0],
                        table_name: row[1],
                        column_name: row[2],
                        data_type: row[3]
                    });
                }
            }
        }
        
        console.log(`Processed ${formattedData.length} schema rows`);
        return formattedData;
    } catch (error) {
        console.error("Error in getDatabaseSchema:", error);
        return [];
    }
}

/**
 * Formats schema information into a structured, readable format
 * Organizes columns by table for better clarity in AI prompts
 */
export function formatSchemaForPrompt(schemaInfo: any[]) {
    try {
        if (!Array.isArray(schemaInfo) || schemaInfo.length === 0) {
            return "No schema information available.";
        }
        
        // Group columns by table
        const tables: { [key: string]: { columns: string[] } } = {};
        
        schemaInfo.forEach((row) => {
            if (!row.table_schema || !row.table_name || !row.column_name || !row.data_type) {
                return; // Skip invalid rows
            }
            
            const tableName = `${row.table_schema}.${row.table_name}`;
            if (!tables[tableName]) {
                tables[tableName] = { columns: [] };
            }
            tables[tableName].columns.push(`${row.column_name} (${row.data_type})`);
        });
        
        // Check if we found any valid tables
        if (Object.keys(tables).length === 0) {
            return "No tables found in the schema.";
        }
        
        // Format as a structured list for better readability
        let formattedSchema = "Available tables and their columns:\n\n";
        
        for (const tableName in tables) {
            formattedSchema += `TABLE: ${tableName}\n`;
            formattedSchema += `COLUMNS: \n`;
            
            // Add each column on a new line with proper indentation
            tables[tableName].columns.forEach(column => {
                formattedSchema += `  - ${column}\n`;
            });
            
            formattedSchema += "\n";
        }
        
        return formattedSchema;
    } catch (error) {
        console.error("Error in formatSchemaForPrompt:", error);
        return "Error formatting schema information.";
    }
}
