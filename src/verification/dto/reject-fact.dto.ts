import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectFactDto {
  /** Why the fact is rejected. Shown to the contributor and kept in the audit log. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
