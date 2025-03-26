// authController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/db';
import { generateToken } from '../utils/jwt';
import { UserRole } from '@prisma/client';

export const register = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, email, password, organizationName, organizationEmail } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }
    
    if (!organizationName || !organizationEmail) {
      return res.status(400).json({ message: 'Please provide organization name and email' });
    }
    
    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const organization = await prisma.organization.create({
      data: {
        name: organizationName,
        email: organizationEmail
      }
    });

    // Create user with valid organization ID 
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        organizationId: organization.id,
        organizationMembership: {
          create: {
            organizationId: organization.id,
            role: UserRole.ADMIN
          }
        }
      }
    });
    
    res.status(201).json({
      success: true,
      token: generateToken(user.id),
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
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  
  try {
    const user = await prisma.user.findUnique({
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
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }
    
    const token = generateToken(user.id);
    
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
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'An error occurred during login', error: (error as Error).message });
  }
};

export const getProfile = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.users?.id },
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
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  
  try {
    const user = await prisma.user.findUnique({
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
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const inviteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, name, role } = req.body;
    const organizationId = req.params.organizationId;
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      // If user exists but was previously removed (has deletedAt set)
      if (existingUser.deletedAt) {
        // Reactivate the user
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { 
            deletedAt: null,
            organizationId
          }
        });
      }
      
      // Check if membership exists
      const existingMembership = await prisma.organizationMembership.findFirst({
        where: { 
          userId: existingUser.id,
          organizationId
        }
      });
      
      if (existingMembership) {
        if (existingMembership.deletedAt) {
          // Reactivate membership
          await prisma.organizationMembership.update({
            where: { id: existingMembership.id },
            data: { 
              deletedAt: null,
              role: role as UserRole
            }
          });
        } else {
          // Membership already active
          res.status(400).json({ message: 'User is already a member of this organization' });
          return;
        }
      } else {
        // Create new membership for existing user
        await prisma.organizationMembership.create({
          data: {
            userId: existingUser.id,
            organizationId,
            role: role as UserRole
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
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        organizationId,
        organizationMembership: {
          create: {
            organizationId,
            role: role as UserRole
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
  } catch (error) {
    console.error('Invite user error:', error);
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const createOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email } = req.body;
    const userId = req.users?.id;
    
    const organization = await prisma.organization.create({
      data: {
        name,
        email
      }
    });
    
    // Update user's organization
    await prisma.user.update({
      where: { id: userId },
      data: { 
        organizationId: organization.id,
        organizationMembership: {
          create: {
            organizationId: organization.id,
            role: UserRole.ADMIN
          }
        }
      }
    });
    
    res.status(201).json({
      success: true,
      organization
    });
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};