import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PopulationTrendsQueryDto {
  /** Governorate name in English or Arabic, e.g. `Ramallah and Al-Bireh`. Omit for all. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  governorate?: string;
}
