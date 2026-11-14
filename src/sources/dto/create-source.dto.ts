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
  /** Kind of source: BOOK, ARTICLE, CENSUS, ARCHIVE, WEBSITE, ORAL or OTHER. */
  @IsEnum(SourceType)
  type!: SourceType;

  /** Title of the work or page, as it is written in the source. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  /** Author or organisation that wrote it, if known. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string;

  /** Publisher or institution, for example `PCBS`. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  publisher?: string;

  /** Publication year (not in the future). */
  @IsOptional()
  @IsInt()
  @Min(1)
  year?: number;

  /** Link to the source, starting with http:// or https://. */
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  url?: string;

  /** Date (YYYY-MM-DD) on which a web source was last visited. */
  @IsOptional()
  @IsDateString()
  accessedAt?: string;
}
