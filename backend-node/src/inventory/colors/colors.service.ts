import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { TaxonomyService } from '../taxonomy';
import { ColorsRepository } from './colors.repository';
@Injectable()
export class ColorsService extends TaxonomyService {
  constructor(repo: ColorsRepository, audit: AuditService) {
    super(repo, audit, 'color');
  }
}
