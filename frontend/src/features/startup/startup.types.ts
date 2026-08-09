import type { StartupStatus, StartupState } from '@shared/startup'

export type { StartupStatus, StartupState }

export const STARTUP_TIMEOUT_HINT = 'استغرق تشغيل الخادم وقتاً أطول من المتوقع.'
export const STARTUP_FAILED_HINT =
  'تأكد من أن الخادم يعمل وأن المنفذ غير مشغول ببرنامج آخر.'
