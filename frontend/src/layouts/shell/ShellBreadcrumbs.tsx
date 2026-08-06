import { Link, useLocation } from 'react-router'
import { breadcrumbForPath } from '@/navigation/nav.config'

export function ShellBreadcrumbs() {
  const { pathname } = useLocation()
  const crumbs = breadcrumbForPath(pathname)
  return (
    <div className="breadcrumbs text-sm">
      <ul>
        {crumbs.map((c, i) => (
          <li key={`${c.label}-${i}`}>
            {c.to && i < crumbs.length - 1 ? (
              <Link to={c.to}>{c.label}</Link>
            ) : (
              <span className="text-base-content/80">{c.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
