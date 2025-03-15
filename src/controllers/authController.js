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
exports.getProfile = exports.login = exports.register = void 0;
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
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Please provide email and password' });
        }
        const user = yield db_1.default.users.findUnique({
            where: { email },
            include: { organization: true },
        });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const isPasswordMatch = yield bcrypt_1.default.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        res.status(200).json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            organization: {
                id: user.organization.id,
                name: user.organization.name,
                email: user.organization.email,
            },
            token: (0, jwt_1.generateToken)(user.id),
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
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
