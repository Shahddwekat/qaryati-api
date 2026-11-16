
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
  /** Kind: FOOD, CRAFT, DRESS, MUSIC_DANCE, FESTIVAL, DIALECT, CUSTOM or OTHER. */
  @IsEnum(CulturalCategory)
  category!: CulturalCategory;

  /** Name of the trait, for example the name of a dish or a festival. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  /** More details about the trait. */
  @IsOptional()
  @IsString()
  description?: string;

  /** Id of the source that supports this trait. */
  @IsInt()
  @Min(1)
  sourceId!: number;
}
