import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity({ name: 'sleep_logs' })
export class SleepLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.sleepLogs, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'timestamptz', nullable: true })
  bedtime?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  waketime?: Date;

  @Column({ type: 'int', nullable: true })
  duration?: number;

  @Column({ type: 'int', nullable: true })
  quality?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
