import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from './error-response.dto';

const DESCRIPTIONS: Record<number, string> = {
  400: 'Invalid input (validation or a business rule)',
  401: 'Missing, invalid or expired access token',
  403: 'Your role is not allowed to do this',
  404: 'Not found (or hidden)',
  409: 'Conflict: duplicate or related record',
};

/**
 * Documents the error responses of an endpoint, all with the shared error body.
 *
 *   @ApiErrors(400, 401, 403, 404)
 */
export function ApiErrors(...statuses: number[]) {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: DESCRIPTIONS[status] ?? 'Error',
        type: ErrorResponseDto,
      }),
    ),
  );
}
