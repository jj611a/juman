import {
  addFils,
  assertFils,
  assertNonNegativeFils,
  filsToMajorString,
  subtractFils,
  toFils,
  type Fils,
} from '../../shared/money/money';
import { BusinessException } from '../../shared/errors/business.exception';
import { FINANCE_CURRENCY } from '../finance.constants';

/**
 * Immutable IQD money value object. Storage unit = integer fils.
 * Never use floating point for domain arithmetic.
 */
export class Money {
  private constructor(private readonly fils: Fils) {}

  static readonly currency = FINANCE_CURRENCY;

  static zero(): Money {
    return new Money(toFils(0));
  }

  static ofFils(value: number): Money {
    return new Money(assertFils(value, 'amountFils'));
  }

  static ofNonNegativeFils(value: number): Money {
    return new Money(assertNonNegativeFils(assertFils(value, 'amountFils')));
  }

  get amountFils(): number {
    return this.fils;
  }

  get currency(): string {
    return FINANCE_CURRENCY;
  }

  isZero(): boolean {
    return this.fils === 0;
  }

  isNegative(): boolean {
    return this.fils < 0;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(addFils(this.fils, other.fils));
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(subtractFils(this.fils, other.fils));
  }

  negate(): Money {
    return new Money(assertFils(-this.fils));
  }

  equals(other: Money): boolean {
    return this.fils === other.fils && this.currency === other.currency;
  }

  toMajorString(): string {
    return filsToMajorString(this.fils);
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw BusinessException.validation('Currency mismatch — IQD only');
    }
  }
}
