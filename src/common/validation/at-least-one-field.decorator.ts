import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'atLeastOneDefinedField', async: false })
export class AtLeastOneDefinedFieldConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as Record<string, unknown>;
    return Object.values(dto).some((value) => value !== undefined);
  }

  defaultMessage(): string {
    return 'No fields provided to update';
  }
}

/** Class-level: reject empty PATCH bodies. */
export function AtLeastOneDefinedField(validationOptions?: ValidationOptions) {
  return function (constructor: new (...args: unknown[]) => object): void {
    registerDecorator({
      name: 'atLeastOneDefinedField',
      target: constructor,
      propertyName: undefined as unknown as string,
      options: validationOptions,
      validator: AtLeastOneDefinedFieldConstraint,
    });
  };
}
