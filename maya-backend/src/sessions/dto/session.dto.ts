import { IsString, IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSessionTokenDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  goal?: string;

  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @IsNumber()
  durationSeconds?: number;

  @IsOptional()
  @IsString()
  languageMode?: string;

  @IsOptional()
  @IsString()
  sinhalaStyle?: 'balanced' | 'deep_guidance';

  @IsOptional()
  aiSuggestions?: boolean;

  @IsOptional()
  @IsString()
  scenarioId?: string;

  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  isIntroCall?: boolean;

  @IsOptional()
  @IsString()
  memory?: string;
}

export class SessionTokensDto {
  @IsOptional()
  @IsNumber()
  promptTokens?: number;

  @IsOptional()
  @IsNumber()
  responseTokens?: number;

  @IsOptional()
  @IsNumber()
  textInTokens?: number;

  @IsOptional()
  @IsNumber()
  audioInTokens?: number;

  @IsOptional()
  @IsNumber()
  textOutTokens?: number;

  @IsOptional()
  @IsNumber()
  audioOutTokens?: number;

  @IsOptional()
  @IsNumber()
  thoughtsTokens?: number;

  @IsOptional()
  @IsNumber()
  totalTokens?: number;
}

export class TurnDto {
  @IsString()
  role!: 'user' | 'model';

  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class GrammarCorrectionDto {
  @IsString()
  studentSaid!: string;

  @IsString()
  moreNatural!: string;

  @IsString()
  explanation!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlightWords?: string[];
}

export class ScoresDto {
  @IsOptional()
  @IsNumber()
  overall?: number;

  @IsOptional()
  @IsNumber()
  fluency?: number;

  @IsOptional()
  @IsNumber()
  grammar?: number;

  @IsOptional()
  @IsNumber()
  pronunciation?: number;
}

export class FinishSessionDto {
  @IsNumber()
  durationSeconds!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => SessionTokensDto)
  tokensUsed?: SessionTokensDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TurnDto)
  turns?: TurnDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrammarCorrectionDto)
  grammarCorrections?: GrammarCorrectionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrammarCorrectionDto)
  rephraseSuggestions?: GrammarCorrectionDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ScoresDto)
  scores?: ScoresDto;

  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  topic?: string;
}

export class QueryUsageDto {
  @IsOptional()
  @IsString()
  range?: string; // 'today' | '7d' | '30d' | 'custom'

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
