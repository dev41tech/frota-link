import { Router, Response } from "express";
import { AuthRequest } from "../types/index.js";
import { queryRows, queryOne, queryExec } from "../db.js";
import { verifyJWT } from "../middleware/auth.js";
import { v4 as uuidv4 } from "uuid";
import { RowDataPacket } from "mysql2/promise";

const router = Router();

const ALLOWED_TABLES = new Set([
  'profiles',
  'user_roles',
  'companies',
  'drivers',
  'vehicles',
  'journeys',
  'journey_legs',
  'expenses',
  'fuel_expenses',
  'revenue',
  'accounts_payable',
  'expense_categories',
  'revenue_categories',
  'parties',
  'vehicle_maintenances',
  'maintenance_parts',
  'maintenance_schedules',
  'workshops',
  'tire_assets',
  'tire_logs',
  'tire_history',
  'bank_transactions',
  'bank_reconciliations',
  'cte_documents',
  'cte_settings',
  'cte_series',
  'mdfe_documents',
  'mdfe_cte_links',
  'driver_messages',
  'driver_performance_history',
  'vehicle_couplings',
  'vehicle_coupling_items',
  'saved_couplings',
  'journey_checklists',
  'incidents',
  'announcements',
  'freight_requests',
  'freight_rates',
  'freight_pricing_settings',
  'financial_accounts',
  'financial_reserves',
  'financial_reserve_entries',
  'gestor_permissions',
  'system_alerts',
  'system_settings',
  'subscription_plans',
]);

const GLOBAL_TABLES = new Set(["subscription_plans", "system_settings"]);

