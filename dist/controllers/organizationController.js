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
exports.removeMember = exports.updateMemberRole = exports.getUserOrganizationsWithProjects = exports.getOrganizationMembers = void 0;
const db_1 = __importDefault(require("../config/db"));
const client_1 = require("@prisma/client");
const getOrganizationMembers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const organizationId = req.params.organizationId;
        const members = yield db_1.default.user.findMany({
            where: {
                organizationId,
                deletedAt: null
            },
            include: {
                organizationMembership: true,
                projects: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
        const formattedMembers = members.map(member => {
            var _a, _b;
            return ({
                id: member.id,
                name: member.name,
                email: member.email,
                role: ((_a = member.organizationMembership) === null || _a === void 0 ? void 0 : _a.role) || 'VIEWER',
                joinedAt: ((_b = member.organizationMembership) === null || _b === void 0 ? void 0 : _b.joinedAt) || member.createdAt,
                projects: member.projects
            });
        });
        res.status(200).json({ members: formattedMembers });
    }
    catch (error) {
        console.error('Get members error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.getOrganizationMembers = getOrganizationMembers;
const getUserOrganizationsWithProjects = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.users) === null || _a === void 0 ? void 0 : _a.id;
        const organizations = yield db_1.default.organization.findMany({
            where: {
                users: {
                    some: {
                        id: userId,
                        deletedAt: null
                    }
                },
                deletedAt: null
            },
            include: {
                projects: {
                    where: {
                        deletedAt: null
                    },
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        createdAt: true
                    }
                }
            }
        });
        res.status(200).json({
            success: true,
            organizations
        });
    }
    catch (error) {
        console.error('Get user organizations error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.getUserOrganizationsWithProjects = getUserOrganizationsWithProjects;
const updateMemberRole = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { organizationId, userId } = req.params;
        const { role } = req.body;
        if (!Object.values(client_1.UserRole).includes(role)) {
            res.status(400).json({ message: 'Invalid role' });
            return;
        }
        const membership = yield db_1.default.organizationMembership.findFirst({
            where: {
                userId,
                organizationId
            }
        });
        if (!membership) {
            res.status(404).json({ message: 'Member not found in organization' });
            return;
        }
        const updatedMembership = yield db_1.default.organizationMembership.update({
            where: {
                id: membership.id
            },
            data: {
                role: role
            },
            include: {
                user: true
            }
        });
        res.status(200).json({
            success: true,
            member: {
                id: updatedMembership.user.id,
                name: updatedMembership.user.name,
                email: updatedMembership.user.email,
                role: updatedMembership.role
            }
        });
    }
    catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.updateMemberRole = updateMemberRole;
const removeMember = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { organizationId, userId } = req.params;
        // Check if user is in organization
        const user = yield db_1.default.user.findFirst({
            where: {
                id: userId,
                organizationId
            }
        });
        if (!user) {
            res.status(404).json({ message: 'Member not found in organization' });
            return;
        }
        // Use soft delete - set deletedAt timestamp
        yield db_1.default.user.update({
            where: {
                id: userId
            },
            data: {
                deletedAt: new Date()
            }
        });
        // Also mark the membership as deleted
        const membership = yield db_1.default.organizationMembership.findFirst({
            where: {
                userId,
                organizationId
            }
        });
        if (membership) {
            yield db_1.default.organizationMembership.update({
                where: {
                    id: membership.id
                },
                data: {
                    deletedAt: new Date()
                }
            });
        }
        res.status(200).json({
            success: true,
            message: 'Member removed from organization'
        });
    }
    catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.removeMember = removeMember;
