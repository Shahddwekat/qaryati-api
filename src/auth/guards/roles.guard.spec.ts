
import { jest } from '@jest/globals';
import {
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../generated/prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: {
    getAllAndOverride: jest.Mock<
      (...args: any[]) => UserRole[] | undefined
    >;
  };

  const createContext = (role?: UserRole) => {
    const handler = () => undefined;
    class TestController {}

    const context = {
      getHandler: () => handler,
      getClass: () => TestController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: role ? { id: 1, role } : undefined,
        }),
      }),
    };

    return context as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn<
        (...args: any[]) => UserRole[] | undefined
      >(),
    };

    guard = new RolesGuard(
      reflector as unknown as Reflector,
    );
  });

  it('should allow access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(
      guard.canActivate(createContext()),
    ).toBe(true);

    expect(
      reflector.getAllAndOverride,
    ).toHaveBeenCalledWith(
      ROLES_KEY,
      [expect.any(Function), expect.any(Function)],
    );
  });

  it('should allow an ADMIN to access an admin endpoint', () => {
    reflector.getAllAndOverride.mockReturnValue([
      UserRole.ADMIN,
    ]);

    expect(
      guard.canActivate(createContext(UserRole.ADMIN)),
    ).toBe(true);
  });

  it('should deny a CONTRIBUTOR access to an admin endpoint', () => {
    reflector.getAllAndOverride.mockReturnValue([
      UserRole.ADMIN,
    ]);

    expect(() =>
      guard.canActivate(
        createContext(UserRole.CONTRIBUTOR),
      ),
    ).toThrow(ForbiddenException);
  });

  it('should deny a VERIFIER access to an admin endpoint', () => {
    reflector.getAllAndOverride.mockReturnValue([
      UserRole.ADMIN,
    ]);

    expect(() =>
      guard.canActivate(createContext(UserRole.VERIFIER)),
    ).toThrow(ForbiddenException);
  });

  it('should deny access when there is no authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue([
      UserRole.ADMIN,
    ]);

    expect(() =>
      guard.canActivate(createContext()),
    ).toThrow(ForbiddenException);
  });

  it('should allow either role when multiple roles are permitted', () => {
    reflector.getAllAndOverride.mockReturnValue([
      UserRole.ADMIN,
      UserRole.VERIFIER,
    ]);

    expect(
      guard.canActivate(createContext(UserRole.VERIFIER)),
    ).toBe(true);

    expect(
      guard.canActivate(createContext(UserRole.ADMIN)),
    ).toBe(true);
  });
});

