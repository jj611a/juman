"""Default permissions, roles, and role-permission assignments for seeding."""

from __future__ import annotations

from dataclasses import dataclass

from app.modules.rbac.constants import SystemRoleName


@dataclass(frozen=True, slots=True)
class PermissionSeed:
    """Immutable seed definition for a permission."""

    key: str
    display_name: str
    description: str
    module: str


@dataclass(frozen=True, slots=True)
class RoleSeed:
    """Immutable seed definition for a system role."""

    name: str
    description: str
    permission_keys: tuple[str, ...]


def _perm(key: str, display_name: str, description: str) -> PermissionSeed:
    module = key.split(".", maxsplit=1)[0]
    return PermissionSeed(
        key=key,
        display_name=display_name,
        description=description,
        module=module,
    )


DEFAULT_PERMISSIONS: tuple[PermissionSeed, ...] = (
    # Users
    _perm("users.view", "عرض المستخدمين", "عرض قائمة المستخدمين"),
    _perm("users.create", "إنشاء مستخدم", "إنشاء مستخدم جديد"),
    _perm("users.update", "تعديل مستخدم", "تعديل بيانات المستخدم"),
    _perm("users.delete", "حذف مستخدم", "حذف مستخدم"),
    _perm("users.manage", "إدارة المستخدمين", "إدارة كاملة للمستخدمين"),
    _perm("users.unlock", "فتح حساب مقفل", "إلغاء قفل حساب مستخدم"),
    _perm(
        "users.view_login_history",
        "عرض سجل الدخول",
        "عرض سجل محاولات الدخول والأحداث الأمنية المرتبطة",
    ),
    # Roles / permissions
    _perm("roles.view", "عرض الأدوار", "عرض الأدوار والصلاحيات المرتبطة"),
    _perm("roles.create", "إنشاء دور", "إنشاء دور جديد"),
    _perm("roles.update", "تعديل دور", "تعديل الدور وصلاحياته"),
    _perm("roles.delete", "حذف دور", "حذف دور"),
    _perm("roles.manage", "إدارة الأدوار", "إدارة كاملة للأدوار"),
    _perm("permissions.view", "عرض الصلاحيات", "عرض قائمة الصلاحيات"),
    _perm("permissions.manage", "إدارة الصلاحيات", "إدارة تعريفات الصلاحيات"),
    # Settings
    _perm("settings.view", "عرض الإعدادات", "عرض إعدادات النظام"),
    _perm("settings.update", "تعديل الإعدادات", "تعديل إعدادات النظام"),
    # Media
    _perm("media.upload", "رفع ملفات", "رفع ملفات إلى التخزين"),
    _perm("media.view", "عرض الملفات", "عرض وتنزيل الملفات والمراجع"),
    _perm("media.delete", "حذف ملفات", "حذف الملفات أو مراجعها"),
    _perm("media.manage", "إدارة الملفات", "إدارة مراجع الملفات"),
    # Audit
    _perm("audit.view", "عرض سجل التدقيق", "عرض سجلات تدقيق النظام والتغييرات"),
    # Categories
    _perm("categories.view", "عرض التصنيفات", "عرض تصنيفات الفساتين"),
    _perm("categories.create", "إنشاء تصنيف", "إنشاء تصنيف جديد"),
    _perm("categories.update", "تعديل تصنيف", "تعديل تصنيف"),
    _perm("categories.delete", "حذف تصنيف", "حذف تصنيف"),
    # Inventory / dresses
    _perm("inventory.view", "عرض المخزون", "عرض عناصر المخزون والفساتين"),
    _perm("inventory.create", "إضافة مخزون", "إضافة فستان أو عنصر مخزون"),
    _perm("inventory.update", "تعديل المخزون", "تعديل بيانات المخزون"),
    _perm("inventory.delete", "حذف المخزون", "حذف عنصر من المخزون"),
    # Customers
    _perm("customer.view", "عرض العملاء", "عرض قائمة العملاء"),
    _perm("customer.create", "إنشاء عميل", "إنشاء عميل جديد"),
    _perm("customer.update", "تعديل عميل", "تعديل بيانات العميل"),
    _perm("customer.delete", "حذف عميل", "حذف عميل"),
    # Reservations
    _perm("reservation.view", "عرض الحجوزات", "عرض الحجوزات"),
    _perm("reservation.create", "إنشاء حجز", "إنشاء حجز جديد"),
    _perm("reservation.update", "تعديل حجز", "تعديل حجز"),
    _perm("reservation.cancel", "إلغاء حجز", "إلغاء حجز"),
    # Rentals
    _perm("rental.view", "عرض الإيجارات", "عرض عقود الإيجار"),
    _perm("rental.create", "إنشاء إيجار", "إنشاء عقد إيجار"),
    _perm("rental.update", "تعديل إيجار", "تعديل عقد إيجار"),
    _perm("rental.cancel", "إلغاء إيجار", "إلغاء عقد إيجار"),
    _perm("rental.return", "إرجاع إيجار", "تسجيل إرجاع الفستان المستأجر"),
    _perm("rental.settlement.view", "عرض تسوية الإيجار", "عرض تسويات الإيجار المالية"),
    _perm("rental.settlement.create", "إنشاء تسوية إيجار", "إنشاء تسوية مالية لإيجار مُرجع"),
    _perm(
        "rental.settlement.collect",
        "تحصيل تسوية إيجار",
        "تسجيل دفعات على تسوية الإيجار",
    ),
    _perm(
        "rental.settlement.adjust",
        "تعديل تسوية إيجار",
        "إضافة تعديلات يدوية على تسوية الإيجار",
    ),
    # Returns
    _perm("return.view", "عرض المرتجعات", "عرض عمليات الإرجاع"),
    _perm("return.create", "إنشاء مرتجع", "تسجيل عملية إرجاع"),
    _perm("return.update", "تعديل مرتجع", "تعديل عملية إرجاع"),
    # Inspection
    _perm("inspection.view", "عرض الفحص", "عرض فحوصات الفساتين"),
    _perm("inspection.create", "إنشاء فحص", "تسجيل فحص جديد"),
    _perm("inspection.update", "تعديل فحص", "تعديل نتيجة الفحص"),
    # Processing / laundry
    _perm("processing.view", "عرض المعالجة", "عرض عمليات الغسيل والمعالجة"),
    _perm("processing.create", "بدء معالجة", "بدء عملية غسيل/معالجة"),
    _perm("processing.update", "تعديل معالجة", "تحديث حالة المعالجة"),
    _perm("processing.complete", "إكمال معالجة", "إكمال عملية المعالجة"),
    # Sales
    _perm("sale.view", "عرض المبيعات", "عرض فواتير البيع"),
    _perm("sale.create", "إنشاء بيع", "إنشاء فاتورة بيع"),
    _perm("sale.update", "تعديل بيع", "تعديل فاتورة بيع"),
    _perm("sale.cancel", "إلغاء بيع", "إلغاء فاتورة بيع"),
    # Payments
    _perm("payment.view", "عرض المدفوعات", "عرض المدفوعات"),
    _perm("payment.create", "تسجيل دفعة", "تسجيل دفعة جديدة"),
    _perm("payment.refund", "استرداد دفعة", "تنفيذ استرداد"),
    # Calendar
    _perm("calendar.view", "عرض التقويم", "عرض تقويم الحجوزات"),
    _perm("calendar.manage", "إدارة التقويم", "إدارة أحداث التقويم"),
    # Reports
    _perm("reports.view", "عرض التقارير", "عرض تقارير النظام"),
    _perm(
        "reports.financial.view",
        "عرض التقارير المالية",
        "عرض التقارير والإجماليات المالية",
    ),
    _perm("reports.export", "تصدير التقارير", "تصدير التقارير"),
    # System administration
    _perm("system.view", "عرض إدارة النظام", "عرض معلومات وتشخيصات ومقاييس النظام"),
    _perm("system.maintenance", "صيانة النظام", "تنفيذ مهام الصيانة وعرض سجلاتها"),
    _perm("system.backup", "نسخ احتياطي للنظام", "إنشاء وتنزيل وحذف النسخ الاحتياطية"),
    _perm("system.restore", "استعادة النظام", "التحقق من الحزم واستعادة النظام من نسخة احتياطية"),
    # Notifications
    _perm("notifications.view", "عرض الإشعارات", "عرض الإشعارات"),
    _perm("notifications.manage", "إدارة الإشعارات", "إدارة إعدادات الإشعارات"),
)

