import { SYSTEM_ROLE } from '../core/auth.constants';

export interface PermissionSeed {
  readonly key: string;
  readonly displayName: string;
  readonly description: string;
  readonly module: string;
}

export interface RoleSeed {
  readonly name: string;
  readonly description: string;
  readonly permissionKeys: readonly string[];
}

function perm(key: string, displayName: string, description: string): PermissionSeed {
  const module = key.split('.', 1)[0] ?? key;
  return { key, displayName, description, module };
}

/** Juman RBAC permission catalog preserved from Python V1 behavioral spec. */
export const DEFAULT_PERMISSIONS: readonly PermissionSeed[] = [
  perm('users.view', 'عرض المستخدمين', 'عرض قائمة المستخدمين'),
  perm('users.create', 'إنشاء مستخدم', 'إنشاء مستخدم جديد'),
  perm('users.update', 'تعديل مستخدم', 'تعديل بيانات المستخدم'),
  perm('users.delete', 'حذف مستخدم', 'حذف مستخدم'),
  perm('users.manage', 'إدارة المستخدمين', 'إدارة كاملة للمستخدمين'),
  perm('users.unlock', 'فتح حساب مقفل', 'إلغاء قفل حساب مستخدم'),
  perm('users.view_login_history', 'عرض سجل الدخول', 'عرض سجل محاولات الدخول'),
  perm('roles.view', 'عرض الأدوار', 'عرض الأدوار والصلاحيات المرتبطة'),
  perm('roles.create', 'إنشاء دور', 'إنشاء دور جديد'),
  perm('roles.update', 'تعديل دور', 'تعديل الدور وصلاحياته'),
  perm('roles.delete', 'حذف دور', 'حذف دور'),
  perm('roles.manage', 'إدارة الأدوار', 'إدارة كاملة للأدوار'),
  perm('permissions.view', 'عرض الصلاحيات', 'عرض قائمة الصلاحيات'),
  perm('permissions.manage', 'إدارة الصلاحيات', 'إدارة تعريفات الصلاحيات'),
  perm('settings.view', 'عرض الإعدادات', 'عرض إعدادات النظام'),
  perm('settings.update', 'تعديل الإعدادات', 'تعديل إعدادات النظام'),
  perm('media.upload', 'رفع ملفات', 'رفع ملفات إلى التخزين'),
  perm('media.view', 'عرض الملفات', 'عرض وتنزيل الملفات والمراجع'),
  perm('media.delete', 'حذف ملفات', 'حذف الملفات أو مراجعها'),
  perm('media.manage', 'إدارة الملفات', 'إدارة مراجع الملفات'),
  perm('audit.view', 'عرض سجل التدقيق', 'عرض سجلات تدقيق النظام'),
  perm('categories.view', 'عرض التصنيفات', 'عرض تصنيفات الفساتين'),
  perm('categories.create', 'إنشاء تصنيف', 'إنشاء تصنيف جديد'),
  perm('categories.update', 'تعديل تصنيف', 'تعديل تصنيف'),
  perm('categories.delete', 'حذف تصنيف', 'حذف تصنيف'),
  perm('inventory.view', 'عرض المخزون', 'عرض عناصر المخزون والفساتين'),
  perm('inventory.create', 'إضافة مخزون', 'إضافة فستان أو عنصر مخزون'),
  perm('inventory.update', 'تعديل المخزون', 'تعديل بيانات المخزون'),
  perm('inventory.delete', 'حذف المخزون', 'حذف عنصر من المخزون'),
  perm('customer.view', 'عرض العملاء', 'عرض قائمة العملاء'),
  perm('customer.create', 'إنشاء عميل', 'إنشاء عميل جديد'),
  perm('customer.update', 'تعديل عميل', 'تعديل بيانات العميل'),
  perm('customer.delete', 'حذف عميل', 'حذف عميل'),
  perm('customer.restore', 'استعادة عميل', 'استعادة عميل محذوف'),
  perm('reservation.view', 'عرض الحجوزات', 'عرض الحجوزات'),
  perm('reservation.create', 'إنشاء حجز', 'إنشاء حجز جديد'),
  perm('reservation.update', 'تعديل حجز', 'تعديل حجز'),
  perm('reservation.cancel', 'إلغاء حجز', 'إلغاء حجز'),
  perm('rental.view', 'عرض الإيجارات', 'عرض عقود الإيجار'),
  perm('rental.create', 'إنشاء إيجار', 'إنشاء عقد إيجار'),
  perm('rental.update', 'تعديل إيجار', 'تعديل عقد إيجار'),
  perm('rental.cancel', 'إلغاء إيجار', 'إلغاء عقد إيجار'),
  perm('rental.return', 'إرجاع إيجار', 'تسجيل إرجاع الفستان المستأجر'),
  perm('rental.settlement.view', 'عرض تسوية الإيجار', 'عرض تسويات الإيجار المالية'),
  perm('rental.settlement.create', 'إنشاء تسوية إيجار', 'إنشاء تسوية مالية لإيجار مُرجع'),
  perm('rental.settlement.collect', 'تحصيل تسوية إيجار', 'تسجيل دفعات على تسوية الإيجار'),
  perm('rental.settlement.adjust', 'تعديل تسوية إيجار', 'إضافة تعديلات يدوية على تسوية الإيجار'),
  perm('return.view', 'عرض المرتجعات', 'عرض عمليات الإرجاع'),
  perm('return.create', 'إنشاء مرتجع', 'تسجيل عملية إرجاع'),
  perm('return.update', 'تعديل مرتجع', 'تعديل عملية إرجاع'),
  perm('inspection.view', 'عرض الفحص', 'عرض فحوصات الفساتين'),
  perm('inspection.create', 'إنشاء فحص', 'تسجيل فحص جديد'),
  perm('inspection.update', 'تعديل فحص', 'تعديل نتيجة الفحص'),
  perm('processing.view', 'عرض المعالجة', 'عرض عمليات الغسيل والمعالجة'),
  perm('processing.create', 'بدء معالجة', 'بدء عملية غسيل/معالجة'),
  perm('processing.update', 'تعديل معالجة', 'تحديث حالة المعالجة'),
  perm('processing.complete', 'إكمال معالجة', 'إكمال عملية المعالجة'),
  perm('sale.view', 'عرض المبيعات', 'عرض فواتير البيع'),
  perm('sale.create', 'إنشاء بيع', 'إنشاء فاتورة بيع'),
  perm('sale.update', 'تعديل بيع', 'تعديل فاتورة بيع'),
  perm('sale.cancel', 'إلغاء بيع', 'إلغاء فاتورة بيع'),
  perm('payment.view', 'عرض المدفوعات', 'عرض المدفوعات'),
  perm('payment.create', 'تسجيل دفعة', 'تسجيل دفعة جديدة'),
  perm('payment.refund', 'استرداد دفعة', 'تنفيذ استرداد'),
  perm('calendar.view', 'عرض التقويم', 'عرض تقويم الحجوزات'),
  perm('calendar.manage', 'إدارة التقويم', 'إدارة أحداث التقويم'),
  perm('reports.view', 'عرض التقارير', 'عرض تقارير النظام'),
  perm('reports.financial.view', 'عرض التقارير المالية', 'عرض التقارير والإجماليات المالية'),
  perm('reports.export', 'تصدير التقارير', 'تصدير التقارير'),
  perm('system.view', 'عرض إدارة النظام', 'عرض معلومات وتشخيصات ومقاييس النظام'),
  perm('system.maintenance', 'صيانة النظام', 'تنفيذ مهام الصيانة وعرض سجلاتها'),
  perm('system.backup', 'نسخ احتياطي للنظام', 'إنشاء وتنزيل وحذف النسخ الاحتياطية'),
  perm('system.restore', 'استعادة النظام', 'التحقق من الحزم واستعادة النظام من نسخة احتياطية'),
  perm('notifications.view', 'عرض الإشعارات', 'عرض الإشعارات'),
  perm('notifications.manage', 'إدارة الإشعارات', 'إدارة إعدادات الإشعارات'),
];

