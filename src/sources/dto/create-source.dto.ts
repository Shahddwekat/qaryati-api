import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { SourceType } from '../../generated/prisma/client';

export class CreateSourceDto {
  @IsEnum(SourceType)
  type!: SourceType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  publisher?: string;

  /** Publication year. The "not in the future" rule is enforced in the service. */
  @IsOptional()
  @IsInt()
  @Min(1)
  year?: number;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  url?: string;

  /** ISO date (YYYY-MM-DD) on which a web source was last visited. */
  @IsOptional()
  @IsDateString()
  accessedAt?: string;
}
