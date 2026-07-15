import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/user.decorator';
import { CreateActivityDto } from '../dto/create-activity.dto';
import { HealthService } from '../health.service';

@Controller('health/activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(private readonly healthService: HealthService) {}

  @Post()
  logActivity(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateActivityDto,
  ) {
    return this.healthService.logActivity(user.id, dto);
  }

  @Get('today')
  getTodayActivities(@CurrentUser() user: { id: string }) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return this.healthService.getActivitiesByDateRange(user.id, start, end);
  }

  @Get('history')
  getActivityHistory(
    @CurrentUser() user: { id: string },
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date();
    return this.healthService.getActivitiesByDateRange(user.id, start, end);
  }
}
