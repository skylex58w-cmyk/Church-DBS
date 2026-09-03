import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding initial data...');
  const org = await prisma.organization.upsert({ where: { id: 1 }, update: {}, create: { name: 'Default Church' } });
  const branch = await prisma.branch.upsert({ where: { id: 1 }, update: {}, create: { name: 'Main Branch', organizationId: org.id } });
  const roleAdmin = await prisma.role.upsert({ where: { name: 'SuperAdmin' }, update: {}, create: { name: 'SuperAdmin', description: 'Full access' } });
  const perm = await prisma.permission.upsert({ where: { name: 'users.manage' }, update: {}, create: { name: 'users.manage' } });
  const user = await prisma.user.upsert({ where: { email: 'admin@example.com' }, update: {}, create: { email: 'admin@example.com', passwordHash: '$2b$10$CwTycUXWue0Thq9StjUM0uJ8X1qg6K0u0Yw1Z6lQe1vqQZ1v2K5eW' } });
  await prisma.userRole.upsert({ where: { id: 1 }, update: {}, create: { userId: user.id, roleId: roleAdmin.id, branchId: branch.id } });
  console.log('Seed completed. Admin: admin@example.com / password: changeme');
}

seed().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
