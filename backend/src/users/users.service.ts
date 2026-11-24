import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default class UsersService {
  async findAll() {
    return prisma.user.findMany({ select: { id: true, email: true, createdAt: true } });
  }

  async create(email: string, password: string) {
    const hash = await bcrypt.hash(password, 10);
    return prisma.user.create({ data: { email, passwordHash: hash } });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async assignRole(userId: number, roleId: number, branchId: number | null) {
    return prisma.userRole.create({ data: { userId, roleId, branchId } });
  }

  async revokeRole(userId: number, roleId: number, branchId: number | null) {
    return prisma.userRole.deleteMany({ where: { userId, roleId, branchId } });
  }

  async roleAssignmentTargetsExist(userId: number, roleId: number, branchId: number | null) {
    const [user, role, branch] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      prisma.role.findUnique({ where: { id: roleId }, select: { id: true } }),
      branchId === null
        ? Promise.resolve(true)
        : prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } }),
    ]);
    return Boolean(user && role && branch);
  }
}
