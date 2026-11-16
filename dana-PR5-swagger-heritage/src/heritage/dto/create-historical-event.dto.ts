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
} from 'class-validator';

import { EventCategory, DatePrecision } from '../../generated/prisma/client';

export class CreateHistoricalEventDto {
  /** Short title of the event. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  /** What happened, in a few sentences. */
  @IsString()
  @IsNotEmpty()
  description!: string;

  /** Kind: POLITICAL, SOCIAL, ECONOMIC, CULTURAL, NATURAL or OTHER. */
  @IsEnum(EventCategory)
  category!: EventCategory;

  /** How exact the date is: EXACT, YEAR, DECADE or APPROXIMATE. */
  @IsEnum(DatePrecision)
  datePrecision!: DatePrecision;

  /** Start year (negative for BCE). */
  @IsInt()
  @Min(-32768)
  @Max(32767)
  yearFrom!: number;

  /** End year, if the event lasted more than one year. Cannot be before `yearFrom`. */
  @IsOptional()
  @IsInt()
  @Min(-32768)
  @Max(32767)
  @IsYearAfterOrEqual('yearFrom')
  yearTo?: number;

  /** Id of the source that supports this event. */
  @IsInt()
  @Min(1)
  sourceId!: number;

  /** Ids of the villages affected by the event (at least one, no duplicates). */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  villageIds!: number[];
}
