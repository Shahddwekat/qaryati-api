import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** Body of PATCH /villages/:id. Same fields as create, all optional. */
export class UpdateVillageDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nameAr?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nameEn?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  governorateId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  municipalityId?: number;

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
  @MaxLength(5000)
  nameOrigin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  locationDescription?: string;

  @IsOptional()
  @IsInt()
  @Min(-500)
  elevationM?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  areaDunum?: number;
}
