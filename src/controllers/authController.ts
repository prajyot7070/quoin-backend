
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/db';
import { generateToken } from '../utils/jwt';

export const register = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, email, password, organizationName, organizationEmail } = req.body;
    
    if (!email || !password || !organizationName || !organizationEmail) {
      return res.status(400).json({ 
        message: 'Please provide email, password, organization name and organization email' 
      });
    }
    
    const userExists = await prisma.user.findUnique({
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
    
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'super-admin', 
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

export const login = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }
    

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true }, 
    });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    
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
      token: generateToken(user.id),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getProfile = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
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
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};