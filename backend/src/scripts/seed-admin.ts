import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { execute, queryOne } from '../db.js';

async function seedAdmin() {
  const email = 'admin@frotalink.com';
  const plainPassword = 'SenhaTemporaria@123';
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const existing = await queryOne(
    `SELECT user_id FROM profiles WHERE email = ? LIMIT 1`,
    [email]
  );

  const userId = existing?.user_id ?? uuidv4();

  if (existing) {
    await execute(
      `UPDATE profiles
       SET full_name = ?, password_hash = ?, role = ?, status = ?, deleted_at = NULL,
           password_change_required = 1
       WHERE user_id = ?`,
      ['Administrador', passwordHash, 'master', 'active', userId]
    );
  } else {
    await execute(
      `INSERT INTO profiles
       (id, user_id, full_name, email, password_hash, role, status, password_change_required, company_id, created_at, updated_at)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, NULL, NOW(6), NOW(6))`,
      [userId, 'Administrador', email, passwordHash, 'master', 'active', 1]
    );
  }

  console.log('Usuário admin criado com sucesso.');
  console.log('ID:', userId);
  console.log('E-mail:', email);
  console.log('Senha temporária:', plainPassword);
}

seedAdmin().catch(console.error);