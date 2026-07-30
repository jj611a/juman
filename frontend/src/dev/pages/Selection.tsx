import { Checkbox, Label, RadioGroup, RadioGroupItem, Switch } from '@/components/ui'

export default function SelectionPage(): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8" dir="rtl">
      <header>
        <h2 className="text-h2 text-foreground">الاختيار</h2>
        <p className="text-body text-muted-foreground">Checkbox · Radio · Switch — Space/Enter</p>
      </header>

      <div className="flex items-center gap-3">
        <Checkbox id="c1" defaultChecked />
        <Label htmlFor="c1">قبول الشروط</Label>
      </div>
      <div className="flex items-center gap-3">
        <Checkbox id="c2" disabled />
        <Label htmlFor="c2">معطّل</Label>
      </div>

      <RadioGroup defaultValue="a" aria-label="خيارات تجريبية">
        <div className="flex items-center gap-3">
          <RadioGroupItem value="a" id="r1" />
          <Label htmlFor="r1">خيار أ</Label>
        </div>
        <div className="flex items-center gap-3">
          <RadioGroupItem value="b" id="r2" />
          <Label htmlFor="r2">خيار ب</Label>
        </div>
      </RadioGroup>

      <div className="flex items-center gap-3">
        <Switch id="s1" defaultChecked />
        <Label htmlFor="s1">مفعّل</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="s2" disabled />
        <Label htmlFor="s2">معطّل</Label>
      </div>
    </div>
  )
}
