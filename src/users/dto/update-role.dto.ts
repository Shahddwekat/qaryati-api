
import { IsEnum } from 'class-validator';
import { UserRole } from '../../generated/prisma/client';

export class UpdateRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}
