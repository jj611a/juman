import { Button, IconButton, Divider } from '@/components/ui'

export default function ButtonsPage(): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8" dir="rtl">
      <header>
        <h2 className="text-h2 text-foreground">الأزرار</h2>
        <p className="text-body text-muted-foreground">
          متغيرات الذهب · أحجام · تعطيل · تحميل · IconButton · لوحة مفاتيح (Tab / Enter / Space)
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h3 className="text-h3 text-foreground">المتغيرات</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">أساسي</Button>
          <Button variant="secondary">ثانوي</Button>
          <Button variant="outline">إطار</Button>
          <Button variant="ghost">شفاف</Button>
          <Button variant="danger">خطر</Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-h3 text-foreground">الأحجام والأيقونات</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" leadingIcon="Plus">صغير</Button>
          <Button size="md" trailingIcon="ChevronLeft">متوسط</Button>
          <Button size="lg">كبير</Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-h3 text-foreground">حالات</h3>
        <div className="flex flex-wrap gap-3">
          <Button disabled>معطّل</Button>
          <Button loading>تحميل</Button>
          <IconButton icon="Search" aria-label="بحث" />
          <IconButton icon="Settings" aria-label="إعدادات" variant="outline" />
          <IconButton icon="Trash2" aria-label="حذف" variant="danger" />
        </div>
      </section>
      <Divider />
      <p className="text-caption text-muted-foreground">جرّب التركيز المرئي بـ Tab.</p>
    </div>
  )
}
