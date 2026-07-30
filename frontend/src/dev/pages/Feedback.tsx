import * as React from 'react'
import {
  Alert,
  BusyIndicator,
  Button,
  ConfirmationDialog,
  Divider,
  EmptyState,
  ErrorState,
  InlineMessage,
  LoadingOverlay,
  Progress,
  ProgressOverlay,
  Section,
  Skeleton,
  SkeletonCard,
  SkeletonList,
  SkeletonTable,
  SkeletonText,
  Spinner,
  Stack,
  toast,
  notification,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui'

export default function FeedbackPage(): React.ReactElement {
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [dangerOpen, setDangerOpen] = React.useState(false)
  const [confirmLoading, setConfirmLoading] = React.useState(false)
  const [overlayOpen, setOverlayOpen] = React.useState(false)
  const [progressOpen, setProgressOpen] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [alertVisible, setAlertVisible] = React.useState(true)

  React.useEffect(() => {
    if (!progressOpen) return
    setProgress(0)
    const id = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          window.clearInterval(id)
          setProgressOpen(false)
          return 100
        }
        return p + 10
      })
    }, 200)
    return () => window.clearInterval(id)
  }, [progressOpen])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto flex max-w-4xl flex-col gap-10" dir="rtl">
        <header>
          <h2 className="text-h2 text-foreground">التغذية الراجعة</h2>
          <p className="text-body text-muted-foreground">
            Toast · Alert · Confirmation · Overlay · Skeleton · Empty · Error
          </p>
        </header>

        <Section title="Toast" description="قائمة انتظار · إخفاء تلقائي · زر إجراء">
          <Stack direction="row" gap={2} className="flex-wrap">
            <Button size="sm" onClick={() => toast.success('تم الحفظ')}>
              نجاح
            </Button>
            <Button size="sm" variant="secondary" onClick={() => toast.info('معلومة', { description: 'تفاصيل إضافية' })}>
              معلومة
            </Button>
            <Button size="sm" variant="outline" onClick={() => toast.warning('تحذير')}>
              تحذير
            </Button>
            <Button size="sm" variant="danger" onClick={() => toast.error('فشل العملية')}>
              خطأ
            </Button>
            <Button size="sm" variant="outline" onClick={() => notification.info('عبر notification alias')}>
              notification.*
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                toast.info('يمكن التراجع', {
                  action: { label: 'تراجع', onClick: () => toast.success('تم التراجع') }
                })
              }
            >
              مع إجراء
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                for (let i = 1; i <= 5; i += 1) toast.info(`إشعار ${i}`)
              }}
            >
              اختبار الطابور (5)
            </Button>
          </Stack>
        </Section>

        <Divider />

        <Section title="Alert و InlineMessage">
          {alertVisible ? (
            <Alert
              variant="warning"
              title="تنبيه"
              description="يمكن إغلاق هذا التنبيه."
              dismissible
              onDismiss={() => setAlertVisible(false)}
            />
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAlertVisible(true)}>
              إظهار التنبيه
            </Button>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Alert variant="success" title="نجاح" description="العملية اكتملت." />
            <Alert variant="info" title="معلومة" description="للسياق في الصفحة." />
            <Alert variant="danger" title="خطر" description="تحقق قبل المتابعة." />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <InlineMessage variant="info">رسالة مضمنة</InlineMessage>
            <InlineMessage variant="success">تم</InlineMessage>
            <InlineMessage variant="warning">تحقق</InlineMessage>
            <InlineMessage variant="error">خطأ حقلي</InlineMessage>
          </div>
        </Section>

        <Divider />

        <Section title="ConfirmationDialog">
          <Stack direction="row" gap={2}>
            <Button onClick={() => setConfirmOpen(true)}>تأكيد عادي</Button>
            <Button variant="danger" onClick={() => setDangerOpen(true)}>
              تأكيد خطر
            </Button>
          </Stack>
          <ConfirmationDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="تأكيد العملية"
            description="Enter للتأكيد · Esc للإلغاء"
            onConfirm={() => {
              toast.success('تم التأكيد')
              setConfirmOpen(false)
            }}
          />
          <ConfirmationDialog
            open={dangerOpen}
            onOpenChange={setDangerOpen}
            title="حذف العنصر؟"
            description="لا يمكن التراجع عن هذا الإجراء."
            tone="danger"
            confirmLabel="حذف"
            loading={confirmLoading}
            onConfirm={() => {
              setConfirmLoading(true)
              window.setTimeout(() => {
                setConfirmLoading(false)
                setDangerOpen(false)
                toast.success('تم الحذف')
              }, 800)
            }}
          />
        </Section>

        <Divider />

        <Section title="Loading / Progress / Busy">
          <Stack direction="row" gap={2} className="flex-wrap">
            <Button
              size="sm"
              onClick={() => {
                setOverlayOpen(true)
                window.setTimeout(() => setOverlayOpen(false), 1200)
              }}
            >
              LoadingOverlay
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setProgressOpen(true)}>
              ProgressOverlay
            </Button>
            <BusyIndicator />
            <Spinner size="md" tone="brand" />
          </Stack>
          <div className="relative mt-4 h-32 overflow-hidden rounded-md border border-border">
            <p className="p-4 text-caption text-muted-foreground">حاوية نسبية للـ overlay</p>
            <LoadingOverlay open={overlayOpen} message="جاري التحميل…" />
            <ProgressOverlay open={progressOpen} value={progress} message={`${progress}%`} />
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <Progress value={40} />
          </div>
        </Section>

        <Divider />

        <Section title="Skeleton">
          <div className="grid gap-4 md:grid-cols-2">
            <SkeletonText />
            <SkeletonCard />
            <SkeletonTable rows={3} />
            <SkeletonList items={3} />
            <Skeleton variant="image" />
            <Skeleton variant="avatar" />
          </div>
        </Section>

        <Divider />

        <Section title="EmptyState و ErrorState">
          <EmptyState
            title="لا توجد عناصر"
            description="ابدأ بإضافة أول عنصر في هذه القائمة."
            primaryAction={<Button size="sm">إضافة</Button>}
            secondaryAction={
              <Button size="sm" variant="outline">
                تحديث
              </Button>
            }
          />
          <ErrorState
            message="تعذّر تحميل البيانات."
            errorCode="ERR_DEMO_500"
            details="Stack trace example for DEV only"
            onRetry={() => toast.info('إعادة المحاولة')}
          />
        </Section>

        <Divider />

        <Section title="Tooltip (من 2.2)">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">مرّر أو ركّز للتلميح</Button>
            </TooltipTrigger>
            <TooltipContent>تلميح توضيحي</TooltipContent>
          </Tooltip>
        </Section>
      </div>
    </TooltipProvider>
  )
}
