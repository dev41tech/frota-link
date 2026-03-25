import { Router, Response } from 'express';
import { AuthRequest } from '../types/index.js';
import { verifyJWT } from '../middleware/auth.js';
import { queryOne } from '../db.js';

const router = Router();

router.use(verifyJWT);

router.post('/is_master_user', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const profile = await queryOne<any>(
      `
      SELECT p.role
      FROM profiles p
      WHERE p.user_id = ?
      LIMIT 1
      `,
      [userId]
    );

    const role = String(profile?.role || '').toLowerCase();
    const isMaster = role === 'master';

    res.json(isMaster);
  } catch (error) {
    console.error('RPC is_master_user error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;