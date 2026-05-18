/**
 * Creates the initial admin user if none exists.
 *
 * Usage:
 *   npx ts-node src/scripts/seedAdmin.ts
 *
 * Override defaults via env vars:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret123 ADMIN_NAME="Alice" npx ts-node src/scripts/seedAdmin.ts
 */
import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../config/database';
import User from '../models/User';

const run = async () => {
  await connectDB();

  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const name = process.env.ADMIN_NAME || 'Admin';

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`✅ Admin already exists: ${email} (role: ${existing.role})`);
    process.exit(0);
  }

  await User.create({ email, password, name, role: 'admin' });
  console.log(`✅ Admin created: ${email} / ${password}`);
  console.log('⚠️  Change the default password immediately after first login!');
  process.exit(0);
};

run().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
