import trinoService from "../services/trinoService";

// Define an interface for the schema row
interface SchemaRow {
    table_schema: string;
    table_name: string;
    column_name: string;
    data_type: string;
}

interface RawSchemaRow {
    rawData: any;
    processedRows: SchemaRow[];
}

/**
 * Gets database schema information from Trino
 * Returns both raw and processed schema rows
 */
export async function getDatabaseSchema(connectionId: number, catalog: string): Promise<RawSchemaRow> {
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
        
        const result = await trinoService.executeQuery(connectionId, query);
        
        const processedRows: SchemaRow[] = [];
        let rawData = null;
        
        if (result.success && result.result) {
            // Check if the result is an async iterable
            if (typeof result.result[Symbol.asyncIterator] === 'function') {
                console.log('Processing async iterable...');
                for await (const row of result.result) {
                    // Capture the first raw row
                    if (!rawData) {
                        rawData = row;
                        //console.log('Raw row:', row);
                    }
                    
                    // Process rows
                    if (row.data && Array.isArray(row.data)) {
                        processedRows.push({
                            table_schema: row.data[0],
                            table_name: row.data[1],
                            column_name: row.data[2],
                            data_type: row.data[3]
                        });
                    }
                }
            }
        }
        
        return { rawData, processedRows };
    } catch (error) {
        console.error("Error in getDatabaseSchema:", error);
        return { rawData: null, processedRows: [] };
    }
}
