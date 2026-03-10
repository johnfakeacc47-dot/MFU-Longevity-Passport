import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/user.decorator';
import { StartFastingDto } from '../dto/start-fasting.dto';
import { HealthService } from '../health.service';

@Controller('health/fasting')
@UseGuards(JwtAuthGuard)
export class FastingController {
  constructor(private readonly healthService: HealthService) {}

  @Post('start')
  startFasting(
    @CurrentUser() user: { id: string },
    @Body() dto: StartFastingDto,
  ) {
    return this.healthService.startFasting(user.id, dto);
  }

  @Post('stop')
  stopFasting(@CurrentUser() user: { id: string }) {
    return this.healthService.stopFasting(user.id);
  }

  @Get('status')
  getStatus(@CurrentUser() user: { id: string }) {
    return this.healthService.getFastingStatus(user.id);
  }
}
