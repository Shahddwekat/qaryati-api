
import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

export interface CurrentUserData {
  id: number;
  email: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (
    data: keyof CurrentUserData | undefined,
    ctx: ExecutionContext,
  ) => {
    const request = ctx.switchToHttp().getRequest<{
      user?: CurrentUserData;
    }>();

    const user = request.user;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
