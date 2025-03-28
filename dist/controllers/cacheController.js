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
exports.cacheSchema = cacheSchema;
exports.getCachedSchema = getCachedSchema;
const db_1 = __importDefault(require("../config/db"));
const redis_1 = __importDefault(require("../config/redis"));
const trino_1 = require("../config/trino");
/**
 * Cache the database schema for context
 */
function cacheSchema(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { connectionId } = req.body;
            const userId = (_a = req.users) === null || _a === void 0 ? void 0 : _a.id;
            // Validate input
            if (!connectionId) {
                res.status(400).json({
                    message: "Connection ID is required"
                });
                return;
            }
            // Fetch connection details
            const connection = yield db_1.default.connection.findUnique({
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
            const userMembership = yield db_1.default.organizationMembership.findFirst({
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
            const trinoConfig = {
                server: connection.server,
                catalog: connection.catalog,
                schema: connection.schema,
                source: connection.source || undefined,
                extraHeaders: {
                    'X-Trino-User': 'trino_user',
                }
            };
            // Create Trino client
            const client = yield (0, trino_1.createTrinoClient)(trinoConfig);
            // Query to fetch database schema
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
            // Execute schema query
            const resultIterator = yield client.query(queryDatabaseSchema);
            const processedRows = yield processTrinoSchemaResponse(resultIterator);
            // Prepare cache object
            const schemaCache = {
                tables: processedRows,
                cachedAt: Date.now()
            };
            // Cache in Redis with expiration (24 hours)
            const cacheKey = `schema:${connectionId}`;
            yield redis_1.default.set(cacheKey, JSON.stringify(schemaCache));
            // Respond with success
            res.status(200).json({
                message: "Schema cached successfully",
                tableCount: processedRows.length,
                cachedAt: schemaCache.cachedAt
            });
        }
        catch (error) {
            console.error('Schema caching failed:', error);
            res.status(500).json({
                message: "Failed to cache schema",
                error: error.message
            });
        }
    });
}
// Helper function to process Trino schema response
function processTrinoSchemaResponse(resultIterator) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, resultIterator_1, resultIterator_1_1;
        var _b, e_1, _c, _d;
        const processedRows = [];
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
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_a && !_b && (_c = resultIterator_1.return)) yield _c.call(resultIterator_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return processedRows;
    });
}
// New function to retrieve cached schema from Redis
function getCachedSchema(connectionId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const cacheKey = `schema:${connectionId}`;
            //console.log(`getting cached schema from redis`)
            const cachedSchema = yield redis_1.default.get(cacheKey);
            if (cachedSchema) {
                //console.log(`Got the cache`)
                // Check if cachedSchema is a string representation of an object
                if (typeof cachedSchema === 'string') {
                    try {
                        return JSON.parse(cachedSchema);
                    }
                    catch (parseError) {
                        console.error('Failed to parse cached schema:', parseError);
                        return null;
                    }
                }
                // If it's already an object, return it directly
                return cachedSchema;
            }
            return null;
        }
        catch (error) {
            console.error('Error retrieving cached schema:', error);
            return null;
        }
    });
}