ALL_PERMISSION_KEYS: tuple[str, ...] = tuple(p.key for p in DEFAULT_PERMISSIONS)

CASHIER_PERMISSIONS: tuple[str, ...] = (
    "settings.view",
    "customer.view",
    "customer.create",
    "customer.update",
    "reservation.view",
    "reservation.create",
    "reservation.update",
    "reservation.cancel",
    "rental.view",
    "rental.create",
    "rental.update",
    "rental.cancel",
    "rental.return",
    "rental.settlement.view",
    "rental.settlement.create",
    "rental.settlement.collect",
    "return.view",
    "return.create",
    "sale.view",
    "sale.create",
    "sale.update",
    "payment.view",
    "payment.create",
    "calendar.view",
    "inventory.view",
    "reports.view",
    "reports.financial.view",
    "media.upload",
    "media.view",
)

INVENTORY_PERMISSIONS: tuple[str, ...] = (
    "categories.view",
    "categories.create",
    "categories.update",
    "categories.delete",
    "inventory.view",
    "inventory.create",
    "inventory.update",
    "inventory.delete",
    "inspection.view",
    "inspection.create",
    "inspection.update",
    "calendar.view",
    "reports.view",
    "media.upload",
    "media.view",
    "media.delete",
    "media.manage",
)

LAUNDRY_PERMISSIONS: tuple[str, ...] = (
    "processing.view",
    "processing.create",
    "processing.update",
    "processing.complete",
    "inspection.view",
    "inspection.create",
    "inspection.update",
    "return.view",
    "return.create",
    "return.update",
    "inventory.view",
    "rental.view",
)

DEFAULT_ROLES: tuple[RoleSeed, ...] = (
    RoleSeed(
        name=SystemRoleName.ADMIN,
        description="مدير النظام — صلاحيات كاملة",
        permission_keys=ALL_PERMISSION_KEYS,
    ),
    RoleSeed(
        name=SystemRoleName.CASHIER,
        description="أمين صندوق — مبيعات وإيجار وحجوزات",
        permission_keys=CASHIER_PERMISSIONS,
    ),
    RoleSeed(
        name=SystemRoleName.INVENTORY,
        description="مسؤول المخزون — فساتين وتصنيفات",
        permission_keys=INVENTORY_PERMISSIONS,
    ),
    RoleSeed(
        name=SystemRoleName.LAUNDRY,
        description="مسؤول الغسيل — معالجة وفحص وإرجاع",
        permission_keys=LAUNDRY_PERMISSIONS,
    ),
)
