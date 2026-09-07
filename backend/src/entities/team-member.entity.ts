import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Team } from './team.entity';
import { User } from './user.entity';

@Entity({ name: 'team_members' })
export class TeamMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Team, (team) => team.members, { onDelete: 'CASCADE' })
  team: Team;

  @ManyToOne(() => User, (user) => user.teamMemberships, { onDelete: 'CASCADE' })
  user: User;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
