import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { OffsetPaginationQueryDto } from '../../../../common/pagination/offset-pagination.dto';
import { toOptionalBoolean } from '../../../../common/validation/to-optional-boolean';
import { QuranReciterKind } from '../../../../generated/prisma';

export class AdminQarisQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({ enum: QuranReciterKind })
  @IsOptional()
  @IsEnum(QuranReciterKind)
  kind?: QuranReciterKind;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isPopular?: boolean;
}

export class UpdateAdminQariDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ReorderAdminQarisDto {
  @ApiProperty({
    type: [String],
    description: 'Ordered list of qari UUIDs (first = sortOrder 0)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids!: string[];
}

export class SetPopularQariDto {
  @ApiProperty()
  @IsBoolean()
  isPopular!: boolean;
}
