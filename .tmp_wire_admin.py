from pathlib import Path

nav = Path(r"C:\Users\moham\Desktop\juman\frontend\src\layouts\shell\nav-config.ts")
nt = nav.read_text(encoding="utf-8")
if "id: 'users'" not in nt:
    # add admin section after main section
    insert = """
  ,
  {
    id: 'admin',
    label: 'الإدارة',
    items: [
      {
        id: 'users',
        label: 'المستخدمون',
        href: '/users',
        icon: 'UserCog',
        anyOf: ['users.view', 'users.manage']
      },
      {
        id: 'roles',
        label: 'الأدوار',
        href: '/roles',
        icon: 'Shield',
        anyOf: ['roles.view', 'roles.manage']
      },
      {
        id: 'settings',
        label: 'الإعدادات',
        href: '/settings',
        icon: 'Settings',
        permission: 'settings.view'
      },
      {
        id: 'audit',
        label: 'التدقيق',
        href: '/audit',
        icon: 'ScrollText',
        permission: 'audit.view'
      },
      {
        id: 'system',
        label: 'النظام',
        href: '/system',
        icon: 'Server',
        anyOf: ['system.view', 'system.backup', 'system.restore', 'system.maintenance']
      }
    ]
  }
]
"""
    if not nt.rstrip().endswith("]"):
        raise SystemExit("nav unexpected end")
    # replace final closing of array
    # file ends with:    ]\n  }\n]\n
    old_end = """      {
        id: 'reports',
        label: 'التقارير',
        href: '/reports',
        icon: 'BarChart3',
        anyOf: ['reports.view', 'reports.financial.view']
      }
    ]
  }
]
"""
    new_end = """      {
        id: 'reports',
        label: 'التقارير',
        href: '/reports',
        icon: 'BarChart3',
        anyOf: ['reports.view', 'reports.financial.view']
      }
    ]
  },
  {
    id: 'admin',
    label: 'الإدارة',
    items: [
      {
        id: 'users',
        label: 'المستخدمون',
        href: '/users',
        icon: 'UserCog',
        anyOf: ['users.view', 'users.manage']
      },
      {
        id: 'roles',
        label: 'الأدوار',
        href: '/roles',
        icon: 'Shield',
        anyOf: ['roles.view', 'roles.manage']
      },
      {
        id: 'settings',
        label: 'الإعدادات',
        href: '/settings',
        icon: 'Settings',
        permission: 'settings.view'
      },
      {
        id: 'audit',
        label: 'التدقيق',
        href: '/audit',
        icon: 'ScrollText',
        permission: 'audit.view'
      },
      {
        id: 'system',
        label: 'النظام',
        href: '/system',
        icon: 'Server',
        anyOf: ['system.view', 'system.backup', 'system.restore', 'system.maintenance']
      }
    ]
  }
]
"""
    if old_end not in nt:
        raise SystemExit("nav end missing")
    nav.write_text(nt.replace(old_end, new_end, 1), encoding="utf-8", newline="\n")
    print("nav ok")
else:
    print("nav already")

rt = Path(r"C:\Users\moham\Desktop\juman\frontend\src\app\router.tsx")
rtext = rt.read_text(encoding="utf-8")
if "usersRoutes" not in rtext:
    rtext = rtext.replace(
        "import { reportsRoutes } from '@/features/reports/routes'\n",
        "import { reportsRoutes } from '@/features/reports/routes'\n"
        "import { usersRoutes } from '@/features/users/routes'\n"
        "import { rolesRoutes } from '@/features/roles/routes'\n"
        "import { settingsRoutes } from '@/features/settings/routes'\n"
        "import { auditRoutes } from '@/features/audit/routes'\n"
        "import { systemRoutes } from '@/features/system/routes'\n",
    )
    rtext = rtext.replace(
        "...withPage(reportsRoutes),\n",
        "...withPage(reportsRoutes),\n"
        "          ...withPage(usersRoutes),\n"
        "          ...withPage(rolesRoutes),\n"
        "          ...withPage(settingsRoutes),\n"
        "          ...withPage(auditRoutes),\n"
        "          ...withPage(systemRoutes),\n",
    )
    rt.write_text(rtext, encoding="utf-8", newline="\n")
    print("router ok")
else:
    print("router already")
