import { Router, Response } from "express";
import { AuthRequest } from "../types/index.js";
import { queryRows, queryOne, queryExec } from "../db.js";
import { verifyJWT } from "../middleware/auth.js";
import { v4 as uuidv4 } from "uuid";
import { RowDataPacket } from "mysql2/promise";

const router = Router();

const ALLOWED_TABLES = new Set([
  "profiles",
  "drivers",
  "vehicles",
  "journeys",
  "journey_legs",
  "expenses",
  "fuel_expenses",
  "revenue",
  "accounts_payable",
  "expense_categories",
  "revenue_categories",
  "parties",
  "vehicle_maintenances",
  "maintenance_parts",
  "maintenance_schedules",
  "workshops",
  "tire_assets",
  "tire_logs",
  "tire_history",
  "bank_transactions",
  "bank_reconciliations",
  "cte_documents",
  "cte_settings",
  "cte_series",
  "mdfe_documents",
  "mdfe_cte_links",
  "driver_messages",
  "driver_performance_history",
  "vehicle_couplings",
  "vehicle_coupling_items",
  "saved_couplings",
  "journey_checklists",
  "incidents",
  "announcements",
  "freight_requests",
  "freight_rates",
  "freight_pricing_settings",
  "financial_accounts",
  "financial_reserves",
  "financial_reserve_entries",
  "gestor_permissions",
  "system_alerts",
  "system_settings",
]);

const GLOBAL_TABLES = new Set(["subscription_plans", "system_settings"]);

function buildWhereClause(
  queryParams: Record<string, unknown>,
  companyId: string,
  tableName: string
): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (!GLOBAL_TABLES.has(tableName)) {
    conditions.push("company_id = ?");
    params.push(companyId);
  }

  const eqFilters = queryParams.eq as Record<string, string> | undefined;
  if (eqFilters && typeof eqFilters === "object") {
    for (const [field, value] of Object.entries(eqFilters)) {
      conditions.push(`\`${field}\` = ?`);
      params.push(value);
    }
  }

  const reserved = new Set(["eq", "order", "limit", "offset", "select"]);
  for (const [key, val] of Object.entries(queryParams)) {
    if (!reserved.has(key) && val !== undefined) {
      conditions.push(`\`${key}\` = ?`);
      params.push(val);
    }
  }

  return {
    sql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
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
router.get("/:table/:id", async (req: AuthRequest, res: Response) => {
  const { table, id } = req.params;

  if (!ALLOWED_TABLES.has(table)) {
    res.status(403).json({ error: "Tabela não permitida" });
    return;
  }

  try {
    const companyId = req.user!.companyId;
    const companyWhere = GLOBAL_TABLES.has(table) ? "" : "AND company_id = ?";
    const params = GLOBAL_TABLES.has(table) ? [id] : [id, companyId];

    const row = await queryOne<RowDataPacket>(
      `SELECT * FROM \`${table}\` WHERE id = ? ${companyWhere} LIMIT 1`,
      params
    );

    if (!row) {
      res.status(404).json({ error: "Registro não encontrado" });
      return;
    }

    res.json(row);
  } catch (err) {
    console.error(`GET /${table}/${id} error:`, err);
    res.status(500).json({ error: "Erro ao buscar registro" });
  }
});

// POST /api/:table
router.post("/:table", async (req: AuthRequest, res: Response) => {
  const { table } = req.params;

  if (!ALLOWED_TABLES.has(table)) {
    res.status(403).json({ error: "Tabela não permitida" });
    return;
  }

  try {
    const companyId = req.user!.companyId;

    const data: Record<string, unknown> = {
      ...req.body,
      id: req.body.id || uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!GLOBAL_TABLES.has(table)) {
      data.company_id = req.body.company_id || companyId;
    }

    if (!("user_id" in data) && req.user?.userId) {
      data.user_id = req.user.userId;
    }

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

    const companyWhere = GLOBAL_TABLES.has(table) ? "" : "AND company_id = ?";
    const params = GLOBAL_TABLES.has(table)
      ? [...Object.values(data), id]
      : [...Object.values(data), id, companyId];

    const result = await queryExec(
      `UPDATE \`${table}\` SET ${setClause} WHERE id = ? ${companyWhere}`,
      params
    );

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
    const companyWhere = GLOBAL_TABLES.has(table) ? "" : "AND company_id = ?";
    const params = GLOBAL_TABLES.has(table) ? [id] : [id, companyId];

    const result = await queryExec(
      `DELETE FROM \`${table}\` WHERE id = ? ${companyWhere}`,
      params
    );

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

export default router;