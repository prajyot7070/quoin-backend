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
exports.executeQuery = executeQuery;
exports.getQueryHistory = getQueryHistory;
exports.provideFeedback = provideFeedback;
const db_1 = __importDefault(require("../config/db"));
const trino_1 = require("../config/trino");
const pg_1 = require("pg");
/**
 * Execute a query against a database connection
 */
function executeQuery(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_1, _b, _c;
        var _d;
        const startTime = Date.now();
        try {
            const { query, connectionId } = req.body;
            const userId = (_d = req.users) === null || _d === void 0 ? void 0 : _d.id;
            if (!query || !connectionId) {
                res.status(400).json({ message: "Query and connectionId are required" });
                return;
            }
            if (!userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            // Get connection details
            const connection = yield db_1.default.connection.findUnique({
                where: { id: connectionId },
                include: {
                    project: true
                }
            });
            if (!connection) {
                res.status(404).json({ message: "Connection not found" });
                return;
            }
            // Check user permissions
            const membership = yield db_1.default.organizationMembership.findFirst({
                where: {
                    userId,
                    organizationId: connection.project.organizationId
                }
            });
            if (!membership) {
                res.status(403).json({ message: "User has no access to this organization" });
                return;
            }
            // VIEWER role security check - prevent DML/DDL operations
            if (membership.role === 'VIEWER') {
                const queryUpper = query.toUpperCase();
                const forbiddenOps = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE'];
                if (forbiddenOps.some(op => queryUpper.includes(op))) {
                    res.status(403).json({
                        message: "Viewers can only execute SELECT queries",
                        error: "Forbidden operation detected"
                    });
                    return;
                }
            }
            let queryResult;
            let error = null;
            let resultSize = 0;
            // Execute query based on connection type
            try {
                if (connection.source === 'trino') {
                    const trinoConfig = {
                        server: connection.server,
                        catalog: connection.catalog,
                        schema: connection.schema,
                        extraHeaders: connection.extraHeaders || {},
                        auth: connection.auth || {},
                        ssl: connection.ssl || {},
                        source: connection.source
                    };
                    const client = yield (0, trino_1.createTrinoClient)(trinoConfig);
                    const result = yield client.query(query);
                    // Handle Trino's iterator result format
                    const rows = [];
                    if (result && typeof result[Symbol.asyncIterator] === 'function') {
                        try {
                            for (var _e = true, result_1 = __asyncValues(result), result_1_1; result_1_1 = yield result_1.next(), _a = result_1_1.done, !_a; _e = true) {
                                _c = result_1_1.value;
                                _e = false;
                                const row = _c;
                                rows.push(row);
                            }
                        }
                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                        finally {
                            try {
                                if (!_e && !_a && (_b = result_1.return)) yield _b.call(result_1);
                            }
                            finally { if (e_1) throw e_1.error; }
                        }
                    }
                    queryResult = { rows };
                    resultSize = rows.length;
                }
                else if (connection.source === 'postgres' || connection.source === 'neon') {
                    const auth = connection.auth;
                    const ssl = connection.ssl;
                    const pool = new pg_1.Pool({
                        host: auth.host,
                        port: auth.port,
                        database: auth.database,
                        user: auth.user,
                        password: auth.password,
                        ssl: Object.keys(ssl).length > 0 ? ssl : undefined
                    });
                    const client = yield pool.connect();
                    queryResult = yield client.query(query);
                    resultSize = queryResult.rowCount || 0;
                    client.release();
                    yield pool.end();
                }
                else if (connection.source === 'supabase') {
                    const auth = connection.auth;
                    const response = yield fetch(`${auth.url}/rest/v1/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': auth.apiKey,
                            'Authorization': `Bearer ${auth.apiKey}`
                        },
                        body: JSON.stringify({ query })
                    });
                    if (!response.ok) {
                        throw new Error(`Supabase query failed: ${response.statusText}`);
                    }
                    queryResult = yield response.json();
                    resultSize = Array.isArray(queryResult) ? queryResult.length : 0;
                }
                else {
                    throw new Error(`Unsupported connection type: ${connection.source}`);
                }
            }
            catch (err) {
                error = err.message;
                queryResult = null;
            }
            // Calculate execution time
            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000; // Convert to seconds
            // Log the executed query
            const executedQuery = yield db_1.default.executedQuery.create({
                data: {
                    query,
                    userId, // Now we're sure userId is defined
                    projectId: connection.projectId,
                    connectionId,
                    status: error ? 'ERROR' : 'SUCCESS',
                    duration,
                    error: error,
                    resultSize
                }
            });
            if (error) {
                res.status(400).json({
                    success: false,
                    message: "Query execution failed",
                    error,
                    executedQueryId: executedQuery.id
                });
            }
            else {
                res.status(200).json({
                    success: true,
                    result: queryResult,
                    executionTime: duration,
                    executedQueryId: executedQuery.id
                });
            }
        }
        catch (error) {
            console.error('Execute query failed:', error);
            res.status(500).json({
                success: false,
                message: "Failed to execute query",
                error: error.message
            });
        }
    });
}
/**
 * Get query execution history for a project
 */
function getQueryHistory(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { projectId } = req.params;
            const userId = (_a = req.users) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            // Verify project exists and user has access
            const project = yield db_1.default.project.findUnique({
                where: { id: projectId },
                include: { organization: true }
            });
            if (!project) {
                res.status(404).json({ message: "Project not found" });
                return;
            }
            // Check user membership in organization
            const membership = yield db_1.default.organizationMembership.findFirst({
                where: {
                    userId,
                    organizationId: project.organizationId
                }
            });
            if (!membership) {
                res.status(403).json({ message: "User has no access to this organization" });
                return;
            }
            // Get query history
            const executedQueries = yield db_1.default.executedQuery.findMany({
                where: { projectId },
                include: {
                    user: {
                        select: { id: true, name: true, email: true }
                    },
                    connection: {
                        select: { id: true, name: true, source: true }
                    },
                    feedbacks: {
                        select: {
                            id: true,
                            rating: true,
                            text: true,
                            createdAt: true
                        }
                    }
                },
                orderBy: { executedAt: 'desc' },
                take: 100 // Limit to recent queries
            });
            res.status(200).json({
                success: true,
                executedQueries
            });
        }
        catch (error) {
            console.error('Get query history failed:', error);
            res.status(500).json({
                message: "Failed to retrieve query history",
                error: error.message
            });
        }
    });
}
/**
 * Provide feedback for an executed query
 */
function provideFeedback(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { executedQueryId, rating, text } = req.body;
            const userId = (_a = req.users) === null || _a === void 0 ? void 0 : _a.id;
            if (!executedQueryId || rating === undefined) {
                res.status(400).json({ message: "ExecutedQueryId and rating are required" });
                return;
            }
            if (!userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            // Verify query exists and user has access
            const executedQuery = yield db_1.default.executedQuery.findUnique({
                where: { id: executedQueryId },
                include: { project: true }
            });
            if (!executedQuery) {
                res.status(404).json({ message: "Query not found" });
                return;
            }
            // Check membership in organization
            const membership = yield db_1.default.organizationMembership.findFirst({
                where: {
                    userId,
                    organizationId: executedQuery.project.organizationId
                }
            });
            if (!membership) {
                res.status(403).json({ message: "User has no access to this organization" });
                return;
            }
            // Create feedback
            const feedback = yield db_1.default.queryFeedback.create({
                data: {
                    executedQueryId,
                    rating,
                    text: text || null,
                    userId,
                    rawQuery: executedQuery.query
                }
            });
            res.status(201).json({
                success: true,
                feedback
            });
        }
        catch (error) {
            console.error('Provide feedback failed:', error);
            res.status(500).json({
                message: "Failed to save feedback",
                error: error.message
            });
        }
    });
}
exports.default = {
    executeQuery,
    getQueryHistory,
    provideFeedback
};
