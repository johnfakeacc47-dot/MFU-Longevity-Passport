import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Repository } from 'typeorm';
import { Activity } from '../entities/activity.entity';
import { FastingSession } from '../entities/fasting-session.entity';
import { Meal } from '../entities/meal.entity';
import { SleepLog } from '../entities/sleep-log.entity';
import { CreateActivityDto } from './dto/create-activity.dto';
import { CreateMealDto } from './dto/create-meal.dto';
import { CreateSleepDto } from './dto/create-sleep.dto';
import { StartFastingDto } from './dto/start-fasting.dto';

@Injectable()
export class HealthService {
  constructor(
    @InjectRepository(Meal)
    private readonly mealRepository: Repository<Meal>,
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
    @InjectRepository(SleepLog)
    private readonly sleepRepository: Repository<SleepLog>,
    @InjectRepository(FastingSession)
    private readonly fastingRepository: Repository<FastingSession>,
  ) {}

  private getTodayRange() {
    // Use UTC dates to match database timestamps
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    console.log(`[SCORE] UTC Today range: ${start.toISOString()} to ${end.toISOString()}`);
    return { start, end };
  }

  async logMeal(userId: string, dto: CreateMealDto) {
    const meal = this.mealRepository.create({
      user: { id: userId },
      name: dto.name,
      portionSize: dto.portionSize,
      calories: dto.calories,
      protein: dto.protein,
      carbs: dto.carbs,
      fat: dto.fat,
      fiber: dto.fiber,
      imageUrl: dto.imageUrl,
      confidence: dto.confidence,
      healthScore: dto.healthScore,
      createdAt: dto.timestamp ? new Date(dto.timestamp) : undefined,
    });
    return this.mealRepository.save(meal);
  }

  async getMealsByDateRange(userId: string, start: Date, end: Date) {
    return this.mealRepository.find({
      where: { user: { id: userId }, createdAt: Between(start, end) },
      order: { createdAt: 'DESC' },
    });
  }

  async logActivity(userId: string, dto: CreateActivityDto) {
    const activity = this.activityRepository.create({
      user: { id: userId },
      type: dto.type,
      duration: dto.duration,
      intensity: dto.intensity,
      caloriesBurned: dto.caloriesBurned,
      createdAt: dto.timestamp ? new Date(dto.timestamp) : undefined,
    });
    return this.activityRepository.save(activity);
  }

  async getActivitiesByDateRange(userId: string, start: Date, end: Date) {
    return this.activityRepository.find({
      where: { user: { id: userId }, createdAt: Between(start, end) },
      order: { createdAt: 'DESC' },
    });
  }

  async logSleep(userId: string, dto: CreateSleepDto) {
    const sleepLog = this.sleepRepository.create({
      user: { id: userId },
      bedtime: dto.bedtime ? new Date(dto.bedtime) : undefined,
      waketime: dto.waketime ? new Date(dto.waketime) : undefined,
      duration: dto.duration,
      quality: dto.quality,
      createdAt: dto.timestamp ? new Date(dto.timestamp) : undefined,
    });
    return this.sleepRepository.save(sleepLog);
  }

  async getSleepByDateRange(userId: string, start: Date, end: Date) {
    return this.sleepRepository.find({
      where: { user: { id: userId }, createdAt: Between(start, end) },
      order: { createdAt: 'DESC' },
    });
  }

  async startFasting(userId: string, dto: StartFastingDto) {
    const session = this.fastingRepository.create({
      user: { id: userId },
      protocol: dto.protocol,
      startTime: dto.startTime ? new Date(dto.startTime) : new Date(),
      completed: false,
    });
    return this.fastingRepository.save(session);
  }

