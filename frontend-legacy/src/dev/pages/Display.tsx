import { Avatar, AvatarFallback, AvatarImage, Badge, Chip, Label } from '@/components/ui'

export default function DisplayPage(): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8" dir="rtl">
      <header>
        <h2 className="text-h2 text-foreground">العرض</h2>
        <p className="text-body text-muted-foreground">Label · Badge · Chip · Avatar</p>
      </header>

      <Label>تسمية عادية</Label>

      <div className="flex flex-wrap gap-2">
        <Badge>افتراضي</Badge>
        <Badge variant="brand">ذهبي</Badge>
        <Badge variant="success">نجاح</Badge>
        <Badge variant="warning">تحذير</Badge>
        <Badge variant="danger">خطر</Badge>
        <Badge variant="info">معلومة</Badge>
        <Badge variant="outline">إطار</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip>وسم</Chip>
        <Chip variant="brand">ذهبي</Chip>
        <Chip onDismiss={() => undefined}>قابل للإزالة</Chip>
      </div>

      <div className="flex items-center gap-4">
        <Avatar>
          <AvatarImage alt="" src="" />
          <AvatarFallback>جم</AvatarFallback>
        </Avatar>
        <Avatar className="size-14">
          <AvatarFallback>ع م</AvatarFallback>
        </Avatar>
      </div>
    </div>
  )
}
