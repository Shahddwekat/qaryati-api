import { ENTITY_SLUG_LIST } from './verification.types';

/** Texts shared by the Swagger docs of every endpoint that reviews facts. */
export const FOUR_EYES_NOTE =
  'Four-eyes rule: you cannot review a fact that you submitted yourself ' +
  '(403), even as ADMIN. Another reviewer has to do it.';

/** The allowed values of `entityType`, taken from the real list so docs cannot drift. */
export const ENTITY_TYPE_VALUES = ENTITY_SLUG_LIST.join(', ');
