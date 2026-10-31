
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { CulturalCategory } from '../../generated/prisma/client';

export class CreateCulturalTraitDto {
  @IsEnum(CulturalCategory)
  category!: CulturalCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  sourceId!: number;
}
