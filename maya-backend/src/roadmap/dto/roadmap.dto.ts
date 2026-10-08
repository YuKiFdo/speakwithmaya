import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Universal canonical lesson parser:
 * Parses:
 * Lesson: <Title>
 *
 * What you’ll practice:
 * - <Point 1>
 * - <Point 2>
 */
export function parseCanonicalLessonContent(raw: string): { title?: string; practicePoints: string[] } {
  if (!raw || typeof raw !== 'string') return { practicePoints: [] };
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  let title: string | undefined;
  const practicePoints: string[] = [];

  for (const line of lines) {
    const lessonMatch = line.match(/^lesson:\s*(.+)$/i);
    if (lessonMatch) {
      title = lessonMatch[1].trim();
      continue;
    }
    const bulletMatch = line.match(/^[-*•]\s*(.+)$/);
    if (bulletMatch) {
      practicePoints.push(bulletMatch[1].trim());
      continue;
    }
  }

  return { title, practicePoints };
}

/**
 * Universal canonical lesson formatter:
 * Generates:
 * Lesson: <Title>
 *
 * What you’ll practice:
 * - <Point 1>
 * - <Point 2>
 */
export function formatCanonicalLessonContent(title: string, practicePoints: string[] = []): string {
  const points = (practicePoints || []).map((p) => `- ${p}`).join('\n');
  return `Lesson: ${title || 'Speaking Practice'}\n\nWhat you’ll practice:\n${points}`;
}

export class CreateRoadmapLevelDto {
  @IsNumber()
  levelNumber: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  practicePoints?: string[];

  @IsOptional()
  @IsString()
  canonicalContent?: string;

  @IsOptional()
  @IsNumber()
  passingScorePercent?: number = 75;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  iconType?: string = 'chat';

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
  @IsArray()
  @IsString({ each: true })
  practicePoints?: string[];

  @IsOptional()
  @IsString()
  canonicalContent?: string;

  @IsOptional()
  @IsNumber()
  passingScorePercent?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsNumber()
  xpReward?: number;

  @IsOptional()
  @IsString()
  iconType?: string;

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
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  levelTitle?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  practicePoints?: string[];

  @IsOptional()
  @IsArray()
  history?: Array<{ role: 'user' | 'model'; text: string }>;
}
