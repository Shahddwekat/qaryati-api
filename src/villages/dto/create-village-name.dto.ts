import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { NameLanguage, NameType } from '../../generated/prisma/client';

/** Body of POST /villages/:id/names. */
export class CreateVillageNameDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsEnum(NameLanguage)
  language!: NameLanguage;

  @IsEnum(NameType)
  type!: NameType;

  /** For historical names, e.g. "Ottoman era" or "before 1948". */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  periodNote?: string;

  /** Required for HISTORICAL names (checked in the service), optional otherwise. */
  @IsOptional()
  @IsInt()
  @Min(1)
  sourceId?: number;
}