  async stopFasting(userId: string) {
    const session = await this.fastingRepository.findOne({
      where: { user: { id: userId }, endTime: IsNull() },
      order: { createdAt: 'DESC' },
    });

    if (!session) {
      return null;
    }

    const endTime = new Date();
    const startTime = session.startTime || endTime;
    const durationMinutes = Math.max(
      0,
      Math.round((endTime.getTime() - startTime.getTime()) / 60000),
    );

    session.endTime = endTime;
    session.duration = durationMinutes;
    session.completed = true;

    return this.fastingRepository.save(session);
  }

  async getFastingStatus(userId: string) {
    return this.fastingRepository.findOne({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async getTodayScore(userId: string) {
    const { start, end } = this.getTodayRange();
    console.log(`[SCORE] Fetching today's score for user ${userId}`);
    console.log(`[SCORE] Date range: ${start} to ${end}`);
    
    const [meals, activities, sleepLogs, fastingSessions] = await Promise.all([
      this.getMealsByDateRange(userId, start, end),
      this.getActivitiesByDateRange(userId, start, end),
      this.getSleepByDateRange(userId, start, end),
      this.fastingRepository.find({
        where: { user: { id: userId }, createdAt: Between(start, end) },
        order: { createdAt: 'DESC' },
      }),
    ]);

    console.log(`[SCORE] Found meals: ${meals.length}`, meals.map(m => ({ name: m.name, health: m.healthScore })));
    console.log(`[SCORE] Found activities: ${activities.length}`);
    console.log(`[SCORE] Found sleep logs: ${sleepLogs.length}`);
    console.log(`[SCORE] Found fasting sessions: ${fastingSessions.length}`);

    const nutritionScore = this.calculateNutritionScore(meals);
    const activityScore = this.calculateActivityScore(activities);
    const sleepScore = this.calculateSleepScore(sleepLogs);
    const fastingScore = this.calculateFastingScore(fastingSessions);
    const total = nutritionScore + activityScore + sleepScore + fastingScore;

    console.log(`[SCORE] Calculated scores - nutrition: ${nutritionScore}, activity: ${activityScore}, sleep: ${sleepScore}, fasting: ${fastingScore}, total: ${total}`);

    return {
      total: Math.round(total),
      nutrition: Math.round(nutritionScore),
      activity: Math.round(activityScore),
      sleep: Math.round(sleepScore),
      fasting: Math.round(fastingScore),
    };
  }

  private calculateNutritionScore(meals: Meal[]) {
    if (meals.length === 0) return 0;
    const avgHealthScore =
      meals.reduce((sum, meal) => sum + (meal.healthScore ?? 50), 0) /
      meals.length;
    const score = 20 + (avgHealthScore / 100) * 5;
    return Math.min(score, 25);
  }

  private calculateActivityScore(activities: Activity[]) {
    const totalMinutes = activities.reduce(
      (sum, activity) => sum + (activity.duration || 0),
      0,
    );
    const score = (totalMinutes / 30) * 25;
    return Math.min(score, 25);
  }

  private calculateSleepScore(sleepLogs: SleepLog[]) {
    if (sleepLogs.length === 0) return 0;
    const latest = sleepLogs[0];
    let durationHours = 0;

    if (latest.duration) {
      durationHours = latest.duration / 60;
    } else if (latest.bedtime && latest.waketime) {
      durationHours =
        (latest.waketime.getTime() - latest.bedtime.getTime()) / 3600000;
    }

    if (durationHours <= 0) return 0;

    let score = 0;
    if (durationHours >= 7 && durationHours <= 9) {
      score = 25;
    } else if (durationHours < 7) {
      score = (durationHours / 7) * 25;
    } else {
      const overHours = durationHours - 9;
      score = Math.max(0, 25 - (overHours / 3) * 25);
    }

    if (latest.quality) {
      score *= Math.min(Math.max(latest.quality / 10, 0.4), 1);
    }

    return Math.min(score, 25);
  }

  private calculateFastingScore(sessions: FastingSession[]) {
    if (sessions.length === 0) return 0;
    const latest = sessions[0];
    const duration = latest.duration ?? 0;
    const score = (duration / 720) * 25;
    return Math.min(score, 25);
  }
}
