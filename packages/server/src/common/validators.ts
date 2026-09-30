import { ValidateBy, type ValidationOptions } from 'class-validator';
import { Currency } from '../money/currency.js';
import { ExchangeRate } from '../money/exchange-rate.js';

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

/** An IANA time zone name such as "Africa/Lagos". */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function IsTimeZone(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isTimeZone',
      validator: {
        validate: isTimeZone,
        defaultMessage: (args) =>
          `${args?.property} must be an IANA time zone like "Africa/Lagos"`,
      },
    },
    options,
  );
}
