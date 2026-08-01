import { Controller, Get } from '@nestjs/common';
import { Public } from '../core/public.decorator';
import { HealthResponse, HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  getHealth(): Promise<HealthResponse> {
    return this.health.getHealth();
  }
}