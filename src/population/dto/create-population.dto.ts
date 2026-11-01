import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePopulationDto {
  /** Reference year of the figure. The allowed range is checked by the domain rules. */
  @IsInt()
  year!: number;

  @IsInt()
  @Min(0)
  population!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  households?: number;

  /** Every figure must say where it comes from (see GET /sources). */
  @IsInt()
  @Min(1)
  @Max(4294967295)
  sourceId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
