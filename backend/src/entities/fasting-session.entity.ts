import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity({ name: 'fasting_sessions' })
export class FastingSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.fastingSessions, { onDelete: 'CASCADE' })
  user: User;

  @Column({ nullable: true })
  protocol?: string;

  @Column({ name: 'start_time', type: 'timestamptz', nullable: true })
  startTime?: Date;

  @Column({ name: 'end_time', type: 'timestamptz', nullable: true })
  endTime?: Date;

  @Column({ type: 'int', nullable: true })
  duration?: number;

  @Column({ default: false })
  completed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
