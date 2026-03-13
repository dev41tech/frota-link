import mysql, {
  Pool,
  RowDataPacket,
  ResultSetHeader,
} from "mysql2/promise";

const pool: Pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export { pool };

/**
 * API nova: retorna múltiplas linhas
 */
export async function queryRows<T extends RowDataPacket[]>(
  sql: string,
  params: any[] = []
): Promise<T> {
  const [rows] = await pool.query(sql, params);
  return rows as T;
}

/**
 * API nova: retorna uma linha
 */
export async function queryOne<T extends RowDataPacket>(
  sql: string,
  params: any[] = []
): Promise<T | null> {
  const [rows] = await pool.query(sql, params);
  const typedRows = rows as T[];
  return typedRows[0] ?? null;
}

/**
 * API nova: executa INSERT/UPDATE/DELETE
 */
export async function queryExec(
  sql: string,
  params: any[] = []
): Promise<ResultSetHeader> {
  const [result] = await pool.execute(sql, params);
  return result as ResultSetHeader;
}

/**
 * Compatibilidade retroativa:
 * vários arquivos antigos ainda importam `query`
 */
export async function query<T = any>(
  sql: string,
  params: any[] = []
): Promise<T> {
  const [rows] = await pool.query(sql, params);
  return rows as T;
}

/**
 * Compatibilidade retroativa:
 * vários arquivos antigos ainda importam `execute`
 */
export async function execute(
  sql: string,
  params: any[] = []
): Promise<ResultSetHeader> {
  const [result] = await pool.execute(sql, params);
  return result as ResultSetHeader;
}