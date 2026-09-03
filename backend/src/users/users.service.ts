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
}
