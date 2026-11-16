import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsEnum,
  IsInt,
  Min,
  IsOptional,
  IsLatitude,
  IsLongitude,
  IsNumber,
} from 'class-validator';

import {
  LandmarkType,
  LandmarkCondition,
} from '../../generated/prisma/client';

export class CreateLandmarkDto {
  /** Arabic name of the landmark. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nameAr!: string;

  /** Kind: MOSQUE, CHURCH, SHRINE, SPRING, ARCHAEOLOGICAL_SITE, OLD_BUILDING, NATURAL or OTHER. */
  @IsEnum(LandmarkType)
  type!: LandmarkType;

  /** Id of the source that supports this landmark (create the source first). */
  @IsInt()
  @Min(1)
  sourceId!: number;

  /** English name, if known. */
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nameEn?: string;

  /** Free-text description of the landmark. */
  @IsOptional()
  @IsString()
  description?: string;

  /** Latitude in degrees (-90 to 90, up to 6 decimals). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @IsLatitude()
  latitude?: number;

  /** Longitude in degrees (-180 to 180, up to 6 decimals). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @IsLongitude()
  longitude?: number;

  /** Period or era, for example `Ottoman`. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  period?: string;

  /** Current condition: GOOD, DAMAGED, DESTROYED or UNKNOWN. */
  @IsOptional()
  @IsEnum(LandmarkCondition)
  currentCondition?: LandmarkCondition;
}