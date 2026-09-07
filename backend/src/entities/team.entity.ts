import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Challenge } from './challenge.entity';
import { TeamMember } from './team-member.entity';
import { User } from './user.entity';

@Entity({ name: 'teams' })
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  department?: string;

  @ManyToOne(() => User, (user) => user.adminTeams, { onDelete: 'SET NULL' })
  admin: User;

  @OneToMany(() => TeamMember, (member) => member.team)
  members: TeamMember[];

  @OneToMany(() => Challenge, (challenge) => challenge.team)
  challenges: Challenge[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
