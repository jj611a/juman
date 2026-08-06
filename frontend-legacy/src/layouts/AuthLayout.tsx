import * as React from 'react'
import { Outlet } from 'react-router'
import { cn } from '@/utils/cn'

/** Chrome-less auth surface — no sidebar/topbar. */
export function AuthLayout({ className }: { className?: string }): React.ReactElement {
  return (
    <div
      className={cn(
        'flex min-h-screen items-center justify-center bg-background px-4 py-10',
        className
      )}
      dir="rtl"
    >
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  )
}
