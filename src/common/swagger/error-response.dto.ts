import { ApiProperty } from '@nestjs/swagger';

/** Swagger model of the error body (see docs/architecture/error-model.md). */
export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({ example: 'Not Found' })
  error!: string;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Village #999 not found',
    description: 'A list of messages for validation errors',
  })
  message!: string | string[];

  @ApiProperty({ example: '/api/v1/villages/999' })
  path!: string;

  @ApiProperty({ example: '2026-11-04T10:15:30.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '6f1c2a0e-8a43-4b8e-9f5e-2d1c7a9b0e11' })
  requestId!: string;
}
