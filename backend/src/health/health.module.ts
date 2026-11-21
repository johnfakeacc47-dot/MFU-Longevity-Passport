import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from '../entities/activity.entity';
import { FastingSession } from '../entities/fasting-session.entity';
import { Meal } from '../entities/meal.entity';
import { SleepLog } from '../entities/sleep-log.entity';
import { ActivitiesController } from './controllers/activities.controller';
import { FastingController } from './controllers/fasting.controller';
import { MealsController } from './controllers/meals.controller';
import { ScoreController } from './controllers/score.controller';
import { SleepController } from './controllers/sleep.controller';
import { HealthService } from './health.service';

@Module({
  imports: [TypeOrmModule.forFeature([Meal, Activity, SleepLog, FastingSession])],
  controllers: [
    MealsController,
    ActivitiesController,
    SleepController,
    FastingController,
    ScoreController,
  ],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
