import { z } from 'zod';

export const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  password: z
    .string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(72, 'Senha muito longa'),
  name: z
    .string()
    .trim()
    .min(1, 'Nome obrigatório')
    .max(100, 'Nome muito longo'),
  role: z.union([
    z.literal('admin_master'),
    z.literal('admin'),
    z.literal('operador')
  ]),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  password: z
    .string()
    .min(1, 'Senha obrigatória'),
});

export const signupSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  password: z
    .string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(72, 'Senha muito longa'),
  name: z
    .string()
    .trim()
    .min(1, 'Nome obrigatório')
    .max(100, 'Nome muito longo'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
