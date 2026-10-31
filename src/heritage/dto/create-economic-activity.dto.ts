
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  EconomicType,
  Importance,
} from '../../generated/prisma/client';

import { IsYearAfterOrEqual } from '../validators/year-range.validator';

export class CreateEconomicActivityDto {
  @IsEnum(EconomicType)
  type!: EconomicType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(Importance)
  importance!: Importance;

  @IsOptional()
  @IsInt()
  @Min(-32768)
  @Max(32767)
  yearFrom?: number;

  
 @IsOptional()
@IsInt()
@Min(-32768)
@Max(32767)
@IsYearAfterOrEqual('yearFrom')
yearTo?: number;


  @IsInt()
  @Min(1)
  sourceId!: number;
}
