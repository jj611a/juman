import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthPrincipal } from '../shared/types';
import {
  CreatePaymentDto,
  ListFinanceAccountsDto,
  ListFinancePaymentsDto,
  ListFinanceTransactionsDto,
  OutstandingQueryDto,
} from './dto/finance.dto';
import { FINANCE_PERMISSION } from './finance.constants';
import { FinanceService } from './finance.service';

@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('accounts')
  @RequirePermissions(FINANCE_PERMISSION.VIEW)
  listAccounts(@Query() query: ListFinanceAccountsDto) {
    return this.finance.listAccounts(query);
  }

  @Get('transactions')
  @RequirePermissions(FINANCE_PERMISSION.VIEW)
  listTransactions(@Query() query: ListFinanceTransactionsDto) {
    return this.finance.listTransactions(query);
  }

  @Get('payments')
  @RequirePermissions(FINANCE_PERMISSION.VIEW)
  listPayments(@Query() query: ListFinancePaymentsDto) {
    return this.finance.listPayments(query);
  }

  @Post('payments')
  @RequirePermissions(FINANCE_PERMISSION.PAYMENT)
  registerPayment(
    @Body() body: CreatePaymentDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.finance.registerPayment(body, user);
  }

  @Get('outstanding')
  @RequirePermissions(FINANCE_PERMISSION.VIEW)
  outstanding(@Query() query: OutstandingQueryDto) {
    return this.finance.getOutstanding(query);
  }
}
