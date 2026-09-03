/*
Seed script for RBAC: creates default permissions, roles and a development admin user.

Notes:
- Do NOT use this seed script in production without changing the default admin password.
- The script uses environment variables from backend/.env (see .env.example).
*/

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding RBAC data...');

  const permissions = [
    { name: 'members.view', description: 'View members' },
    { name: 'members.create', description: 'Create members' },
    { name: 'members.update', description: 'Update members' },
    { name: 'finance.record', description: 'Record financial transactions' },
    { name: 'finance.approve', description: 'Approve financial transactions' },
    { name: 'reports.export', description: 'Export reports' },
    { name: 'pastoral.view', description: 'Access pastoral records (sensitive)' },
    { name: 'users.manage', description: 'Manage users and roles' },
    { name: 'roles.manage', description: 'Manage roles and role permissions' }
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { name: p.name },
      update: {},
      create: p
    }).catch((e) => {
      // ignore unique/other transient errors during iterative development
    });
  }

  const adminRole = await prisma.role.upsert({
    where: { name: 'Super Administrator' },
    update: {},
    create: { name: 'Super Administrator', description: 'Full access to the system' }
  });

  // attach all permissions to admin role
  const allPerms = await prisma.permission.findMany();
  for (const perm of allPerms) {
    try {
      await prisma.rolePermission.create({
        data: {
          roleId: adminRole.id,
          permissionId: perm.id
        }
      });
    } catch (e) {
      // ignore duplicates
    }
  }

  // create a dev admin user if none exists
  const adminEmail = process.env.RBAC_DEV_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.RBAC_DEV_ADMIN_PASSWORD || 'admin';
  const hash = await bcrypt.hash(adminPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      fullName: 'Dev Admin',
      password: hash
    }
  });

  // assign role
  try {
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });
  } catch (e) {
    // ignore duplicate assignment
  }

  console.log('Seeding completed. Dev admin:', adminEmail);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