export const ALL_PERMISSION_KEYS: readonly string[] = DEFAULT_PERMISSIONS.map((p) => p.key);

export const CASHIER_PERMISSIONS: readonly string[] = [
  'settings.view',
  'customer.view',
  'customer.create',
  'customer.update',
  'reservation.view',
  'reservation.create',
  'reservation.update',
  'reservation.cancel',
  'rental.view',
  'rental.create',
  'rental.update',
  'rental.cancel',
  'rental.return',
  'rental.settlement.view',
  'rental.settlement.create',
  'rental.settlement.collect',
  'return.view',
  'return.create',
  'sale.view',
  'sale.create',
  'sale.update',
  'payment.view',
  'payment.create',
  'calendar.view',
  'inventory.view',
  'reports.view',
  'reports.financial.view',
  'media.upload',
  'media.view',
];

export const INVENTORY_PERMISSIONS: readonly string[] = [
  'categories.view',
  'categories.create',
  'categories.update',
  'categories.delete',
  'inventory.view',
  'inventory.create',
  'inventory.update',
  'inventory.delete',
  'inspection.view',
  'inspection.create',
  'inspection.update',
  'calendar.view',
  'reports.view',
  'media.upload',
  'media.view',
  'media.delete',
  'media.manage',
];

export const LAUNDRY_PERMISSIONS: readonly string[] = [
  'processing.view',
  'processing.create',
  'processing.update',
  'processing.complete',
  'inspection.view',
  'inspection.create',
  'inspection.update',
  'return.view',
  'return.create',
  'return.update',
  'inventory.view',
  'rental.view',
];

export const DEFAULT_ROLES: readonly RoleSeed[] = [
  {
    name: SYSTEM_ROLE.ADMIN,
    description: 'مدير النظام — صلاحيات كاملة',
    permissionKeys: ALL_PERMISSION_KEYS,
  },
  {
    name: SYSTEM_ROLE.CASHIER,
    description: 'أمين صندوق — مبيعات وإيجار وحجوزات',
    permissionKeys: CASHIER_PERMISSIONS,
  },
  {
    name: SYSTEM_ROLE.INVENTORY,
    description: 'مسؤول المخزون — فساتين وتصنيفات',
    permissionKeys: INVENTORY_PERMISSIONS,
  },
  {
    name: SYSTEM_ROLE.LAUNDRY,
    description: 'مسؤول الغسيل — معالجة وفحص وإرجاع',
    permissionKeys: LAUNDRY_PERMISSIONS,
  },
];
