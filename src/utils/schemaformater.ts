import trinoService from "../services/trinoService";


// Helper function to fetch schema information
export async function getDatabaseSchema(trinoClient: any, catalog: string) {
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
            t.table_schema, t.table_name, c.ordinal_position;
    `;

    try {
        const resultsIterator = await trinoClient.query(query);
        const data: any[] = [];

        for await (const result of resultsIterator) {
            if (result.data) {
                data.push(...result.data); // Accumulate data from each chunk
            }
        }

        console.log("Trino Query Data:", data); // Debugging

        return data;
    } catch (error) {
        console.error("Error executing Trino query:", error);
        return []; // Return empty array on error
    }
}

// Helper function to format schema information for the prompt
export function formatSchemaForPrompt(schemaInfo: any[]) {
    let formattedSchema = "";
    const tables: { [key: string]: { columns: string[] } } = {};

    schemaInfo.forEach((row) => {
        const tableName = `${row.table_schema}.${row.table_name}`;
        if (!tables[tableName]) {
            tables[tableName] = { columns: [] };
        }
        tables[tableName].columns.push(`${row.column_name} (${row.data_type})`);
    });

    for (const tableName in tables) {
        formattedSchema += `- ${tableName}: ${tables[tableName].columns.join(", ")}; `;
    }

    return formattedSchema;
}
