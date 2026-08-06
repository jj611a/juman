import { useBackendHealth } from '@/shared/hooks/useBackendHealth'
import { Server, Database, Monitor, Cpu, HardDrive, Shield } from 'lucide-react'

export function SystemHealthCard() {
  const health = useBackendHealth()

  const systemItems = [
    {
      id: 'backend',
      label: 'الخلفية (NestJS)',
      status: health.isLoading ? 'loading' : health.isError ? 'offline' : 'online',
      desc: health.data?.version ? `إصدار ${health.data.version}` : 'غير متصل',
      icon: <Server size={16} />
    },
    {
      id: 'database',
      label: 'قاعدة البيانات (PostgreSQL)',
      status: health.isLoading ? 'loading' : health.isError ? 'offline' : health.data?.database === 'connected' ? 'online' : 'offline',
      desc: health.data?.database === 'connected' ? 'متصل بنجاح' : 'غير متصل',
      icon: <Database size={16} />
    },
    {
      id: 'electron',
      label: 'إطار العمل (Electron)',
      status: 'online',
      desc: 'بيئة سطح المكتب المستقلة',
      icon: <Monitor size={16} />
    },
    {
      id: 'ipc',
      label: 'ممر البيانات (IPC)',
      status: 'online',
      desc: 'قناة الاتصال الآمنة مفعلة',
      icon: <Cpu size={16} />
    },
    {
      id: 'storage',
      label: 'المساحة التخزينية (safeStorage)',
      status: 'online',
      desc: 'تشفير مفاتيح نظام التشغيل',
      icon: <HardDrive size={16} />
    }
  ]

  return (
    <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6 select-none">
      <h3 className="text-sm font-bold text-base-content/60 mb-4 flex items-center gap-2">
        <Cpu size={18} className="text-primary" />
        مؤشرات سلامة النظام
      </h3>

      <div className="flex flex-col gap-3.5">
        {systemItems.map((item) => (
          <div key={item.id} className="flex justify-between items-center bg-base-200/40 p-2.5 rounded-lg border border-base-content/5">
            <div className="flex items-center gap-2.5">
              <span className="text-base-content/50">{item.icon}</span>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-base-content">{item.label}</span>
                <span className="text-[10px] text-base-content/40">{item.desc}</span>
              </div>
            </div>

            <div>
              {item.status === 'loading' ? (
                <span className="loading loading-ring loading-xs text-primary" />
              ) : item.status === 'online' ? (
                <span className="badge badge-success badge-sm font-bold px-2 py-0.5 rounded text-[10px]">نشط</span>
              ) : (
                <span className="badge badge-error badge-sm font-bold px-2 py-0.5 rounded text-[10px]">متوقف</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
