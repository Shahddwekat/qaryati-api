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
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nameAr!: string;

  @IsEnum(LandmarkType)
  type!: LandmarkType;

  @IsInt()
  @Min(1)
  sourceId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nameEn?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  period?: string;

  @IsOptional()
  @IsEnum(LandmarkCondition)
  currentCondition?: LandmarkCondition;
}