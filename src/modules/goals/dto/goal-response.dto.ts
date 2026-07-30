import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DailyGoalMetric } from '../../../generated/prisma';

export class GoalResponseDto {
  @ApiProperty({ example: 'uuid' })
  id!: string;

  @ApiProperty({ enum: DailyGoalMetric })
  metric!: DailyGoalMetric;

  @ApiProperty({ example: 10 })
  targetValue!: number;

  @ApiProperty({ example: '2026-07-30' })
  effectiveFrom!: string;

  @ApiPropertyOptional({ example: '2026-08-31', nullable: true })
  effectiveTo!: string | null;

  @ApiProperty({ example: true })
  isEnabled!: boolean;

  @ApiProperty({ example: '2026-07-30T08:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-07-30T08:00:00.000Z' })
  updatedAt!: Date;
}

export class GoalsListResponseDto {
  @ApiProperty({ type: [GoalResponseDto] })
  items!: GoalResponseDto[];
}

export class GoalProgressItemDto {
  @ApiProperty({ example: 'uuid' })
  goalId!: string;

  @ApiProperty({ enum: DailyGoalMetric })
  metric!: DailyGoalMetric;

  @ApiProperty({ example: 10 })
  targetValue!: number;

  @ApiProperty({ example: 4 })
  actualValue!: number;

  @ApiProperty({ example: 40 })
  percent!: number;

  @ApiProperty({ example: false })
  completed!: boolean;

  @ApiPropertyOptional({
    example: '2026-07-30T08:00:00.000Z',
    nullable: true,
  })
  completedAt!: Date | null;
}

export class GoalsProgressResponseDto {
  @ApiProperty({ example: '2026-07-30' })
  localDate!: string;

  @ApiProperty({ example: 'Asia/Tashkent' })
  timezone!: string;

  @ApiProperty({ example: 4 })
  versesRead!: number;

  @ApiProperty({ example: 0 })
  activeSeconds!: number;

  @ApiProperty({ type: [GoalProgressItemDto] })
  goals!: GoalProgressItemDto[];
}
