import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { EncryptionTransformer } from '../database/encryption.transformer';

export enum HealthPillar {
  Nutrition = 'nutrition',
  Fasting = 'fasting',
  Activity = 'activity',
  Sleep = 'sleep',
}

@Entity({ name: 'health_logs' })
export class HealthLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.healthLogs, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'enum', enum: HealthPillar })
  pillar: HealthPillar;

  @Column({ type: 'int' })
  score: number;

  @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() })
  data?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
