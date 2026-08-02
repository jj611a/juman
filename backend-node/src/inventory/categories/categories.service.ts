import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { TaxonomyService } from '../taxonomy';
import { CategoriesRepository } from './categories.repository';
@Injectable()
export class CategoriesService extends TaxonomyService {
  constructor(repo: CategoriesRepository, audit: AuditService) {
    super(repo, audit, 'category');
  }
}
