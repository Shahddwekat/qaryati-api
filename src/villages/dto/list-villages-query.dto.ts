import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export const VILLAGE_SORT_FIELDS = ['nameAr', 'nameEn', 'createdAt'] as const;
export type VillageSortField = (typeof VILLAGE_SORT_FIELDS)[number];

/** Query string of GET /villages. */
export class ListVillagesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  governorateId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  municipalityId?: number;

  @IsOptional()
  @IsIn(VILLAGE_SORT_FIELDS)
  sortBy: VillageSortField = 'nameEn';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';
}
