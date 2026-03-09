import { Router, Response } from 'express';
import { AuthRequest } from '../../types/index.js';
import { query, queryOne, execute } from '../../db.js';
import { verifyJWT } from '../../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(verifyJWT);

// GET /api/financial-reserves
router.get('/', async (req: AuthRequest, res: Response) => {
  const rows = await query(`SELECT * FROM financial_reserves WHERE company_id=? ORDER BY name`, [req.user!.companyId]);
  res.json(rows);
});

// POST /api/financial-reserves
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, default_percentage, color } = req.body;
    const id = uuidv4();
    await execute(
      `INSERT INTO financial_reserves (id, company_id, user_id, name, description, default_percentage, color, current_balance, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
      [id, req.user!.companyId, req.user!.userId, name, description || null, default_percentage || null, color || '#6366f1']
    );
    res.status(201).json(await queryOne(`SELECT * FROM financial_reserves WHERE id=?`, [id]));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PUT /api/financial-reserves/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, default_percentage, color } = req.body;
    await execute(
      `UPDATE financial_reserves SET name=?, description=?, default_percentage=?, color=?, updated_at=NOW() WHERE id=? AND company_id=?`,
      [name, description || null, default_percentage || null, color || '#6366f1', req.params.id, req.user!.companyId]
    );
    res.json(await queryOne(`SELECT * FROM financial_reserves WHERE id=?`, [req.params.id]));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/financial-reserves/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const reserve = await queryOne<any>(`SELECT current_balance FROM financial_reserves WHERE id=? AND company_id=?`, [req.params.id, req.user!.companyId]);
    if (!reserve) { res.status(404).json({ error: 'Caixa não encontrada' }); return; }
    if (parseFloat(reserve.current_balance) !== 0) {
      res.status(400).json({ error: 'Caixa com saldo diferente de zero não pode ser excluída' });
      return;
    }
    await execute(`DELETE FROM financial_reserves WHERE id=? AND company_id=?`, [req.params.id, req.user!.companyId]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/financial-reserves/entries
router.get('/entries', async (req: AuthRequest, res: Response) => {
  const { reserveId } = req.query;
  let sql = `SELECT fre.*, fr.name as reserve_name FROM financial_reserve_entries fre JOIN financial_reserves fr ON fr.id=fre.reserve_id WHERE fre.company_id=?`;
  const params: any[] = [req.user!.companyId];
  if (reserveId) { sql += ` AND fre.reserve_id=?`; params.push(reserveId); }
  sql += ` ORDER BY fre.date DESC, fre.created_at DESC`;
  res.json(await query(sql, params));
});

// POST /api/financial-reserves/entries
router.post('/entries', async (req: AuthRequest, res: Response) => {
  try {
    const { reserve_id, amount, entry_type, description, date, journey_id, expense_id, percentage_applied } = req.body;
    if (!reserve_id || amount === undefined || !entry_type) {
      res.status(400).json({ error: 'reserve_id, amount e entry_type obrigatórios' });
      return;
    }

    const finalAmount = entry_type === 'withdrawal' ? -Math.abs(amount) : Math.abs(amount);
    const id = uuidv4();

    await execute(
      `INSERT INTO financial_reserve_entries (id, company_id, reserve_id, journey_id, expense_id, amount, percentage_applied, description, entry_type, date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, req.user!.companyId, reserve_id, journey_id || null, expense_id || null, finalAmount, percentage_applied || null, description || null, entry_type, date || new Date().toISOString().split('T')[0]]
    );

    // Atualizar saldo da caixa
    await execute(`UPDATE financial_reserves SET current_balance = current_balance + ?, updated_at=NOW() WHERE id=?`, [finalAmount, reserve_id]);

    res.status(201).json(await queryOne(`SELECT * FROM financial_reserve_entries WHERE id=?`, [id]));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
