import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { FinanceController } from './finance.controller';
import { FinanceRepository } from './finance.repository';
import { FinanceService } from './finance.service';

@Module({
  imports: [CustomersModule],
  controllers: [FinanceController],
  providers: [FinanceRepository, FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
