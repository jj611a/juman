import {
  BARCODE_DEFAULT_PADDING,
  BARCODE_DEFAULT_PREFIX,
  BARCODE_DEFAULT_SEPARATOR,
  DEFAULT_CURRENCY_CODE,
  DEFAULT_CURRENCY_SYMBOL,
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  SETTING_VALUE_TYPE,
} from '../shared/constants/business.constants';

export interface SettingSeed {
  readonly key: string;
  readonly value: string;
  readonly valueType: string;
  readonly category: string;
  readonly description: string;
  readonly isEditable: boolean;
}

export const DEFAULT_APP_SETTINGS: readonly SettingSeed[] = [
  {
    key: 'company.name',
    value: 'جمان',
    valueType: SETTING_VALUE_TYPE.STRING,
    category: 'company',
    description: 'Company display name',
    isEditable: true,
  },
  {
    key: 'currency.code',
    value: DEFAULT_CURRENCY_CODE,
    valueType: SETTING_VALUE_TYPE.STRING,
    category: 'financial',
    description: 'ISO currency code',
    isEditable: false,
  },
  {
    key: 'currency.symbol',
    value: DEFAULT_CURRENCY_SYMBOL,
    valueType: SETTING_VALUE_TYPE.STRING,
    category: 'financial',
    description: 'Currency symbol',
    isEditable: true,
  },
  {
    key: 'locale.default',
    value: DEFAULT_LOCALE,
    valueType: SETTING_VALUE_TYPE.STRING,
    category: 'system',
    description: 'Default UI locale',
    isEditable: true,
  },
  {
    key: 'timezone.default',
    value: DEFAULT_TIMEZONE,
    valueType: SETTING_VALUE_TYPE.STRING,
    category: 'system',
    description: 'Business timezone',
    isEditable: true,
  },
  {
    key: 'barcode.prefix',
    value: BARCODE_DEFAULT_PREFIX,
    valueType: SETTING_VALUE_TYPE.STRING,
    category: 'inventory',
    description: 'Default barcode prefix',
    isEditable: true,
  },
  {
    key: 'barcode.separator',
    value: BARCODE_DEFAULT_SEPARATOR,
    valueType: SETTING_VALUE_TYPE.STRING,
    category: 'inventory',
    description: 'Barcode separator between prefix and sequence',
    isEditable: true,
  },
  {
    key: 'barcode.padding',
    value: String(BARCODE_DEFAULT_PADDING),
    valueType: SETTING_VALUE_TYPE.INTEGER,
    category: 'inventory',
    description: 'Zero-pad width for barcode sequence',
    isEditable: true,
  },
  {
    key: 'media.max_upload_bytes',
    value: String(10 * 1024 * 1024),
    valueType: SETTING_VALUE_TYPE.INTEGER,
    category: 'media',
    description: 'Max upload size in bytes',
    isEditable: true,
  },
];