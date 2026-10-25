
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsYearAfterOrEqual(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isYearAfterOrEqual',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,

      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (value === undefined || value === null) {
            return true;
          }

          const startYear = (
            args.object as Record<string, unknown>
          )[args.constraints[0] as string];

          if (
            typeof value !== 'number' ||
            !Number.isInteger(value) ||
            typeof startYear !== 'number' ||
            !Number.isInteger(startYear)
          ) {
            return false;
          }

          return value >= startYear;
        },

        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be greater than or equal to ${args.constraints[0]}`;
        },
      },
    });
  };
}
