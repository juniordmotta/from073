import { z } from 'zod';

// Validação de Parceria
export const partnershipSchema = z.object({
  nome_completo: z
    .string()
    .trim()
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(100, 'Nome muito longo'),
  cpf: z
    .string()
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido (formato: 000.000.000-00)'),
  endereco: z
    .string()
    .trim()
    .min(5, 'Endereço muito curto')
    .max(200, 'Endereço muito longo'),
  valor_banca: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, 'Valor inválido'),
  data_inicio: z
    .string()
    .min(1, 'Data de início obrigatória'),
  status: z.enum(['ativo', 'inativo']),
});

// Validação de Custo Operacional
export const operationalCostSchema = z.object({
  descricao: z
    .string()
    .trim()
    .min(3, 'Descrição deve ter no mínimo 3 caracteres')
    .max(200, 'Descrição muito longa'),
  valor: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, 'Valor deve ser maior que zero'),
  data: z
    .string()
    .min(1, 'Data obrigatória'),
});

// Validação de Banco
export const bankSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(50, 'Nome muito longo'),
});

// Validação de Casa de Apostas
export const houseSchema = z.object({
  house_name: z
    .string()
    .trim()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(50, 'Nome muito longo'),
});

// Validação de Meta Mensal
export const monthlyGoalSchema = z.object({
  goal_value: z
    .string()
    .refine((val) => {
      const numericVal = parseFloat(val.replace(/\D/g, '')) / 100;
      return !isNaN(numericVal) && numericVal >= 0;
    }, 'Valor inválido'),
});

// Tipos exportados
export type PartnershipInput = z.infer<typeof partnershipSchema>;
export type OperationalCostInput = z.infer<typeof operationalCostSchema>;
export type BankInput = z.infer<typeof bankSchema>;
export type HouseInput = z.infer<typeof houseSchema>;
export type MonthlyGoalInput = z.infer<typeof monthlyGoalSchema>;
