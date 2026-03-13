import { Router, Response } from "express";
import { AuthRequest } from "../../types/index.js";
import { queryRows, queryExec } from "../../db.js";
import { verifyJWT, requireRole } from "../../middleware/auth.js";
import { v4 as uuidv4 } from "uuid";
import { RowDataPacket } from "mysql2/promise";

const router = Router();
router.use(verifyJWT);

interface GestorPermissionRow extends RowDataPacket {
  id: string;
  company_id: string;
  user_id: string;
  module_key: string;
  enabled: number;
}

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== "string") {
      res.status(400).json({ error: "userId obrigatório" });
      return;
    }

    const permissions = await queryRows<GestorPermissionRow[]>(
      `
      SELECT module_key, enabled
      FROM gestor_permissions
      WHERE user_id = ? AND company_id = ?
      `,
      [userId, req.user!.companyId]
    );

    const map: Record<string, boolean> = {};
    for (const p of permissions) {
      map[p.module_key] = !!p.enabled;
    }

    res.json(map);
  } catch (err: unknown) {
    console.error("GET /gestor-permissions error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro interno",
    });
  }
});

router.put(
  "/:userId",
  requireRole("admin", "master"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const permissions = req.body.permissions as Array<{
        module_key: string;
        enabled: boolean;
      }>;

      if (!Array.isArray(permissions)) {
        res.status(400).json({ error: "permissions deve ser um array" });
        return;
      }

      for (const p of permissions) {
        const existing = await queryRows<GestorPermissionRow[]>(
          `
          SELECT id
          FROM gestor_permissions
          WHERE user_id = ? AND company_id = ? AND module_key = ?
          `,
          [userId, req.user!.companyId, p.module_key]
        );

        if (existing.length > 0) {
          await queryExec(
            `
            UPDATE gestor_permissions
            SET enabled = ?, updated_at = NOW()
            WHERE user_id = ? AND company_id = ? AND module_key = ?
            `,
            [p.enabled ? 1 : 0, userId, req.user!.companyId, p.module_key]
          );
        } else {
          await queryExec(
            `
            INSERT INTO gestor_permissions
              (id, company_id, user_id, module_key, enabled, created_at, updated_at)
            VALUES
              (?, ?, ?, ?, ?, NOW(), NOW())
            `,
            [uuidv4(), req.user!.companyId, userId, p.module_key, p.enabled ? 1 : 0]
          );
        }
      }

      res.json({ success: true });
    } catch (err: unknown) {
      console.error("PUT /gestor-permissions/:userId error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Erro interno",
      });
    }
  }
);

export default router;