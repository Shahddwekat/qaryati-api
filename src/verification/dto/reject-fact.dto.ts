import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectFactDto {
  /** Why the fact is rejected (at most 500 characters). Kept in the audit log, so be specific. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
