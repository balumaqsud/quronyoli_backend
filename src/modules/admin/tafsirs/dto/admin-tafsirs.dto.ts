import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { OffsetPaginationQueryDto } from '../../../../common/pagination/offset-pagination.dto';
import { toOptionalBoolean } from '../../../../common/validation/to-optional-boolean';

export class AdminTafsirsQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  languageCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAdminTafsirDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ReorderAdminTafsirsDto {
  @ApiProperty({
    type: [String],
    description: 'Ordered list of tafsir UUIDs (first = sortOrder 0)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids!: string[];
}
