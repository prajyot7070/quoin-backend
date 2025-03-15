
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/db';
import { generateToken } from '../utils/jwt';
import jwt from 'jsonwebtoken';

export const register = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, email, password, organizationName, organizationEmail } = req.body;
    
    if (!email || !password || !organizationName || !organizationEmail) {
      return res.status(400).json({ 
        message: 'Please provide email, password, organization name and organization email' 
      });
    }
    
    const userExists = await prisma.users.findUnique({
      where: { email },
    });
    
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }
    

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    

    const organization = await prisma.organization.create({
      data: {
        name: organizationName,
        email: organizationEmail,
      },
    });
    
    const user = await prisma.users.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'super-admin',  //add role types later
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
        token: generateToken(user.id),
      });
    }
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  
  try {
    // Find user by email with proper logging
    const user = await prisma.users.findUnique({
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
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }
    
    // Generate token
    const token = generateToken(user.id);  // Use your existing token generator for consistency
    
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
      projects: user.projects,  // Include projects array here
      token: token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'An error occurred during login', error: (error as Error).message });
  }
};

export const getProfile = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.users?.id },
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


export const getProject = async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.id);
  
  if (isNaN(projectId)) {
    return res.status(400).json({ message: "Invalid project ID" });
  }
  
  try {
    const project = await prisma.project.findUnique({
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
  } catch (error) {
    console.error('Get project failed:', error);
    return res.status(500).json({ 
      message: "Failed to retrieve project", 
      error: (error as Error).message 
    });
  }
};


