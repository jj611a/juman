import { DEFAULT_LOCALE } from '../constants/business.constants';

const AR: Record<string, string> = {
  'error.not_found': 'العنصر غير موجود',
  'error.validation': 'بيانات غير صالحة',
  'error.conflict': 'تعارض في البيانات',
  'error.forbidden': 'غير مصرح',
  'barcode.invalid': 'الباركود غير صالح',
  'barcode.taken': 'الباركود مستخدم مسبقاً',
  'setting.readonly': 'هذا الإعداد غير قابل للتعديل',
};

const EN: Record<string, string> = {
  'error.not_found': 'Not found',
  'error.validation': 'Validation failed',
  'error.conflict': 'Conflict',
  'error.forbidden': 'Forbidden',
  'barcode.invalid': 'Invalid barcode',
  'barcode.taken': 'Barcode already taken',
  'setting.readonly': 'Setting is not editable',
};

export function t(key: string, locale: string = DEFAULT_LOCALE): string {
  const table = locale.toLowerCase().startsWith('ar') ? AR : EN;
  return table[key] ?? EN[key] ?? key;
}

export function operatorMessage(key: string): string {
  return t(key, DEFAULT_LOCALE);
}