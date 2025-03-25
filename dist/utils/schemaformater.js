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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabaseSchema = getDatabaseSchema;
const trinoService_1 = __importDefault(require("../services/trinoService"));
/**
 * Gets database schema information from Trino
 * Returns both raw and processed schema rows
 */
function getDatabaseSchema(connectionId, catalog) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_1, _b, _c;
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
            const result = yield trinoService_1.default.executeQuery(connectionId, query);
            const processedRows = [];
            let rawData = null;
            if (result.success && result.result) {
                // Check if the result is an async iterable
                if (typeof result.result[Symbol.asyncIterator] === 'function') {
                    console.log('Processing async iterable...');
                    try {
                        for (var _d = true, _e = __asyncValues(result.result), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                            _c = _f.value;
                            _d = false;
                            const row = _c;
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
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                }
            }
            return { rawData, processedRows };
        }
        catch (error) {
            console.error("Error in getDatabaseSchema:", error);
            return { rawData: null, processedRows: [] };
        }
    });
}
