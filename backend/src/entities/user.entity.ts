import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Activity } from './activity.entity';
import { AuditLog } from './audit-log.entity';
import { Challenge } from './challenge.entity';
import { ChallengeProgress } from './challenge-progress.entity';
import { FastingSession } from './fasting-session.entity';
import { HealthLog } from './health-log.entity';
import { Meal } from './meal.entity';
import { SleepLog } from './sleep-log.entity';
import { Team } from './team.entity';
import { TeamMember } from './team-member.entity';

export enum UserRole {
  Student = 'student',
  Staff = 'staff',
  Admin = 'admin',
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mfu_id', unique: true })
  mfuId: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.Student })
  role: UserRole;

  @Column({ nullable: true })
  faculty?: string;

  @Column({ nullable: true })
  department?: string;

  @Column({ name: 'consent_given', default: false })
  consentGiven: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;

  @OneToMany(() => HealthLog, (healthLog) => healthLog.user)
  healthLogs: HealthLog[];

  @OneToMany(() => Meal, (meal) => meal.user)
  meals: Meal[];

  @OneToMany(() => Activity, (activity) => activity.user)
  activities: Activity[];

  @OneToMany(() => SleepLog, (sleepLog) => sleepLog.user)
  sleepLogs: SleepLog[];

  @OneToMany(() => FastingSession, (session) => session.user)
  fastingSessions: FastingSession[];

  @OneToMany(() => Team, (team) => team.admin)
  adminTeams: Team[];

  @OneToMany(() => TeamMember, (teamMember) => teamMember.user)
  teamMemberships: TeamMember[];

  @OneToMany(() => Challenge, (challenge) => challenge.createdBy)
  createdChallenges: Challenge[];

  @OneToMany(() => ChallengeProgress, (progress) => progress.user)
  challengeProgress: ChallengeProgress[];

  @OneToMany(() => AuditLog, (auditLog) => auditLog.admin)
  auditLogs: AuditLog[];
}
