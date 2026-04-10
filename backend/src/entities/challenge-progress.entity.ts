import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Challenge } from './challenge.entity';
import { User } from './user.entity';

@Entity({ name: 'challenge_progress' })
export class ChallengeProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Challenge, (challenge) => challenge.progress, { onDelete: 'CASCADE' })
  challenge: Challenge;

  @ManyToOne(() => User, (user) => user.challengeProgress, { onDelete: 'CASCADE' })
  user: User;

  @Column({ name: 'current_value', type: 'int', default: 0 })
  currentValue: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
