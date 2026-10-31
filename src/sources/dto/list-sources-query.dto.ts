import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SourceType } from '../../generated/prisma/client';

export const SOURCE_SORT_FIELDS = ['title', 'year', 'createdAt'] as const;
export type SourceSortField = (typeof SOURCE_SORT_FIELDS)[number];

/**
 * Query string of GET /sources.
 * NOTE: page/limit live here until the shared PaginationQueryDto (Shahd) lands;
 * then this class should extend it.
 */
export class ListSourcesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsEnum(SourceType)
  type?: SourceType;

  /** Free-text search in title, author and publisher. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(SOURCE_SORT_FIELDS)
  sortBy: SourceSortField = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
