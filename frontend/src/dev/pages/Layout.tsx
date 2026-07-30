import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
  buildBreadcrumbTrail,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Divider,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  EmptyState,
  Grid,
  Page,
  PageActions,
  PageContent,
  PageFooter,
  PageHeader,
  PageSubtitle,
  PageTitle,
  PageToolbar,
  Panel,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ScrollArea,
  SearchBar,
  Section,
  Stack,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui'

export default function LayoutPage(): React.ReactElement {
  const [panelLoading, setPanelLoading] = React.useState(false)
  const [openCollapsible, setOpenCollapsible] = React.useState(false)
  const [pageLoading, setPageLoading] = React.useState(false)
  const [pageEmpty, setPageEmpty] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const collapsedTrail = buildBreadcrumbTrail(
    [
      { id: 'home', label: 'الرئيسية', href: '#/dev/all', icon: 'House' },
      { id: 'inv', label: 'المخزون', href: '#/dev/data' },
      { id: 'dresses', label: 'الفساتين', href: '#/dev/layout' },
      { id: 'cat', label: 'سهرة', href: '#/dev/layout' },
      { id: 'cur', label: 'تفاصيل الفستان', current: true }
    ],
    { maxItems: 4 }
  )

  return (
    <Page size="lg" as="main" dir="rtl">
      <PageHeader>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#/dev/all" icon="House">
                الرئيسية
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#/dev/layout">التخطيط</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbCurrent>المعرض</BreadcrumbCurrent>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex flex-col gap-1">
            <PageTitle>التخطيط</PageTitle>
            <PageSubtitle>
              Page · Breadcrumb · Toolbar · Footer · Card · Dialog · Drawer · Tabs
            </PageSubtitle>
          </div>
          <PageActions>
            <Button variant="secondary" size="sm">
              ثانوي
            </Button>
            <Button size="sm">أساسي</Button>
          </PageActions>
        </div>
      </PageHeader>

      <PageToolbar>
        <SearchBar value={query} onValueChange={setQuery} className="max-w-xs" placeholder="بحث في المعرض…" />
        <Button size="sm" variant="outline" onClick={() => setPageLoading((v) => !v)}>
          تبديل تحميل الصفحة
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPageEmpty((v) => !v)}>
          تبديل فارغ
        </Button>
      </PageToolbar>

      <PageContent
        loading={pageLoading}
        empty={
          pageEmpty ? (
            <EmptyState title="لا محتوى" description="فعّل المحتوى من شريط الأدوات." />
          ) : undefined
        }
      >
          <Section title="Stack و Grid" description="فجوات من مقياس المسافات فقط.">
            <Stack direction="row" gap={3} align="center">
              <BadgeChip>صف</BadgeChip>
              <BadgeChip>محاذاة</BadgeChip>
              <BadgeChip>فجوة-3</BadgeChip>
            </Stack>
            <Grid cols={3} gap={4} className="mt-4">
              {(['default', 'outlined', 'elevated', 'interactive', 'highlighted'] as const).map(
                (variant) => (
                  <Card key={variant} variant={variant}>
                    <CardHeader>
                      <CardTitle>{variant}</CardTitle>
                      <CardDescription>متغير البطاقة</CardDescription>
                    </CardHeader>
                    <CardContent className="text-caption text-muted-foreground">
                      محتوى توضيحي للبطاقة.
                    </CardContent>
                  </Card>
                )
              )}
            </Grid>
          </Section>

          <Divider />

          <Section title="Panel" description="عنوان · شريط أدوات · تحميل · فارغ">
            <Stack gap={4}>
              <Panel
                title="لوحة عادية"
                subtitle="وصف فرعي"
                toolbar={
                  <Button size="sm" variant="outline" onClick={() => setPanelLoading((v) => !v)}>
                    تبديل التحميل
                  </Button>
                }
                actions={<Button size="sm">إجراء</Button>}
                loading={panelLoading}
              >
                محتوى اللوحة يظهر عند انتهاء التحميل.
              </Panel>
              <Panel title="لوحة فارغة" empty={<p className="text-center text-caption text-muted-foreground">لا توجد بيانات</p>} />
            </Stack>
          </Section>

          <Divider />

          <Section title="Dialog و Drawer" description="Radix Dialog · الإغلاق بـ ESC">
            <Stack direction="row" gap={3}>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>فتح الحوار</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>تأكيد العملية</DialogTitle>
                    <DialogDescription>هذا حوار مركزي مع فخ تركيز وإغلاق بلوحة المفاتيح.</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="secondary">إلغاء</Button>
                    <Button>تأكيد</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Drawer>
                <DrawerTrigger asChild>
                  <Button variant="secondary">درج يمين (md)</Button>
                </DrawerTrigger>
                <DrawerContent side="right" size="md">
                  <DrawerHeader>
                    <DrawerTitle>درج جانبي</DrawerTitle>
                    <DrawerDescription>الافتراضي side=&quot;right&quot; · زر الإغلاق في بداية الرأس (RTL).</DrawerDescription>
                  </DrawerHeader>
                  <DrawerBody>
                    <p className="text-body text-muted-foreground">محتوى الدرج…</p>
                  </DrawerBody>
                  <DrawerFooter>
                    <DrawerClose asChild>
                      <Button variant="secondary">إغلاق</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>

              <Drawer>
                <DrawerTrigger asChild>
                  <Button variant="outline">درج صغير</Button>
                </DrawerTrigger>
                <DrawerContent side="right" size="sm">
                  <DrawerHeader>
                    <DrawerTitle>حجم sm</DrawerTitle>
                    <DrawerDescription>360px</DrawerDescription>
                  </DrawerHeader>
                  <DrawerBody>محتوى مختصر</DrawerBody>
                </DrawerContent>
              </Drawer>
            </Stack>
          </Section>

          <Divider />

          
          <Section title="Breadcrumb (تسلسل الوحدة)" description="معلوماتي فقط — الشريط الجانبي هو التنقل الأساسي.">
            <Stack gap={4}>
              <Breadcrumb>
                <BreadcrumbList truncate>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#/dev/all" icon="House">
                      الرئيسية
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#/dev/data">المخزون</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#/dev/layout">الفساتين</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbCurrent>تفاصيل الفستان</BreadcrumbCurrent>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div>
                <p className="mb-2 text-caption text-muted-foreground">مسار مطوي عبر buildBreadcrumbTrail</p>
                <Breadcrumb>
                  <BreadcrumbList>
                    {collapsedTrail.flatMap((c, i) => {
                      const nodes = []
                      if (i > 0) nodes.push(<BreadcrumbSeparator key={`sep-${c.id}`} />)
                      nodes.push(
                        <BreadcrumbItem key={c.id}>
                          {c.id === '__ellipsis' ? (
                            <BreadcrumbEllipsis />
                          ) : c.current ? (
                            <BreadcrumbCurrent>{c.label}</BreadcrumbCurrent>
                          ) : (
                            <BreadcrumbLink href={c.href} icon={c.icon}>
                              {c.label}
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                      )
                      return nodes
                    })}
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
              <div>
                <p className="mb-2 text-caption text-muted-foreground">PageHeader بخصائص (توافق خلفي)</p>
                <PageHeader
                  className="rounded-md border border-border px-4 pt-4"
                  title="عنوان عبر الخصائص"
                  description="وصف عبر الخصائص"
                  actions={
                    <PageActions>
                      <Button size="sm">إجراء</Button>
                    </PageActions>
                  }
                />
              </div>
            </Stack>
          </Section>

          <Divider />

          <Section title="Tabs · Accordion · Collapsible">
            <Tabs defaultValue="a">
              <TabsList>
                <TabsTrigger value="a" icon="LayoutGrid" badge={2}>
                  تبويب أ
                </TabsTrigger>
                <TabsTrigger value="b" icon="Rows3">
                  تبويب ب
                </TabsTrigger>
                <TabsTrigger value="c" disabled>
                  معطّل
                </TabsTrigger>
              </TabsList>
              <TabsContent value="a" lazy>
                محتوى التبويب الأول (workspace داخل الصفحة — ليس تنقل التطبيق)
              </TabsContent>
              <TabsContent value="b">محتوى التبويب الثاني</TabsContent>
              <TabsContent value="c">لن يظهر — معطّل</TabsContent>
            </Tabs>

            <Accordion type="single" collapsible className="mt-6 w-full">
              <AccordionItem value="1">
                <AccordionTrigger>عنصر أكورديون ١</AccordionTrigger>
                <AccordionContent>تفاصيل قابلة للطي مع حركة من التوكنات.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="2">
                <AccordionTrigger>عنصر أكورديون ٢</AccordionTrigger>
                <AccordionContent>محتوى إضافي.</AccordionContent>
              </AccordionItem>
            </Accordion>

            <Collapsible open={openCollapsible} onOpenChange={setOpenCollapsible} className="mt-6">
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                  {openCollapsible ? 'إخفاء' : 'إظهار'} الطي البسيط
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 rounded-md border border-border p-3 text-body text-muted-foreground">
                محتوى Collapsible بدون أكورديون متعدد.
              </CollapsibleContent>
            </Collapsible>
          </Section>

          <Divider />

          <Section title="ScrollArea و Resizable" description="تقسيم اللوحات للتقارير/المخزون — ليس للنماذج العادية.">
            <ScrollArea className="h-32 rounded-md border border-border">
              <div className="space-y-2 p-3">
                {Array.from({ length: 12 }, (_, i) => (
                  <p key={i} className="text-caption text-muted-foreground">
                    سطر تمرير مخصّص {i + 1}
                  </p>
                ))}
              </div>
            </ScrollArea>

            <div className="mt-4 h-48 overflow-hidden rounded-md border border-border">
              <ResizablePanelGroup orientation="horizontal" autoSaveId="dev-layout-demo">
                <ResizablePanel defaultSize="50%" minSize="20%">
                  <div className="flex h-full items-center justify-center p-4 text-caption">لوحة أ</div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize="50%" minSize="20%">
                  <div className="flex h-full items-center justify-center p-4 text-caption">لوحة ب</div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </Section>
        </PageContent>

      <PageFooter>
        <span className="text-caption text-muted-foreground">تذييل الصفحة · Pagination / ملخص</span>
        <PageActions>
          <Button size="sm" variant="secondary">
            إلغاء
          </Button>
          <Button size="sm">حفظ</Button>
        </PageActions>
      </PageFooter>
    </Page>
  )
}

function BadgeChip({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span className="rounded-md border border-border bg-card px-2 py-1 text-caption text-muted-foreground">
      {children}
    </span>
  )
}
