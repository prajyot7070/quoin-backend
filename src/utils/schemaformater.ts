import { executeQuery } from "../controllers/queryController";
// Define an interface for the schema row
export interface SchemaRow {
    table_schema: string;
    table_name: string;
    column_name: string;
    data_type: string;
}

export interface RawSchemaRow {
    rawData: any;
    processedRows: SchemaRow[];
}


export async function processTrinoSchemaResponse(resultIterator: any): Promise<SchemaRow[]> {
  const processedRows: SchemaRow[] = [];
  
  try {
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
      // Handle case where the response is just the data array
      else if (Array.isArray(response)) {
        for (const row of response) {
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
  } catch (error) {
    console.error('Error processing Trino response:', error);
    throw error;
  }

  return processedRows;
}


/**
 * Gets database schema information from Trino
 * Returns both raw and processed schema rows
 */
//export async function getDatabaseSchema(connectionId: number, catalog: string): Promise<RawSchemaRow> {
//    try {
//        const query = `
//            SELECT
//                t.table_schema,
//                t.table_name,
//                c.column_name,
//                c.data_type
//            FROM
//                ${catalog}.information_schema.tables AS t
//            JOIN
//                ${catalog}.information_schema.columns AS c
//            ON
//                t.table_schema = c.table_schema AND t.table_name = c.table_name
//            WHERE
//                t.table_schema NOT IN ('information_schema', 'pg_catalog') AND t.table_type = 'BASE TABLE'
//            ORDER BY
//                t.table_schema, t.table_name, c.ordinal_position
//        `;
//        
//        const result = await executeQuery(connectionId, query);
//        
//        const processedRows: SchemaRow[] = [];
//        let rawData = null;
//        
//        if (result.success && result.result) {
//            // Check if the result is an async iterable
//            if (typeof result.result[Symbol.asyncIterator] === 'function') {
//                console.log('Processing async iterable...');
//                for await (const row of result.result) {
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
//        
//        return { rawData, processedRows };
//    } catch (error) {
//        console.error("Error in getDatabaseSchema:", error);
//        return { rawData: null, processedRows: [] };
//    }
//}
