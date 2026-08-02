import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TaxonomyRepository } from '../taxonomy';
@Injectable()
export class BrandsRepository extends TaxonomyRepository {
  constructor(prisma: PrismaService) {
    super(prisma, 'brand');
  }
}
