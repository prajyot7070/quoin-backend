import { Request, Response } from 'express';
import prisma from '../config/db';
import { UserRole } from '@prisma/client';

export const getOrganizationMembers = async (req: Request, res: Response): Promise<void> => {
 try {
   const organizationId = req.params.organizationId;
   
   const members = await prisma.user.findMany({
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
   
   const formattedMembers = members.map(member => ({
     id: member.id,
     name: member.name,
     email: member.email,
     role: member.organizationMembership?.role || 'VIEWER',
     joinedAt: member.organizationMembership?.joinedAt || member.createdAt,
     projects: member.projects
   }));
   
   res.status(200).json({ members: formattedMembers });
 } catch (error) {
   console.error('Get members error:', error);
   res.status(500).json({ message: 'Server error' });
 }
};

export const getUserOrganizationsWithProjects = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.users?.id;
      
      const organizations = await prisma.organization.findMany({
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
    } catch (error) {
      console.error('Get user organizations error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };

export const updateMemberRole = async (req: Request, res: Response): Promise<void> => {
 try {
   const { organizationId, userId } = req.params;
   const { role } = req.body;
   
   if (!Object.values(UserRole).includes(role as UserRole)) {
     res.status(400).json({ message: 'Invalid role' });
     return;
   }
   
   const membership = await prisma.organizationMembership.findFirst({
     where: {
       userId,
       organizationId
     }
   });
   
   if (!membership) {
     res.status(404).json({ message: 'Member not found in organization' });
     return;
   }
   
   const updatedMembership = await prisma.organizationMembership.update({
     where: {
       id: membership.id
     },
     data: {
       role: role as UserRole
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
 } catch (error) {
   console.error('Update role error:', error);
   res.status(500).json({ message: 'Server error' });
 }
};

export const removeMember = async (req: Request, res: Response): Promise<void> => {
 try {
   const { organizationId, userId } = req.params;
   
   // Check if user is in organization
   const user = await prisma.user.findFirst({
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
   await prisma.user.update({
     where: {
       id: userId
     },
     data: {
       deletedAt: new Date()
     }
   });
   
   // Also mark the membership as deleted
   const membership = await prisma.organizationMembership.findFirst({
     where: {
       userId,
       organizationId
     }
   });
   
   if (membership) {
     await prisma.organizationMembership.update({
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
 } catch (error) {
   console.error('Remove member error:', error);
   res.status(500).json({ message: 'Server error' });
 }
};