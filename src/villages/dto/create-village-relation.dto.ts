import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { RelationType } from '../../generated/prisma/client';

/**
 * Body of POST /villages/:id/relations.
 * Read as: "village :id <type> relatedVillageId", e.g. SPLIT_FROM.
 */
export class CreateVillageRelationDto {
  @IsInt()
  @Min(1)
  relatedVillageId!: number;

  @IsEnum(RelationType)
  type!: RelationType;

  /** Year the change happened (range checked in the service). */
  @IsOptional()
  @IsInt()
  year?: number;

  @IsInt()
  @Min(1)
  sourceId!: number;
}
