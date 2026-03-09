import { Router, Response } from 'express';
import { AuthRequest } from '../../types/index.js';
import { query, queryOne, execute } from '../../db.js';
import { verifyJWT } from '../../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(verifyJWT);

// GET /api/financial-accounts
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user!.companyId;
    const accounts = await query<any>(
      `SELECT fa.*,
         (fa.initial_balance
          + COALESCE((SELECT SUM(r.amount) FROM revenue r WHERE r.account_id = fa.id AND r.status = 'received' AND r.deleted_at IS NULL), 0)
          - COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.account_id = fa.id AND e.deleted_at IS NULL), 0)
          - COALESCE((SELECT SUM(ap.amount) FROM accounts_payable ap WHERE ap.payment_account_id = fa.id AND ap.status = 'paid' AND ap.deleted_at IS NULL), 0)
         ) AS current_balance
       FROM financial_accounts fa
       WHERE fa.company_id = ? AND fa.is_active = 1
       ORDER BY fa.name`,
      [companyId]
    );
    res.json(accounts);
  } catch (err) {
    console.error('GET /financial-accounts error:', err);
    res.status(500).json({ error: 'Erro ao buscar contas' });
  }
});

// GET /api/financial-accounts/:id/balance
router.get('/:id/balance', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user!.companyId;
    const { id } = req.params;
    const account = await queryOne<any>(
      `SELECT fa.*,
         COALESCE((SELECT SUM(r.amount) FROM revenue r WHERE r.account_id = fa.id AND r.status = 'received' AND r.deleted_at IS NULL), 0) AS total_in,
         COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.account_id = fa.id AND e.deleted_at IS NULL), 0)
         + COALESCE((SELECT SUM(ap.amount) FROM accounts_payable ap WHERE ap.payment_account_id = fa.id AND ap.status = 'paid' AND ap.deleted_at IS NULL), 0) AS total_out
       FROM financial_accounts fa
       WHERE fa.id = ? AND fa.company_id = ?`,
      [id, companyId]
    );
    if (!account) { res.status(404).json({ error: 'Conta não encontrada' }); return; }
    res.json({
      ...account,
      current_balance: account.initial_balance + account.total_in - account.total_out,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao calcular saldo' });
  }
});

// POST /api/financial-accounts
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user!.companyId;
    const { name, type, initial_balance, initial_balance_date, color } = req.body;
    if (!name || !type || initial_balance === undefined || !initial_balance_date) {
      res.status(400).json({ error: 'Campos obrigatórios: name, type, initial_balance, initial_balance_date' });
      return;
    }
    const id = uuidv4();
    await execute(
      `INSERT INTO financial_accounts (id, company_id, user_id, name, type, initial_balance, initial_balance_date, color, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [id, companyId, req.user!.userId, name, type, initial_balance, initial_balance_date, color || '#6366f1']
    );
    const created = await queryOne(`SELECT * FROM financial_accounts WHERE id = ?`, [id]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/financial-accounts/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user!.companyId;
    const { id } = req.params;
    const { name, type, initial_balance, initial_balance_date, color, is_active } = req.body;
    await execute(
      `UPDATE financial_accounts SET name=?, type=?, initial_balance=?, initial_balance_date=?, color=?, is_active=?, updated_at=NOW()
       WHERE id=? AND company_id=?`,
      [name, type, initial_balance, initial_balance_date, color, is_active ?? 1, id, companyId]
    );
    const updated = await queryOne(`SELECT * FROM financial_accounts WHERE id = ?`, [id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/financial-accounts/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user!.companyId;
    const { id } = req.params;
    // Soft-delete via is_active
    await execute(`UPDATE financial_accounts SET is_active=0, updated_at=NOW() WHERE id=? AND company_id=?`, [id, companyId]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
