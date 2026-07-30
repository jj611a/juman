import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createDataColumn, DataTable } from '@/components/ui'

type Row = { id: string; name: string }

const columns = [
  createDataColumn<Row>({ accessorKey: 'name', header: 'الاسم', sortable: true }),
]

const rows: Row[] = [
  { id: '1', name: 'أحمد' },
  { id: '2', name: 'سارة' }
]

describe('DataTable', () => {
  it('renders column headers and cells', () => {
    render(
      <div dir="rtl">
        <DataTable columns={columns} data={rows} getRowId={(r) => r.id} showColumnVisibilityMenu={false} />
      </div>
    )
    expect(screen.getByText('الاسم')).toBeInTheDocument()
    expect(screen.getByText('أحمد')).toBeInTheDocument()
    expect(screen.getByText('سارة')).toBeInTheDocument()
  })

  it('emits sorting changes', async () => {
    const user = userEvent.setup()
    const onSortingChange = vi.fn()
    render(
      <div dir="rtl">
        <DataTable
          columns={columns}
          data={rows}
          sorting={[]}
          onSortingChange={onSortingChange}
          showColumnVisibilityMenu={false}
        />
      </div>
    )
    await user.click(screen.getByText('الاسم'))
    expect(onSortingChange).toHaveBeenCalled()
  })

  it('supports row selection', async () => {
    const user = userEvent.setup()
    const onRowSelectionChange = vi.fn()
    render(
      <div dir="rtl">
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(r) => r.id}
          enableRowSelection
          rowSelection={{}}
          onRowSelectionChange={onRowSelectionChange}
          showColumnVisibilityMenu={false}
        />
      </div>
    )
    const boxes = screen.getAllByRole('checkbox')
    await user.click(boxes[1]!)
    expect(onRowSelectionChange).toHaveBeenCalled()
  })

  it('shows empty state', () => {
    render(
      <div dir="rtl">
        <DataTable columns={columns} data={[]} empty={<span>فارغ</span>} showColumnVisibilityMenu={false} />
      </div>
    )
    expect(screen.getByText('فارغ')).toBeInTheDocument()
  })

  it('shows loading overlay', () => {
    render(
      <div dir="rtl">
        <DataTable columns={columns} data={rows} loading showColumnVisibilityMenu={false} />
      </div>
    )
    expect(screen.getByLabelText('جاري التحميل')).toBeInTheDocument()
  })

  it('shows skeleton rows and error slot', () => {
    const { rerender } = render(
      <div dir="rtl">
        <DataTable
          columns={columns}
          data={rows}
          loading="skeleton"
          pagination={{ pageIndex: 0, pageSize: 3 }}
          showColumnVisibilityMenu={false}
        />
      </div>
    )
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    rerender(
      <div dir="rtl">
        <DataTable
          columns={columns}
          data={rows}
          error={<span>فشل التحميل</span>}
          showColumnVisibilityMenu={false}
        />
      </div>
    )
    expect(screen.getByText('فشل التحميل')).toBeInTheDocument()
  })

  it('manual mode keeps parent pagination state and still sorts via callbacks', async () => {
    const user = userEvent.setup()
    const onSortingChange = vi.fn()
    const onPaginationChange = vi.fn()
    render(
      <div dir="rtl">
        <DataTable
          columns={columns}
          data={rows}
          manual
          pageCount={4}
          totalItems={40}
          sorting={[]}
          onSortingChange={onSortingChange}
          pagination={{ pageIndex: 0, pageSize: 10 }}
          onPaginationChange={onPaginationChange}
          showColumnVisibilityMenu={false}
        />
      </div>
    )
    expect(screen.getByText('1 / 4')).toBeInTheDocument()
    await user.click(screen.getByText('الاسم'))
    expect(onSortingChange).toHaveBeenCalled()
    await user.click(screen.getByLabelText('التالي'))
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 1, pageSize: 10 })
  })

  it('warns once in DEV when virtualization is enabled', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    render(
      <div dir="rtl">
        <DataTable
          columns={columns}
          data={rows}
          virtualization={{ enabled: true }}
          showColumnVisibilityMenu={false}
        />
      </div>
    )
    if (import.meta.env.DEV) {
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('virtualization.enabled is architecture-ready only')
      )
    }
    warn.mockRestore()
  })
})
