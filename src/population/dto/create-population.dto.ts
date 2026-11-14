import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePopulationDto {
  /** Year the figure refers to: from 1500 to the current year (not in the future). */
  @IsInt()
  year!: number;

  /** Total population in that year. 0 is allowed (for example a depopulated village); at most 1,000,000. */
  @IsInt()
  @Min(0)
  population!: number;

  /** Number of households. Optional; it cannot be more than `population`. */
  @IsOptional()
  @IsInt()
  @Min(0)
  households?: number;

  /** Id of the source of this figure (find or add one with /sources). Required: every figure must say where it comes from. */
  @IsInt()
  @Min(1)
  @Max(4294967295)
  sourceId!: number;

  /** Free text, for example the page or table of the source. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
