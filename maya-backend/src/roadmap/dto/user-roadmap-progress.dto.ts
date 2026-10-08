import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean, IsUUID } from 'class-validator';

export interface UserRoadmapProgressEntity {
  id: string;
  userId: string;
  roadmapLevelId: string;
  levelNumber: number;
  sessionId?: string | null;
  status: 'locked' | 'in_progress' | 'completed';
  scorePercent: number;
  isPassed: boolean;
  xpEarned: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export class RecordUserRoadmapProgressDto {
  @IsString()
  @IsNotEmpty()
  roadmapLevelId: string;

  @IsNumber()
  levelNumber: number;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  status?: 'locked' | 'in_progress' | 'completed' = 'completed';

  @IsOptional()
  @IsNumber()
  scorePercent?: number = 75;

  @IsOptional()
  @IsBoolean()
  isPassed?: boolean = true;

  @IsOptional()
  @IsNumber()
  xpEarned?: number = 100;
}
