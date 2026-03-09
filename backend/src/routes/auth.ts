import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, queryOne } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Tabela em memória simples de refresh tokens (em produção usar Redis ou tabela DB)
const refreshTokenStore = new Map<string, string>(); // token -> userId

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email e senha obrigatórios' });
      return;
    }

    // Buscar usuário na tabela profiles
    const profile = await queryOne<any>(
      `SELECT p.*, ur.role, ur.company_id as ur_company_id
       FROM profiles p
       LEFT JOIN user_roles ur ON ur.user_id = p.user_id
       WHERE p.email = ? AND p.deleted_at IS NULL
       LIMIT 1`,
      [email]
    );

    if (!profile) {
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }

    // Verificar senha (hash bcrypt)
    const validPassword = await bcrypt.compare(password, profile.password_hash || '');
    if (!validPassword) {
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }

    const payload = {
      userId: profile.user_id,
      companyId: profile.ur_company_id || profile.company_id || '',
      role: profile.role || 'admin',
    };

    const access_token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    } as any);

    const refresh_token = uuidv4();
    refreshTokenStore.set(refresh_token, profile.user_id);

    res.json({
      access_token,
      refresh_token,
      user: {
        id: profile.user_id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        company_id: payload.companyId,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      res.status(400).json({ error: 'Refresh token obrigatório' });
      return;
    }

    const userId = refreshTokenStore.get(refresh_token);
    if (!userId) {
      res.status(401).json({ error: 'Refresh token inválido' });
      return;
    }

    const profile = await queryOne<any>(
      `SELECT p.*, ur.role, ur.company_id as ur_company_id
       FROM profiles p
       LEFT JOIN user_roles ur ON ur.user_id = p.user_id
       WHERE p.user_id = ?
       LIMIT 1`,
      [userId]
    );

    if (!profile) {
      res.status(401).json({ error: 'Usuário não encontrado' });
      return;
    }

    const payload = {
      userId: profile.user_id,
      companyId: profile.ur_company_id || profile.company_id || '',
      role: profile.role || 'admin',
    };

    const access_token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    } as any);

    res.json({ access_token });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    const token = authHeader.substring(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;

    const profile = await queryOne<any>(
      `SELECT p.*, ur.role, c.name as company_name, c.cnpj
       FROM profiles p
       LEFT JOIN user_roles ur ON ur.user_id = p.user_id AND ur.company_id = ?
       LEFT JOIN companies c ON c.id = ?
       WHERE p.user_id = ?
       LIMIT 1`,
      [payload.companyId, payload.companyId, payload.userId]
    );

    res.json({ user: profile, companyId: payload.companyId, role: payload.role });
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  const { refresh_token } = req.body;
  if (refresh_token) {
    refreshTokenStore.delete(refresh_token);
  }
  res.json({ success: true });
});

export default router;
