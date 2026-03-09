import { Router, Response } from 'express';
import { AuthRequest } from '../../types/index.js';
import { queryOne, execute } from '../../db.js';
import { verifyJWT } from '../../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(verifyJWT);

// POST /api/expenses/journey — cria despesa de jornada com cálculo especial
router.post('/journey', async (req: AuthRequest, res: Response) => {
  try {
    const {
      journey_id, category_id, category, description, date, supplier,
      payment_method, notes, journey_leg_id,
      calculation_type = 'fixed', amount, unit_value, percentage_value, reserve_id,
      account_id,
    } = req.body;

    if (!journey_id) { res.status(400).json({ error: 'journey_id obrigatório' }); return; }

    // Buscar dados da jornada para cálculos
    const journey = await queryOne<any>(`SELECT distance, freight_value, start_km, end_km FROM journeys WHERE id=? AND company_id=?`, [journey_id, req.user!.companyId]);
    if (!journey) { res.status(404).json({ error: 'Jornada não encontrada' }); return; }

    const km = journey.distance ?? ((journey.end_km ?? 0) - (journey.start_km ?? 0));
    const freightValue = parseFloat(journey.freight_value || 0);

    let finalAmount: number;
    switch (calculation_type) {
      case 'per_km':
        if (!unit_value || !km) { res.status(400).json({ error: 'unit_value e KM da jornada são obrigatórios para cálculo por KM' }); return; }
        finalAmount = parseFloat(unit_value) * km;
        break;
      case 'percentage':
      case 'reserve':
        if (!percentage_value) { res.status(400).json({ error: 'percentage_value obrigatório' }); return; }
        finalAmount = (parseFloat(percentage_value) / 100) * freightValue;
        break;
      default:
        finalAmount = parseFloat(amount);
    }

    if (isNaN(finalAmount) || finalAmount < 0) {
      res.status(400).json({ error: 'Valor calculado inválido' });
      return;
    }

    const id = uuidv4();
    await execute(
      `INSERT INTO expenses (id, user_id, company_id, journey_id, journey_leg_id, category, category_id, description, amount, date, supplier, payment_method, notes, status, calculation_type, unit_value, percentage_value, reserve_id, account_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, req.user!.userId, req.user!.companyId, journey_id, journey_leg_id || null, category || 'Outros', category_id || null, description, finalAmount, date, supplier || null, payment_method || null, notes || null, calculation_type, unit_value || null, percentage_value || null, reserve_id || null, account_id || null]
    );

    // Se for aporte à caixa (reserve), criar entrada na caixa
    if (calculation_type === 'reserve' && reserve_id) {
      const entryId = uuidv4();
      await execute(
        `INSERT INTO financial_reserve_entries (id, company_id, reserve_id, journey_id, expense_id, amount, percentage_applied, description, entry_type, date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'journey_contribution', ?, NOW())`,
        [entryId, req.user!.companyId, reserve_id, journey_id, id, finalAmount, percentage_value || null, description || 'Aporte de jornada', date]
      );
      await execute(`UPDATE financial_reserves SET current_balance = current_balance + ?, updated_at=NOW() WHERE id=?`, [finalAmount, reserve_id]);
    }

    const inserted = await queryOne(`SELECT * FROM expenses WHERE id=?`, [id]);
    res.status(201).json({ ...inserted, computed_amount: finalAmount, km_used: km });
  } catch (err: any) {
    console.error('POST /expenses/journey error:', err);
    res.status(500).json({ error: err.message || 'Erro ao criar despesa' });
  }
});

export default router;
