import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ENTITY_SLUG_LIST } from '../verification.types';

/** Query string of GET /verification/queue (`page` and `limit` come from PaginationQueryDto). */
export class QueueQueryDto extends PaginationQueryDto {
  /** Only show one kind of fact, e.g. `population-records`. */
  @IsOptional()
  @IsIn(ENTITY_SLUG_LIST)
  entityType?: string;
}
