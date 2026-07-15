import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum ActivityType {
  Walking = 'walking',
  Running = 'running',
  Cycling = 'cycling',
  Strength = 'strength',
  Yoga = 'yoga',
  Swimming = 'swimming',
}

@Entity({ name: 'activities' })
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.activities, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'enum', enum: ActivityType })
  type: ActivityType;

  @Column({ type: 'int' })
  duration: number;

  @Column({ nullable: true })
  intensity?: string;

  @Column({ name: 'calories_burned', type: 'int', nullable: true })
  caloriesBurned?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
