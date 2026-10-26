
import {
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsLatitude,
    IsLongitude,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

import {
    FacilityType,
    FacilityStatus,
} from '../../generated/prisma/client';

export class CreateFacilityDto {
    @IsEnum(FacilityType)
    type!: FacilityType;

    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    name!: string;

    @IsEnum(FacilityStatus)
    status!: FacilityStatus;

    @IsOptional()
    @IsInt()
    @Min(-32768)
    @Max(32767)
    yearEstablished?: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 6 })
    @IsLatitude()
    latitude?: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 6 })
    @IsLongitude()
    longitude?: number;

    @IsInt()
    @Min(1)
    sourceId!: number;
}
