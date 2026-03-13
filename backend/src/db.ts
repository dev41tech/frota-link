import mysql, {
  Pool,
  RowDataPacket,
  ResultSetHeader,
} from "mysql2/promise";

const pool: Pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3310),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export { pool };

export async function queryRows<T extends RowDataPacket[]>(
  sql: string,
  params: unknown[] = []
): Promise<T> {
  const [rows] = await pool.query<T>(sql, params);
  return rows;
}

export async function queryOne<T extends RowDataPacket>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const [rows] = await pool.query<T[]>(sql, params);
  return rows[0] ?? null;
}

export async function queryExec(
  sql: string,
  params: unknown[] = []
): Promise<ResultSetHeader> {
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result;
}