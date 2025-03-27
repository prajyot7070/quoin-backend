"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processTrinoSchemaResponse = processTrinoSchemaResponse;
function processTrinoSchemaResponse(resultIterator) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, resultIterator_1, resultIterator_1_1;
        var _b, e_1, _c, _d;
        const processedRows = [];
        try {
            try {
                for (_a = true, resultIterator_1 = __asyncValues(resultIterator); resultIterator_1_1 = yield resultIterator_1.next(), _b = resultIterator_1_1.done, !_b; _a = true) {
                    _d = resultIterator_1_1.value;
                    _a = false;
                    const response = _d;
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
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_a && !_b && (_c = resultIterator_1.return)) yield _c.call(resultIterator_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        catch (error) {
            console.error('Error processing Trino response:', error);
            throw error;
        }
        return processedRows;
    });
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
