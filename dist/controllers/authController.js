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
exports.getProject = exports.getProfile = exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const db_1 = __importDefault(require("../config/db"));
const jwt_1 = require("../utils/jwt");
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, email, password, organizationName, organizationEmail } = req.body;
        if (!email || !password || !organizationName || !organizationEmail) {
            return res.status(400).json({
                message: 'Please provide email, password, organization name and organization email'
            });
        }
        const userExists = yield db_1.default.users.findUnique({
            where: { email },
        });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const salt = yield bcrypt_1.default.genSalt(10);
        const hashedPassword = yield bcrypt_1.default.hash(password, salt);
        const organization = yield db_1.default.organization.create({
            data: {
                name: organizationName,
                email: organizationEmail,
            },
        });
        const user = yield db_1.default.users.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: 'super-admin', //add role types later
                organizationId: organization.id,
            },
        });
        if (user) {
            res.status(201).json({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                organization: {
                    id: organization.id,
                    name: organization.name,
                    email: organization.email,
                },
                token: (0, jwt_1.generateToken)(user.id),
            });
        }
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.register = register;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    try {
        // Find user by email with proper logging
        const user = yield db_1.default.users.findUnique({
            where: { email },
            include: {
                organization: true,
                projects: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                }
            }
        });
        console.log('User object:', JSON.stringify(user, null, 2));
        if (!user) {
            res.status(401).json({ message: 'Invalid email or password' });
            return;
        }
        // Verify password
        const isPasswordValid = yield bcrypt_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ message: 'Invalid email or password' });
            return;
        }
        // Generate token
        const token = (0, jwt_1.generateToken)(user.id); // Use your existing token generator for consistency
        // Return data in the SAME structure as your register function
        res.status(200).json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            organization: {
                id: user.organization.id,
                name: user.organization.name,
                email: user.organization.email
            },
            projects: user.projects, // Include projects array here
            token: token
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'An error occurred during login', error: error.message });
    }
});
exports.login = login;
const getProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const user = yield db_1.default.users.findUnique({
            where: { id: (_a = req.users) === null || _a === void 0 ? void 0 : _a.id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                organization: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                projects: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                }
            },
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.getProfile = getProfile;
const getProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
    }
    try {
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
                }
            }
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        return res.status(200).json({
            message: "Project retrieved successfully",
            project: {
                id: project.id,
                name: project.name,
                description: project.description,
                user: project.user,
                connections: project.connections,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt
            }
        });
    }
    catch (error) {
        console.error('Get project failed:', error);
        return res.status(500).json({
            message: "Failed to retrieve project",
            error: error.message
        });
    }
});
exports.getProject = getProject;
