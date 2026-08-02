import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { TaxonomyService } from '../taxonomy';
import { SizesRepository } from './sizes.repository';
@Injectable()
export class SizesService extends TaxonomyService {
  constructor(repo: SizesRepository, audit: AuditService) {
    super(repo, audit, 'size');
  }
}
