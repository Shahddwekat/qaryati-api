import { IsYearAfterOrEqual } from '../validators/year-range.validator';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
  ValidateIf,
} from 'class-validator';

import {
  EventCategory,
  DatePrecision,
} from '../../generated/prisma/client';

export class CreateHistoricalEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(EventCategory)
  category!: EventCategory;

  @IsEnum(DatePrecision)
  datePrecision!: DatePrecision;

  @IsInt()
  @Min(-32768)
  @Max(32767)
  yearFrom!: number;

  @IsOptional()
  @IsInt()
  @Min(-32768)
  @Max(32767)
  @IsYearAfterOrEqual('yearFrom')
  yearTo?: number;

  @IsInt()
  @Min(1)
  sourceId!: number;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  villageIds!: number[];
}
