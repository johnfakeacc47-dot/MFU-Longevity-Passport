import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Activity } from '../entities/activity.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { Challenge } from '../entities/challenge.entity';
import { ChallengeProgress } from '../entities/challenge-progress.entity';
import { FastingSession } from '../entities/fasting-session.entity';
import { HealthLog } from '../entities/health-log.entity';
import { Meal } from '../entities/meal.entity';
import { SleepLog } from '../entities/sleep-log.entity';
import { Team } from '../entities/team.entity';
import { TeamMember } from '../entities/team-member.entity';
import { User } from '../entities/user.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    User,
    HealthLog,
    Meal,
    Activity,
    SleepLog,
    FastingSession,
    Team,
    TeamMember,
    Challenge,
    ChallengeProgress,
    AuditLog,
  ],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
