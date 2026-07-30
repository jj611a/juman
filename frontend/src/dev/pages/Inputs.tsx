import { Label, TextInput, PasswordInput, NumberInput, TextArea } from '@/components/ui'

export default function InputsPage(): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8" dir="rtl">
      <header>
        <h2 className="text-h2 text-foreground">الحقول</h2>
        <p className="text-body text-muted-foreground">
          نص · كلمة مرور · رقم (LTR) · مساحة نص · خطأ / نجاح
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <Label htmlFor="demo-text">الاسم</Label>
        <TextInput id="demo-text" placeholder="أدخل الاسم" leadingIcon="User" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="demo-password">كلمة المرور</Label>
        <PasswordInput id="demo-password" placeholder="••••••••" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="demo-number">المبلغ (أرقام غربية)</Label>
        <NumberInput id="demo-number" placeholder="0" defaultValue="١٢٣٤٫٥" hint="يُطبَّع إلى أرقام غربية" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="demo-error">حقل بخطأ</Label>
        <TextInput id="demo-error" fieldState="error" errorMessage="هذا الحقل مطلوب" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="demo-success">حقل ناجح</Label>
        <TextInput id="demo-success" fieldState="success" defaultValue="صحيح" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="demo-area">ملاحظات</Label>
        <TextArea id="demo-area" placeholder="اكتب هنا…" rows={4} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="demo-disabled">معطّل</Label>
        <TextInput id="demo-disabled" disabled defaultValue="لا يمكن التعديل" />
      </div>
    </div>
  )
}
