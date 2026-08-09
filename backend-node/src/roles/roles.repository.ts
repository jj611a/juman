import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByName(name: string) {
    return this.prisma.role.findFirst({
      where: { name, deletedAt: null },
    });
  }

  findById(id: string) {
    return this.prisma.role.findFirst({
      where: { id, deletedAt: null },
    });
  }

  upsertSystemRole(input: { name: string; description: string }) {
    return this.prisma.role.upsert({
      where: { name: input.name },
      create: {
        name: input.name,
        description: input.description,
        isSystem: true,
        isActive: true,
      },
      update: {
        description: input.description,
        isSystem: true,
        isActive: true,
        deletedAt: null,
      },
    });
  }

  async replacePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.updateMany({
        where: { roleId, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      for (const permissionId of permissionIds) {
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId, permissionId },
          },
          create: { roleId, permissionId },
          update: { deletedAt: null },
        });
      }
    });
  }

  async listPermissionKeysForRole(roleId: string): Promise<string[]> {
    const rows = await this.prisma.rolePermission.findMany({
      where: {
        roleId,
        deletedAt: null,
        permission: { deletedAt: null },
      },
      include: { permission: true },
    });
    return rows.map((r) => r.permission.key).sort();
  }

  findAllActive() {
    return this.prisma.role.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }
}
