
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
    /** Kind: SCHOOL, CLINIC, HOSPITAL, POST_OFFICE, WATER_NETWORK, ELECTRICITY, COMMUNITY_CENTER or OTHER. */
    @IsEnum(FacilityType)
    type!: FacilityType;

    /** Name of the facility. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    name!: string;

    /** Operating status: ACTIVE, CLOSED or PLANNED. */
    @IsEnum(FacilityStatus)
    status!: FacilityStatus;

    /** Year it was established. */
    @IsOptional()
    @IsInt()
    @Min(-32768)
    @Max(32767)
    yearEstablished?: number;

    /** Latitude in degrees (up to 6 decimals). */
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 6 })
    @IsLatitude()
    latitude?: number;

    /** Longitude in degrees (up to 6 decimals). */
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 6 })
    @IsLongitude()
    longitude?: number;

    /** Id of the source that supports this facility. */
    @IsInt()
    @Min(1)
    sourceId!: number;
}
