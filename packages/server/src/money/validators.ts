import { ValidateBy, type ValidationOptions } from 'class-validator';
import { Currency } from './currency.js';
import { ExchangeRate } from './exchange-rate.js';

export function IsCurrencyCode(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isCurrencyCode',
      validator: {
        validate: (value) => typeof value === 'string' && Currency.isValid(value),
        defaultMessage: (args) =>
          `${args?.property} must be an ISO 4217 currency code like "NGN"`,
      },
    },
    options,
  );
}

export function IsExchangeRate(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isExchangeRate',
      validator: {
        validate: (value) => typeof value === 'string' && ExchangeRate.isValid(value),
        defaultMessage: (args) =>
          `${args?.property} must be a positive decimal string like "1550.25"`,
      },
    },
    options,
  );
}
