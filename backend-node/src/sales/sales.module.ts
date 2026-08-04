import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { CustomersModule } from '../customers/customers.module';
import { FinanceModule } from '../finance/finance.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SalesController } from './sales.controller';
import { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';
import { SalesTransactionService } from './sales-transaction.service';

@Module({
  imports: [
    CustomersModule,
    InventoryModule,
    AvailabilityModule,
    FinanceModule,
  ],
  controllers: [SalesController],
  providers: [SalesRepository, SalesTransactionService, SalesService],
  exports: [SalesService],
})
export class SalesModule {}
