import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SourceType } from '../../generated/prisma/client';

export const SOURCE_SORT_FIELDS = ['title', 'year', 'createdAt'] as const;
export type SourceSortField = (typeof SOURCE_SORT_FIELDS)[number];

/** Query string of GET /sources (`page` and `limit` come from PaginationQueryDto). */
export class ListSourcesQueryDto extends PaginationQueryDto {
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
