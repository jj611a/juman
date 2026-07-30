import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createDataColumn, DataTable } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'

type Row = { id: string; name: string }

describe('DataTable row actions', () => {
  it('hides actions without permission', async () => {
    useAuthStore.setState({
      ready: true,
      session: { authenticated: true, permissions: ['customer.view'], user: undefined }
    })
    const user = userEvent.setup()
    const onView = vi.fn()
    const onDelete = vi.fn()
    render(
      <div dir="rtl">
        <DataTable
          columns={[createDataColumn<Row>({ accessorKey: 'name', header: 'الاسم' })]}
          data={[{ id: '1', name: 'أحمد' }]}
          getRowId={(r) => r.id}
          showColumnVisibilityMenu={false}
          actions={[
            { id: 'view', label: 'عرض', permission: 'customer.view', onClick: onView },
            { id: 'delete', label: 'حذف', permission: 'customer.delete', onClick: onDelete }
          ]}
        />
      </div>
    )
    await user.click(screen.getByLabelText('إجراءات الصف'))
    expect(await screen.findByText('عرض')).toBeInTheDocument()
    expect(screen.queryByText('حذف')).not.toBeInTheDocument()
  })
})
