import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CSS_VARS,
  REQUIRED_CSS_VARS,
  SPACING_STEPS,
  TYPOGRAPHY_SCALE
} from '@/theme/tokens'

const tokensCss = readFileSync(
  resolve(__dirname, '../../src/styles/tokens.css'),
  'utf8'
)

describe('design tokens registry', () => {
  it('lists every required CSS variable in tokens.css', () => {
    for (const varName of REQUIRED_CSS_VARS) {
      expect(tokensCss, `missing ${varName}`).toContain(`${varName}:`)
    }
  })

  it('defines brand gold and surface hierarchy', () => {
    expect(CSS_VARS.brand).toBe('--brand')
    expect(CSS_VARS.background).toBe('--background')
    expect(CSS_VARS.surface).toBe('--surface')
    expect(CSS_VARS.card).toBe('--card')
    expect(tokensCss).toContain('--brand: #c6a75e')
    expect(tokensCss).toContain('--background: #0a0a0b')
    expect(tokensCss).not.toContain('[data-theme="light"]')
    expect(tokensCss).not.toContain('[data-theme=\'light\']')
  })

  it('includes typography scale and spacing steps', () => {
    expect(TYPOGRAPHY_SCALE).toEqual([
      'display',
      'h1',
      'h2',
      'h3',
      'title',
      'subtitle',
      'body',
      'caption',
      'label',
      'button'
    ])
    for (const step of SPACING_STEPS) {
      expect(tokensCss).toContain(`--space-${step}:`)
    }
  })

  it('includes motion, elevation, and z-index tokens', () => {
    expect(tokensCss).toContain('--duration-fast:')
    expect(tokensCss).toContain('--shadow-md:')
    expect(tokensCss).toContain('--elevation-2:')
    expect(tokensCss).toContain('--z-modal:')
    expect(tokensCss).toContain('--z-toast:')
  })
})
