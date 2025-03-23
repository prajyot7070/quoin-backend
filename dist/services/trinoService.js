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
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const trino_1 = require("../config/trino");
const client_1 = require("@prisma/client");
exports.prisma = new client_1.PrismaClient();
class TrinoService {
    // Test the connection
    testConnection(connectionData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                connectionData.extraHeaders['X-Trino-User'] = 'trino_user';
                const client = yield (0, trino_1.createTrinoClient)(connectionData);
                const query = 'SELECT 1 AS success';
                const result = yield client.query(query);
                return { success: true, result };
            }
            catch (error) {
                console.error('Connection test failed:', error);
                return { success: false, error: error.message };
            }
        });
    }
    // Save a new project
    createProject(projectData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const project = yield exports.prisma.project.create({
                    data: projectData
                });
                return { success: true, project };
            }
            catch (error) {
                console.error('Create project failed:', error);
                return { success: false, error: error.message };
            }
        });
    }
    // Save a new connection
    createConnection(connectionData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const connection = yield exports.prisma.connection.create({
                    data: connectionData
                });
                return { success: true, connection };
            }
            catch (error) {
                console.error('Create connection failed:', error);
                return { success: false, error: error.message };
            }
        });
    }
    // Get a connection by ID
    getConnection(connectionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const connection = yield exports.prisma.connection.findUnique({
                    where: { id: connectionId }
                });
                if (!connection) {
                    return { success: false, error: 'Connection not found' };
                }
                return { success: true, connection };
            }
            catch (error) {
                console.error('Get connection failed:', error);
                return { success: false, error: error.message };
            }
        });
    }
    // Execute a query with a given connection
    executeQuery(connectionId, query) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // First, get the connection details
                const connectionResult = yield this.getConnection(connectionId);
                if (!connectionResult.success) {
                    return connectionResult;
                }
                const connection = connectionResult.connection;
                // Create a client with the connection details
                const client = yield (0, trino_1.createTrinoClient)({
                    server: connection.server,
                    catalog: connection.catalog,
                    schema: connection.schema,
                    source: connection.source || undefined
                });
                // Execute the query
                const result = yield client.query(query);
                return { success: true, result };
            }
            catch (error) {
                console.error('Execute query failed:', error);
                return { success: false, error: error.message };
            }
        });
    }
}
exports.default = new TrinoService();
