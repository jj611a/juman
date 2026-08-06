import { describe, expect, it } from 'vitest'
import { getSystemSubgroup } from '@/features/settings/settingsGroups'

describe('settingsGroups', () => {
  it('maps security media backup prefixes under system', () => {
    expect(getSystemSubgroup('password_min_length')).toBe('security')
    expect(getSystemSubgroup('max_failed_logins')).toBe('security')
    expect(getSystemSubgroup('media_max_upload_mb')).toBe('media')
    expect(getSystemSubgroup('backup.retention_days')).toBe('backup')
    expect(getSystemSubgroup('app_locale')).toBe('other')
  })
})
