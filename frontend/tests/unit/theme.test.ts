import { describe, expect, it } from 'vitest'
import { useThemeStore } from '@/stores/themeStore'
import { THEME_ID, THEME_MODE, themeMeta } from '@/theme/tokens'

describe('themeStore (immutable juman-dark)', () => {
  it('exposes only the official dark theme', () => {
    const state = useThemeStore.getState()
    expect(state.id).toBe(THEME_ID)
    expect(state.mode).toBe(THEME_MODE)
    expect(state.resolved).toBe('dark')
    expect(state).not.toHaveProperty('setMode')
  })

  it('apply sets data-theme to juman-dark', () => {
    document.documentElement.removeAttribute('data-theme')
    useThemeStore.getState().apply()
    expect(document.documentElement.dataset.theme).toBe('juman-dark')
    expect(useThemeStore.getState().resolved).toBe('dark')
  })

  it('themeMeta matches store identity', () => {
    expect(themeMeta.id).toBe('juman-dark')
    expect(themeMeta.mode).toBe('dark')
  })
})
