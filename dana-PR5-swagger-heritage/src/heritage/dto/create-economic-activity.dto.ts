
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
  /** Kind: AGRICULTURE, LIVESTOCK, TRADE, CRAFT, INDUSTRY, TOURISM, SERVICES or OTHER. */
  @IsEnum(EconomicType)
  type!: EconomicType;

  /** Name of the activity, for example `Olive harvest`. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  /** More details about the activity. */
  @IsOptional()
  @IsString()
  description?: string;

  /** MAIN if the village depends on it, SECONDARY otherwise. */
  @IsEnum(Importance)
  importance!: Importance;

  /** First year the activity existed. */
  @IsOptional()
  @IsInt()
  @Min(-32768)
  @Max(32767)
  yearFrom?: number;

  
  /** Last year of the activity. Cannot be before `yearFrom`. */
 @IsOptional()
@IsInt()
@Min(-32768)
@Max(32767)
@IsYearAfterOrEqual('yearFrom')
yearTo?: number;


  /** Id of the source that supports this activity. */
  @IsInt()
  @Min(1)
  sourceId!: number;
}
