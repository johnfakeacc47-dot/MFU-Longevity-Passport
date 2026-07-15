import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/user.decorator';
import { CreateMealDto } from '../dto/create-meal.dto';
import { HealthService } from '../health.service';

@Controller('health/meals')
@UseGuards(JwtAuthGuard)
export class MealsController {
  constructor(private readonly healthService: HealthService) {}

  @Post()
  logMeal(@CurrentUser() user: { id: string }, @Body() dto: CreateMealDto) {
    return this.healthService.logMeal(user.id, dto);
  }

  @Get('today')
  getTodayMeals(@CurrentUser() user: { id: string }) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return this.healthService.getMealsByDateRange(user.id, start, end);
  }

  @Get('history')
  getMealHistory(
    @CurrentUser() user: { id: string },
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date();
    return this.healthService.getMealsByDateRange(user.id, start, end);
  }
}
