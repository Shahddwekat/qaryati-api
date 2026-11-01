import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common';
import {
  ENTITY_SLUGS,
  ENTITY_SLUG_LIST,
  VerifiableEntity,
} from './verification.types';

/** Turns the `:entityType` URL segment into a VerifiableEntity, or 404. */
@Injectable()
export class ParseVerifiableEntityPipe implements PipeTransform<
  string,
  VerifiableEntity
> {
  transform(value: string): VerifiableEntity {
    if (!Object.prototype.hasOwnProperty.call(ENTITY_SLUGS, value)) {
      throw new NotFoundException(
        `Unknown fact type "${value}". Use one of: ${ENTITY_SLUG_LIST.join(', ')}`,
      );
    }
    return ENTITY_SLUGS[value];
  }
}
