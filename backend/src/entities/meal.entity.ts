import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { EncryptionTransformer } from '../database/encryption.transformer';

@Entity({ name: 'meals' })
export class Meal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.meals, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  name: string;

  @Column({ name: 'portion_size', type: 'int', nullable: true })
  portionSize?: number;

  @Column({ type: 'int', nullable: true })
  calories?: number;

  @Column({ type: 'int', nullable: true })
  protein?: number;

  @Column({ type: 'int', nullable: true })
  carbs?: number;

  @Column({ type: 'int', nullable: true })
  fat?: number;

  @Column({ type: 'int', nullable: true })
  fiber?: number;

  @Column({ name: 'health_score', type: 'int', nullable: true })
  healthScore?: number;

  @Column({ name: 'image_url', nullable: true, transformer: new EncryptionTransformer() })
  imageUrl?: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  confidence?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