function buildWhereClause(
  queryParams: Record<string, any>,
  companyId: string,
  tableName: string
): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];

  // Regra especial: companies não tem company_id.
  // Usuário comum só pode enxergar a própria empresa.
  if (tableName === 'companies') {
    conditions.push('id = ?');
    params.push(companyId);
  } else if (!GLOBAL_TABLES.has(tableName)) {
    conditions.push('company_id = ?');
    params.push(companyId);
  }

  const eqFilters = queryParams.eq as Record<string, string> | undefined;
  if (eqFilters && typeof eqFilters === 'object') {
    for (const [field, value] of Object.entries(eqFilters)) {
      conditions.push(`${field} = ?`);
      params.push(value);
    }
  }

  const reserved = new Set(['eq', 'order', 'limit', 'offset', 'select']);
  for (const [key, val] of Object.entries(queryParams)) {
    if (!reserved.has(key) && val !== undefined) {
      conditions.push(`${key} = ?`);
      params.push(val);
    }
  }

  return {
    sql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

router.use(verifyJWT);

// GET /api/:table
router.get("/:table", async (req: AuthRequest, res: Response) => {
  const { table } = req.params;

  if (!ALLOWED_TABLES.has(table)) {
    res.status(403).json({ error: "Tabela não permitida" });
    return;
  }

  try {
    const companyId = req.user!.companyId;
    const { sql: whereSql, params } = buildWhereClause(
      req.query as Record<string, unknown>,
      companyId,
      table
    );

    const orderBy = (req.query.order as string) || "created_at";
    const limit = Math.min(parseInt((req.query.limit as string) || "1000", 10), 5000);
    const offset = parseInt((req.query.offset as string) || "0", 10);

    const rows = await queryRows<RowDataPacket[]>(
      `SELECT * FROM \`${table}\` ${whereSql} ORDER BY \`${orderBy}\` LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json(rows);
  } catch (err) {
    console.error(`GET /${table} error:`, err);
    res.status(500).json({ error: "Erro ao buscar dados" });
  }
});

// GET /api/:table/:id
router.get('/:table/:id', async (req: AuthRequest, res: Response) => {
  const { table, id } = req.params;

  if (!ALLOWED_TABLES.has(table)) {
    res.status(403).json({ error: 'Tabela não permitida' });
    return;
  }

  try {
    const companyId = req.user!.companyId;

    let sql = '';
    let params: any[] = [];

    if (table === 'companies') {
      // usuário só pode buscar a própria empresa
      sql = `SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`;
      params = [companyId];
    } else if (GLOBAL_TABLES.has(table)) {
      sql = `SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`;
      params = [id];
    } else {
      sql = `SELECT * FROM \`${table}\` WHERE id = ? AND company_id = ? LIMIT 1`;
      params = [id, companyId];
    }

    const row = await queryOne(sql, params);

    if (!row) {
      res.status(404).json({ error: 'Registro não encontrado' });
      return;
    }

    res.json(row);
  } catch (err) {
    console.error(`GET /${table}/${id} error:`, err);
    res.status(500).json({ error: 'Erro ao buscar registro' });
  }
});

// POST /api/:table
// POST /api/:table
router.post("/:table", async (req: AuthRequest, res: Response) => {
  const { table } = req.params;

  if (!ALLOWED_TABLES.has(table)) {
    res.status(403).json({ error: "Tabela não permitida" });
    return;
  }

  try {
    const companyId = req.user!.companyId;

    const data: Record<string, unknown> =
      table === "companies"
        ? {
            ...req.body,
            id: req.body.id || uuidv4(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        : {
            ...req.body,
            id: req.body.id || uuidv4(),
            company_id: companyId,
            user_id: req.body.user_id || req.user!.userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

    const fields = Object.keys(data).map((k) => `\`${k}\``).join(", ");
    const placeholders = Object.keys(data).map(() => "?").join(", ");
    const values = Object.values(data);

    await queryExec(
      `INSERT INTO \`${table}\` (${fields}) VALUES (${placeholders})`,
      values
    );

    const inserted = await queryOne<RowDataPacket>(
      `SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`,
      [data.id]
    );

    res.status(201).json(inserted);
  } catch (err: unknown) {
    console.error(`POST /${table} error:`, err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao inserir",
    });
  }
});

// PUT /api/:table/:id
router.put("/:table/:id", async (req: AuthRequest, res: Response) => {
  const { table, id } = req.params;

  if (!ALLOWED_TABLES.has(table)) {
    res.status(403).json({ error: "Tabela não permitida" });
    return;
  }

  try {
    const companyId = req.user!.companyId;
    const data: Record<string, unknown> = {
      ...req.body,
      updated_at: new Date().toISOString(),
    };

    delete data.id;
    delete data.company_id;

    const setClause = Object.keys(data)
      .map((k) => `\`${k}\` = ?`)
      .join(", ");

    let result;

    if (table === "companies") {
      if (id !== companyId) {
        res.status(403).json({ error: "Acesso negado" });
        return;
      }

      result = await queryExec(
        `UPDATE \`${table}\` SET ${setClause} WHERE id = ?`,
        [...Object.values(data), id]
      );
    } else if (GLOBAL_TABLES.has(table)) {
      result = await queryExec(
        `UPDATE \`${table}\` SET ${setClause} WHERE id = ?`,
        [...Object.values(data), id]
      );
    } else {
      result = await queryExec(
        `UPDATE \`${table}\` SET ${setClause} WHERE id = ? AND company_id = ?`,
        [...Object.values(data), id, companyId]
      );
    }

    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Registro não encontrado" });
      return;
    }

    const updated = await queryOne<RowDataPacket>(
      `SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`,
      [id]
    );

    res.json(updated);
  } catch (err: unknown) {
    console.error(`PUT /${table}/${id} error:`, err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao atualizar",
    });
  }
});

// DELETE /api/:table/:id
router.delete("/:table/:id", async (req: AuthRequest, res: Response) => {
  const { table, id } = req.params;

  if (!ALLOWED_TABLES.has(table)) {
    res.status(403).json({ error: "Tabela não permitida" });
    return;
  }

  try {
    const companyId = req.user!.companyId;

    let result;

    if (table === "companies") {
      if (id !== companyId) {
        res.status(403).json({ error: "Acesso negado" });
        return;
      }

      result = await queryExec(
        `DELETE FROM \`${table}\` WHERE id = ?`,
        [id]
      );
    } else if (GLOBAL_TABLES.has(table)) {
      result = await queryExec(
        `DELETE FROM \`${table}\` WHERE id = ?`,
        [id]
      );
    } else {
      result = await queryExec(
        `DELETE FROM \`${table}\` WHERE id = ? AND company_id = ?`,
        [id, companyId]
      );
    }

    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Registro não encontrado" });
      return;
    }

    res.json({ success: true });
  } catch (err: unknown) {
    console.error(`DELETE /${table}/${id} error:`, err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao deletar",
    });
  }
});