import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination } from '@/components/ui'

describe('Pagination', () => {
  it('navigates next/prev/first/last and changes page size', async () => {
    const user = userEvent.setup()
    const onPaginationChange = vi.fn()
    render(
      <div dir="rtl">
        <Pagination
          pagination={{ pageIndex: 1, pageSize: 10 }}
          pageCount={5}
          onPaginationChange={onPaginationChange}
        />
      </div>
    )

    expect(screen.getByText('2 / 5')).toBeInTheDocument()
    await user.click(screen.getByLabelText('التالي'))
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 2, pageSize: 10 })
    await user.click(screen.getByLabelText('السابق'))
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 10 })
    await user.click(screen.getByLabelText('الصفحة الأولى'))
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 10 })
    await user.click(screen.getByLabelText('الصفحة الأخيرة'))
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 4, pageSize: 10 })

    await user.click(screen.getByRole('combobox', { name: 'حجم الصفحة' }))
    await user.click(await screen.findByRole('option', { name: '20' }))
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 20 })
  })
})
