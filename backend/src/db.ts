import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3310),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function query(sql: string, params: any[] = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function queryOne(sql: string, params: any[] = []) {
  const rows: any = await query(sql, params);
  return rows?.[0] ?? null;
}

export async function execute(sql: string, params: any[] = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}