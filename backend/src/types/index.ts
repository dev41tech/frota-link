import { Request } from 'express';

export interface JwtPayload {
  userId: string;
  companyId: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export type AppRole = 'master' | 'admin' | 'gestor' | 'motorista' | 'driver' | 'bpo' | 'suporte';
