import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ENTITY_SLUG_LIST } from '../verification.types';

/**
 * Query string of GET /verification/queue.
 * NOTE: page/limit live here until the shared PaginationQueryDto exists.
 */
export class QueueQueryDto {
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

  /** Only show one kind of fact, e.g. `population-records`. */
  @IsOptional()
  @IsIn(ENTITY_SLUG_LIST)
  entityType?: string;
}
