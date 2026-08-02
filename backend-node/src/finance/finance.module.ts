import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { FinanceController } from './finance.controller';
import { FinanceRepository } from './finance.repository';
import { FinanceService } from './finance.service';
import { SettlementController } from './settlement/settlement.controller';
import { SettlementRepository } from './settlement/settlement.repository';
import { SettlementService } from './settlement/settlement.service';

@Module({
  imports: [CustomersModule],
  controllers: [FinanceController, SettlementController],
  providers: [
    FinanceRepository,
    FinanceService,
    SettlementRepository,
    SettlementService,
  ],
  exports: [FinanceService, SettlementService],
})
export class FinanceModule {}
