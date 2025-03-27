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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProject = exports.getProjectsForOrganization = exports.getProject = exports.createProject = void 0;
const db_1 = __importDefault(require("../config/db"));
const trino_1 = require("../config/trino");
const pg_1 = require("pg"); // For PostgreSQL testing
const createProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { name, description, organizationId, connectionType, connectionDetails } = req.body;
        const userId = (_a = req.users) === null || _a === void 0 ? void 0 : _a.id;
        // Test connection based on type
        try {
            if (connectionType === 'trino') {
                const trinoConfig = {
                    server: connectionDetails.server,
                    catalog: connectionDetails.catalog,
                    schema: connectionDetails.schema,
                    extraHeaders: Object.assign({ 'X-Trino-User': 'trino_user' }, (connectionDetails.headers || {})),
                    auth: connectionDetails.auth,
                    ssl: connectionDetails.ssl,
                    source: connectionDetails.source
                };
                const client = yield (0, trino_1.createTrinoClient)(trinoConfig);
                yield client.query('SELECT 1 AS success');
            }
            else if (connectionType === 'postgres' || connectionType === 'neon') {
                const { host, port, database, user, password } = connectionDetails.auth;
                const pool = new pg_1.Pool({
                    host,
                    port,
                    database,
                    user,
                    password,
                    ssl: connectionDetails.ssl || undefined
                });
                // Test connection
                const client = yield pool.connect();
                yield client.query('SELECT 1');
                client.release();
                yield pool.end();
            }
            else if (connectionType === 'supabase') {
                const { url, apiKey } = connectionDetails.auth;
                // Test Supabase connection using fetch
                const response = yield fetch(`${url}/rest/v1/?apikey=${apiKey}`, {
                    headers: {
                        'apikey': apiKey,
                        'Authorization': `Bearer ${apiKey}`
                    }
                });
                if (!response.ok) {
                    throw new Error(`Supabase connection failed: ${response.statusText}`);
                }
            }
            else if (connectionType === 'firebase') {
                const { projectId, apiKey } = connectionDetails.auth;
                // Test Firebase connection with a simple REST call
                const response = yield fetch(`https://firebaseio.com/${projectId}/.json?auth=${apiKey}`);
                if (!response.ok) {
                    throw new Error(`Firebase connection failed: ${response.statusText}`);
                }
            }
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: `Connection test failed for ${connectionType}`,
                error: error.message
            });
            return;
        }
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        // Create project and connection
        const result = yield db_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const project = yield tx.project.create({
                data: {
                    name,
                    description,
                    userId,
                    organizationId
                }
            });
            const connection = yield tx.connection.create({
                data: {
                    name: connectionDetails.name,
                    server: connectionDetails.server || '',
                    catalog: connectionDetails.catalog || 'default',
                    schema: connectionDetails.schema || 'public',
                    projectId: project.id,
                    source: connectionType,
                    auth: connectionDetails.auth || {},
                    extraHeaders: connectionDetails.extraHeaders || {},
                    ssl: connectionDetails.ssl || {},
                    extraCredential: connectionDetails.extraCredential || {},
                    session: connectionDetails.session || {}
                }
            });
            return { project, connection };
        }));
        res.status(201).json({
            success: true,
            project: result.project,
            connection: result.connection
        });
    }
    catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ message: "Failed to create project" });
    }
});
exports.createProject = createProject;
const getProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectId = req.params.id;
        const project = yield db_1.default.project.findUnique({
            where: { id: projectId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                connections: {
                    select: {
                        id: true,
                        name: true,
                        server: true,
                        catalog: true,
                        schema: true,
                        source: true,
                        createdAt: true,
                        updatedAt: true
                    }
                },
                organization: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
        if (!project) {
            res.status(404).json({ message: "Project not found" });
            return;
        }
        res.status(200).json({
            success: true,
            project
        });
    }
    catch (error) {
        console.error('Get project failed:', error);
        res.status(500).json({
            message: "Failed to retrieve project",
            error: error.message
        });
    }
});
exports.getProject = getProject;
const getProjectsForOrganization = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const organizationId = req.params.organizationId;
        const projects = yield db_1.default.project.findMany({
            where: {
                organizationId,
                deletedAt: null
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                connections: {
                    select: {
                        id: true,
                        name: true,
                        source: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.status(200).json({
            success: true,
            projects
        });
    }
    catch (error) {
        console.error('Get organization projects failed:', error);
        res.status(500).json({
            message: "Failed to retrieve projects",
            error: error.message
        });
    }
});
exports.getProjectsForOrganization = getProjectsForOrganization;
const deleteProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const projectId = req.params.id;
        const userId = (_a = req.users) === null || _a === void 0 ? void 0 : _a.id;
        // Get user's role in the organization that owns this project
        const project = yield db_1.default.project.findUnique({
            where: { id: projectId },
            include: { organization: true }
        });
        if (!project) {
            res.status(404).json({ message: "Project not found" });
            return;
        }
        const membership = yield db_1.default.organizationMembership.findFirst({
            where: {
                userId,
                organizationId: project.organizationId
            }
        });
        // Check if user is ADMIN
        if (!membership || membership.role !== 'ADMIN') {
            res.status(403).json({ message: "Only administrators can delete projects" });
            return;
        }
        // Soft delete
        yield db_1.default.project.update({
            where: { id: projectId },
            data: { deletedAt: new Date() }
        });
        res.status(200).json({
            success: true,
            message: "Project deleted successfully"
        });
    }
    catch (error) {
        console.error('Delete project failed:', error);
        res.status(500).json({
            message: "Failed to delete project",
            error: error.message
        });
    }
});
exports.deleteProject = deleteProject;
