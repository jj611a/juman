import { Link } from 'react-router'
import ButtonsPage from './Buttons'
import InputsPage from './Inputs'
import SelectionPage from './Selection'
import DisplayPage from './Display'
import FeedbackPage from './Feedback'
import { Divider } from '@/components/ui'

export default function AllPage(): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12" dir="rtl">
      <header>
        <h2 className="text-display text-foreground">دليل المكوّنات الحي</h2>
        <p className="text-subtitle text-muted-foreground">
          كل البدائيات في صفحة واحدة · راجع أيضاً{' '}
          <Link className="text-brand underline" to="/dev/tokens">
            الرموز
          </Link>
        </p>
      </header>
      <ButtonsPage />
      <Divider />
      <InputsPage />
      <Divider />
      <SelectionPage />
      <Divider />
      <DisplayPage />
      <Divider />
      <FeedbackPage />
    </div>
  )
}
