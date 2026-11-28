/*
 * Seeds the RBAC catalogue and an initial administrator.
 * Admin credentials are mandatory environment inputs; no default password is provided.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.RBAC_DEV_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.RBAC_DEV_ADMIN_PASSWORD;

  if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new Error('RBAC_DEV_ADMIN_EMAIL must be set to a valid email address');
  }
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error('RBAC_DEV_ADMIN_PASSWORD must be set and contain at least 12 characters');
  }

  const permissions = [
    { name: 'members.view', description: 'View members' },
    { name: 'members.create', description: 'Create members' },
    { name: 'members.update', description: 'Update members' },
    { name: 'finance.record', description: 'Record financial transactions' },
    { name: 'finance.approve', description: 'Approve financial transactions' },
    { name: 'reports.export', description: 'Export reports' },
    { name: 'pastoral.view', description: 'Access pastoral records (sensitive)' },
    { name: 'users.manage', description: 'Manage users and roles' },
    { name: 'roles.manage', description: 'Manage roles and role permissions' },
    { name: 'branches.view', description: 'View branches within the administrator’s authorized scope' },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: { description: permission.description },
      create: permission,
    });
  }

  const adminRole = await prisma.role.upsert({
    where: { name: 'Super Administrator' },
    update: {},
    create: { name: 'Super Administrator', description: 'Full access to the system' },
  });

  const allPermissions = await prisma.permission.findMany({ select: { id: true } });
  for (const permission of allPermissions) {
    const existingGrant = await prisma.rolePermission.findFirst({
      where: { roleId: adminRole.id, permissionId: permission.id, branchId: null },
      select: { id: true },
    });
    if (!existingGrant) {
      await prisma.rolePermission.create({
        data: { roleId: adminRole.id, permissionId: permission.id },
      });
    }
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      fullName: 'System Administrator',
      passwordHash,
    },
  });

  const existingAssignment = await prisma.userRole.findFirst({
    where: { userId: adminUser.id, roleId: adminRole.id, branchId: null },
    select: { id: true },
  });
  if (!existingAssignment) {
    await prisma.userRole.create({
      data: { userId: adminUser.id, roleId: adminRole.id },
    });
  }

  console.log('RBAC seed completed for configured administrator:', adminEmail);
}

main()
  .catch((error: unknown) => {
    console.error('RBAC seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
