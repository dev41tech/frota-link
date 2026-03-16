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

const allowedOrigins = [
  'https://frotalink.41tech.cloud',
  'https://api.frotalink.41tech.cloud',
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS bloqueado para origem: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.options('*', cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS bloqueado para origem: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/financial-accounts', financialAccountsRouter);
app.use('/api/financial-reserves', financialReservesRouter);
app.use('/api/expenses', expensesFeatureRouter);
app.use('/api/gestor-permissions', gestorPermissionsRouter);
app.use('/api', crudRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frota-Link Backend rodando na porta ${PORT}`);
  console.log(`Database: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
});

export default app;