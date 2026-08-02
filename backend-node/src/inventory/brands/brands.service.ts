import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { TaxonomyService } from '../taxonomy';
import { BrandsRepository } from './brands.repository';
@Injectable()
export class BrandsService extends TaxonomyService {
  constructor(repo: BrandsRepository, audit: AuditService) {
    super(repo, audit, 'brand');
  }
}
