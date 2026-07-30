import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';
import { DailyGoalMetric } from '../../../generated/prisma';

export class CreateGoalDto {
  @ApiProperty({ enum: DailyGoalMetric, example: DailyGoalMetric.VERSES })
  @IsEnum(DailyGoalMetric)
  metric!: DailyGoalMetric;

  @ApiProperty({ example: 10, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetValue!: number;

  @ApiPropertyOptional({
    example: '2026-07-30',
    description: 'Defaults to the user local calendar date',
  })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}

export class UpdateGoalDto {
  @ApiPropertyOptional({ example: 15, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetValue?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    example: '2026-08-31',
    nullable: true,
    description: 'Pass null to clear and make the goal open-ended',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  effectiveTo?: string | null;
}

export class ListGoalsQueryDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (value === true || value === 'true') {
      return true;
    }
    if (value === false || value === 'false') {
      return false;
    }
    return value;
  })
  @IsBoolean()
  isEnabled?: boolean;
}
