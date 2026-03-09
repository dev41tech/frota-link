import { Router, Response } from 'express';
import { AuthRequest } from '../../types/index.js';
import { query, execute } from '../../db.js';
import { verifyJWT, requireRole } from '../../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(verifyJWT);

// GET /api/gestor-permissions?userId=:id
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.query;
    if (!userId) { res.status(400).json({ error: 'userId obrigatório' }); return; }
    const permissions = await query<any>(
      `SELECT module_key, enabled FROM gestor_permissions WHERE user_id=? AND company_id=?`,
      [userId, req.user!.companyId]
    );
    // Retornar como mapa { module_key: boolean }
    const map: Record<string, boolean> = {};
    for (const p of permissions) { map[p.module_key] = !!p.enabled; }
    res.json(map);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PUT /api/gestor-permissions/:userId  (admin only)
router.put('/:userId', requireRole('admin', 'master'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const permissions: Array<{ module_key: string; enabled: boolean }> = req.body.permissions;
    if (!Array.isArray(permissions)) { res.status(400).json({ error: 'permissions deve ser um array' }); return; }

    for (const p of permissions) {
      const existing = await query<any>(
        `SELECT id FROM gestor_permissions WHERE user_id=? AND company_id=? AND module_key=?`,
        [userId, req.user!.companyId, p.module_key]
      );
      if (existing.length > 0) {
        await execute(
          `UPDATE gestor_permissions SET enabled=?, updated_at=NOW() WHERE user_id=? AND company_id=? AND module_key=?`,
          [p.enabled ? 1 : 0, userId, req.user!.companyId, p.module_key]
        );
      } else {
        await execute(
          `INSERT INTO gestor_permissions (id, company_id, user_id, module_key, enabled, created_at, updated_at) VALUES (?,?,?,?,?,NOW(),NOW())`,
          [uuidv4(), req.user!.companyId, userId, p.module_key, p.enabled ? 1 : 0]
        );
      }
    }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
