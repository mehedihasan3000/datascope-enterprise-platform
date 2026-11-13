import { z } from 'zod';
import { ROLES } from '../constants/roles.js';

export const roleNameSchema = z.enum([ROLES.ADMIN, ROLES.ANALYST, ROLES.VIEWER]);

export const loginSchema = z.object({
  email: z.string().trim().email('Please provide a valid enterprise email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

export const registerSchema = z.object({
  email: z.string().trim().email('Please provide a valid enterprise email address').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  fullName: z.string().trim().min(2, 'Full name is required').max(150),
  role: roleNameSchema.optional().default(ROLES.ANALYST),
});

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  role: roleNameSchema,
  permissions: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
