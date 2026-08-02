import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TaxonomyRepository } from '../taxonomy';
@Injectable()
export class CategoriesRepository extends TaxonomyRepository {
  constructor(prisma: PrismaService) {
    super(prisma, 'category');
  }
}
