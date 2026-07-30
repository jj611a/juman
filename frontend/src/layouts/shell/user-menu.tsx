import * as React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuthStore } from '@/stores/authStore'
import { AboutDialog } from './about-dialog'

export interface UserMenuProps {
  onSignOut?: () => void
}

export function UserMenu({ onSignOut }: UserMenuProps): React.ReactElement {
  const user = useAuthStore((s) => s.session.user)
  const name = user?.full_name || user?.username || 'مستخدم'
  const [aboutOpen, setAboutOpen] = React.useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="gap-2" aria-label="قائمة المستخدم">
            <Avatar className="size-7">
              <AvatarFallback className="text-[10px]">{name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">{name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>الملف الشخصي (قريبًا)</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAboutOpen(true)}>حول جمان</DropdownMenuItem>
          <DropdownMenuItem disabled={!onSignOut} onSelect={() => onSignOut?.()}>
            تسجيل الخروج
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  )
}
