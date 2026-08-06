import * as React from 'react'
import { Button, InlineMessage, Section, Stack, TextInput, PasswordInput, Checkbox, Label } from '@/components/ui'

export default function AuthShowcasePage(): React.ReactElement {
  return (
    <Stack gap={8}>
      <Section title="Authentication UI (showcase)">
        <p className="text-body text-muted-foreground">
          Visual examples only — real login uses Electron IPC and never exposes JWTs in the renderer.
        </p>
      </Section>
      <Section title="Login form shape">
        <div className="max-w-md space-y-3 rounded-md border border-border bg-panel p-4">
          <div className="space-y-1">
            <Label>اسم المستخدم</Label>
            <TextInput defaultValue="admin" />
          </div>
          <div className="space-y-1">
            <Label>كلمة المرور</Label>
            <PasswordInput defaultValue="secret" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="rem" defaultChecked />
            <Label htmlFor="rem">تذكرني</Label>
          </div>
          <Button type="button" className="w-full" disabled>
            تسجيل الدخول (عرض)
          </Button>
          <InlineMessage variant="error">بيانات الدخول غير صحيحة (مثال)</InlineMessage>
          <InlineMessage variant="warning">أنت غير متصل بالشبكة (مثال)</InlineMessage>
        </div>
      </Section>
      <Section title="Force password">
        <InlineMessage variant="info">عند mustChangePassword يُوجَّه المستخدم إلى #/force-password-change</InlineMessage>
      </Section>
    </Stack>
  )
}
