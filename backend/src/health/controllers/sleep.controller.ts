import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/user.decorator';
import { CreateSleepDto } from '../dto/create-sleep.dto';
import { HealthService } from '../health.service';

@Controller('health/sleep')
@UseGuards(JwtAuthGuard)
export class SleepController {
  constructor(private readonly healthService: HealthService) {}

  @Post()
  logSleep(@CurrentUser() user: { id: string }, @Body() dto: CreateSleepDto) {
    return this.healthService.logSleep(user.id, dto);
  }

  @Get('today')
  getTodaySleep(@CurrentUser() user: { id: string }) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return this.healthService.getSleepByDateRange(user.id, start, end);
  }

  @Get('history')
  getSleepHistory(
    @CurrentUser() user: { id: string },
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date();
    return this.healthService.getSleepByDateRange(user.id, start, end);
  }
}
