import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';

export function tenantIsolation(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user?.companyId) {
    // master sem company selecionada — passa
    next();
    return;
  }
  // Injeta company_id no body e query para uso nos routes
  (req as any).companyId = req.user.companyId;
  next();
}
