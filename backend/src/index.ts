import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import authRouter from './routes/auth.js';
import crudRouter from './routes/crud.js';
import financialAccountsRouter from './routes/features/financialAccounts.js';
import financialReservesRouter from './routes/features/financialReserves.js';
import expensesFeatureRouter from './routes/features/expenses.js';
import gestorPermissionsRouter from './routes/features/gestorPermissions.js';

const app = express();
const PORT = Number(process.env.PORT || '3002');

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Auth (sem JWT middleware)
app.use('/api/auth', authRouter);

// Features específicas (antes do CRUD genérico para não conflitar)
app.use('/api/financial-accounts', financialAccountsRouter);
app.use('/api/financial-reserves', financialReservesRouter);
app.use('/api/expenses', expensesFeatureRouter);
app.use('/api/gestor-permissions', gestorPermissionsRouter);

// CRUD genérico (deve vir por último)
app.use('/api', crudRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frota-Link Backend rodando na porta ${PORT}`);
  console.log(`Database: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
});

export default app;
