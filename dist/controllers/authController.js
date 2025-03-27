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
exports.createOrganization = exports.inviteUser = exports.resetPassword = exports.getProfile = exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const db_1 = __importDefault(require("../config/db"));
const jwt_1 = require("../utils/jwt");
const client_1 = require("@prisma/client");
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, email, password, organizationName, organizationEmail } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Please provide email and password' });
        }
        if (!organizationName || !organizationEmail) {
            return res.status(400).json({ message: 'Please provide organization name and email' });
        }
        const userExists = yield db_1.default.user.findUnique({ where: { email } });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const organization = yield db_1.default.organization.create({
            data: {
                name: organizationName,
                email: organizationEmail
            }
        });
        // Create user with valid organization ID 
        const salt = yield bcrypt_1.default.genSalt(10);
        const hashedPassword = yield bcrypt_1.default.hash(password, salt);
        const user = yield db_1.default.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                organizationId: organization.id,
                organizationMembership: {
                    create: {
                        organizationId: organization.id,
                        role: client_1.UserRole.ADMIN
                    }
                }
            }
        });
        res.status(201).json({
            success: true,
            token: (0, jwt_1.generateToken)(user.id),
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            },
            organization: {
                id: organization.id,
                name: organization.name,
                email: organization.email
            }
        });
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
        const user = yield db_1.default.user.findUnique({
            where: { email },
            include: {
                organization: true,
                organizationMembership: true
            }
        });
        if (!user) {
            res.status(401).json({ message: 'Invalid email or password' });
            return;
        }
        const isPasswordValid = yield bcrypt_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ message: 'Invalid email or password' });
            return;
        }
        const token = (0, jwt_1.generateToken)(user.id);
        res.status(200).json({
            success: true,
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            },
            organization: {
                id: user.organization.id,
                name: user.organization.name,
                email: user.organization.email
            }
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
        const user = yield db_1.default.user.findUnique({
            where: { id: (_a = req.users) === null || _a === void 0 ? void 0 : _a.id },
            select: {
                id: true,
                name: true,
                email: true,
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
                        description: true,
                        userId: true,
                    },
                },
                organizationMembership: {
                    select: {
                        role: true,
                        joinedAt: true
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
const resetPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    try {
        const user = yield db_1.default.user.findUnique({
            where: { email }
        });
        if (!user) {
            // Don't reveal if user exists for security
            res.status(200).json({
                success: true,
                message: 'If your email is registered, you will receive password reset instructions.'
            });
            return;
        }
        // Here you would generate a token and send email
        // For now just return success
        res.status(200).json({
            success: true,
            message: 'Password reset email sent'
        });
    }
    catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.resetPassword = resetPassword;
const inviteUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, name, role } = req.body;
        const organizationId = req.params.organizationId;
        // Check if user already exists
        const existingUser = yield db_1.default.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            // If user exists but was previously removed (has deletedAt set)
            if (existingUser.deletedAt) {
                // Reactivate the user
                yield db_1.default.user.update({
                    where: { id: existingUser.id },
                    data: {
                        deletedAt: null,
                        organizationId
                    }
                });
            }
            // Check if membership exists
            const existingMembership = yield db_1.default.organizationMembership.findFirst({
                where: {
                    userId: existingUser.id,
                    organizationId
                }
            });
            if (existingMembership) {
                if (existingMembership.deletedAt) {
                    // Reactivate membership
                    yield db_1.default.organizationMembership.update({
                        where: { id: existingMembership.id },
                        data: {
                            deletedAt: null,
                            role: role
                        }
                    });
                }
                else {
                    // Membership already active
                    res.status(400).json({ message: 'User is already a member of this organization' });
                    return;
                }
            }
            else {
                // Create new membership for existing user
                yield db_1.default.organizationMembership.create({
                    data: {
                        userId: existingUser.id,
                        organizationId,
                        role: role
                    }
                });
            }
            res.status(200).json({
                success: true,
                message: 'User added to organization',
                user: {
                    id: existingUser.id,
                    name: existingUser.name,
                    email: existingUser.email
                }
            });
            return;
        }
        // If user doesn't exist, create new user with organization
        const password = Math.random().toString(36).slice(-8);
        const salt = yield bcrypt_1.default.genSalt(10);
        const hashedPassword = yield bcrypt_1.default.hash(password, salt);
        const user = yield db_1.default.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                organizationId,
                organizationMembership: {
                    create: {
                        organizationId,
                        role: role
                    }
                }
            },
            include: {
                organization: true
            }
        });
        res.status(201).json({
            success: true,
            message: 'User invited successfully',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                organization: user.organization.name
            },
            password: password
        });
    }
    catch (error) {
        console.error('Invite user error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});
exports.inviteUser = inviteUser;
const createOrganization = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { name, email } = req.body;
        const userId = (_a = req.users) === null || _a === void 0 ? void 0 : _a.id;
        const organization = yield db_1.default.organization.create({
            data: {
                name,
                email
            }
        });
        // Update user's organization
        yield db_1.default.user.update({
            where: { id: userId },
            data: {
                organizationId: organization.id,
                organizationMembership: {
                    create: {
                        organizationId: organization.id,
                        role: client_1.UserRole.ADMIN
                    }
                }
            }
        });
        res.status(201).json({
            success: true,
            organization
        });
    }
    catch (error) {
        console.error('Create organization error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.createOrganization = createOrganization;
