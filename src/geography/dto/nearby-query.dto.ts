import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export const MAX_RADIUS_KM = 50;

/** Query string of GET /villages/:id/nearby. */
export class NearbyQueryDto {
  /** Search radius in kilometres. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @Max(MAX_RADIUS_KM)
  radiusKm: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}
