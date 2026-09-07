import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChallengeProgress } from './challenge-progress.entity';
import { Team } from './team.entity';
import { User } from './user.entity';

@Entity({ name: 'challenges' })
export class Challenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @ManyToOne(() => Team, (team) => team.challenges, { onDelete: 'SET NULL' })
  team?: Team;

  @Column({ nullable: true })
  type?: string;

  @Column({ name: 'target_value', type: 'int', nullable: true })
  targetValue?: number;

  @Column({ name: 'duration_days', type: 'int', nullable: true })
  durationDays?: number;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate?: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate?: string;

  @ManyToOne(() => User, (user) => user.createdChallenges, { onDelete: 'SET NULL' })
  createdBy: User;

  @OneToMany(() => ChallengeProgress, (progress) => progress.challenge)
  progress: ChallengeProgress[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
