import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/user.decorator';
import { HealthService } from '../health.service';

@Controller('health/score')
export class ScoreController {
  constructor(private readonly healthService: HealthService) {}

  @Get('today')
  @UseGuards(JwtAuthGuard)
  getTodayScore(@CurrentUser() user: { id: string }) {
    return this.healthService.getTodayScore(user.id);
  }

  @Get('test')
  getTestScore() {
    return {
      message: 'Health API is working!',
      timestamp: new Date().toISOString(),
      endpoints: {
        meals: '/health/meals',
        activities: '/health/activities',
        sleep: '/health/sleep',
        fasting: '/health/fasting',
        score: '/health/score/today',
      },
      note: 'Most endpoints require JWT authentication',
    };
  }
}
