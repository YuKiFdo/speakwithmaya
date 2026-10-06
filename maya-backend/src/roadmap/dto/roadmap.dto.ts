import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsIn, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export type UnlockType = 'free' | 'completion' | 'score' | 'time';

export class UnlockRuleDto {
  @IsIn(['free', 'completion', 'score', 'time'])
  type: UnlockType = 'score';

  @IsOptional()
  @IsNumber()
  minScore?: number = 75;

  @IsOptional()
  @IsNumber()
  minDurationSeconds?: number = 240;

  @IsOptional()
  @IsNumber()
  requiresLevelNumber?: number;
}

export class GuidedPromptDto {
  @IsOptional()
  @IsString()
  scenarioRole?: string; // e.g. "Maya is a friendly coffee shop barista in London"

  @IsOptional()
  @IsString()
  coachingFocus?: string; // e.g. "Practice polite ordering forms ('Could I please have...', 'I would like...')"

  @IsOptional()
  @IsString()
  openingQuestion?: string; // e.g. "Hello! Welcome to Costa Coffee. What can I get started for you today?"

  @IsOptional()
  @IsString()
  customPromptAddon?: string; // Optional raw guidance if advanced admin wants extra constraints
}

export class LearningObjectiveDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean = true;

  @IsOptional()
  @IsNumber()
  targetTurns?: number;
}

export class CreateRoadmapLevelDto {
  @IsNumber()
  levelNumber: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsNumber()
  targetDurationMinutes?: number = 5;

  @IsOptional()
  @IsIn(['robot', 'chat', 'family', 'home', 'wave', 'directions'])
  iconType?: 'robot' | 'chat' | 'family' | 'home' | 'wave' | 'directions' = 'chat';

  @IsOptional()
  @IsString()
  numberColor?: string = '#0057FF';

  @IsOptional()
  @IsString()
  haloColor?: string = '#EFF6FF';

  @IsOptional()
  @IsString()
  haloBorderColor?: string = '#BFDBFE';

  @IsOptional()
  @IsString()
  scenarioId?: string;

  @IsOptional()
  @IsString()
  customSvg?: string;

  @IsOptional()
  @IsNumber()
  xpReward?: number = 100;

  @IsOptional()
  @ValidateNested()
  @Type(() => GuidedPromptDto)
  guidedPrompt?: GuidedPromptDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UnlockRuleDto)
  unlockRule?: UnlockRuleDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LearningObjectiveDto)
  learningObjectives?: LearningObjectiveDto[];

  @IsOptional()
  @IsNumber()
  targetSpeakingShare?: number = 40;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean = true;
}

export class UpdateRoadmapLevelDto {
  @IsOptional()
  @IsNumber()
  levelNumber?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsNumber()
  targetDurationMinutes?: number;

  @IsOptional()
  @IsNumber()
  xpReward?: number;

  @IsOptional()
  @IsIn(['robot', 'chat', 'family', 'home', 'wave', 'directions'])
  iconType?: 'robot' | 'chat' | 'family' | 'home' | 'wave' | 'directions';

  @IsOptional()
  @IsString()
  numberColor?: string;

  @IsOptional()
  @IsString()
  haloColor?: string;

  @IsOptional()
  @IsString()
  haloBorderColor?: string;

  @IsOptional()
  @IsString()
  scenarioId?: string;

  @IsOptional()
  @IsString()
  customSvg?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GuidedPromptDto)
  guidedPrompt?: GuidedPromptDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UnlockRuleDto)
  unlockRule?: UnlockRuleDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LearningObjectiveDto)
  learningObjectives?: LearningObjectiveDto[];

  @IsOptional()
  @IsNumber()
  targetSpeakingShare?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class ReorderItemDto {
  @IsString()
  id: string;

  @IsNumber()
  levelNumber: number;
}

export class ReorderRoadmapLevelsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  levels: ReorderItemDto[];
}

export class SimulateLevelTurnDto {
  @IsString()
  @IsNotEmpty()
  userMessage: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GuidedPromptDto)
  guidedPrompt?: GuidedPromptDto;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  levelTitle?: string;

  @IsOptional()
  @IsArray()
  history?: Array<{ role: 'user' | 'model'; text: string }>;
}
