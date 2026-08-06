import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'

function Label(): React.ReactElement {
  const { t } = useTranslation()
  return <span>{t('app.name')}</span>
}

describe('i18n Arabic', () => {
  it('renders Arabic brand name', async () => {
    await i18n.changeLanguage('ar')
    render(
      <I18nextProvider i18n={i18n}>
        <Label />
      </I18nextProvider>
    )
    expect(screen.getByText('جمان')).toBeInTheDocument()
  })
})
