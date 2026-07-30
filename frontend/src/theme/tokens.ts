/**
 * Typed design-token registry for Juman v1.0 (juman-dark).
 * Source of truth for CSS variable names - keep in sync with styles/tokens.css.
 */

export const THEME_ID = 'juman-dark' as const
export type ThemeId = typeof THEME_ID

export const THEME_MODE = 'dark' as const
export type ThemeMode = typeof THEME_MODE

/** CSS custom-property names (without values). Used by docs drift tests. */
export const CSS_VARS = {
  brand: '--brand',
  brandHover: '--brand-hover',
  brandActive: '--brand-active',
  brandSubtle: '--brand-subtle',
  brandBorder: '--brand-border',
  brandForeground: '--brand-foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  background: '--background',
  surface: '--surface',
  card: '--card',
  cardForeground: '--card-foreground',
  panel: '--panel',
  sidebar: '--sidebar',
  header: '--header',
  dialog: '--dialog',
  border: '--border',
  borderSubtle: '--border-subtle',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  muted: '--muted',
  foreground: '--foreground',
  foregroundSecondary: '--foreground-secondary',
  mutedForeground: '--muted-foreground',
  foregroundDisabled: '--foreground-disabled',
  foregroundInverse: '--foreground-inverse',
  success: '--success',
  successForeground: '--success-foreground',
  warning: '--warning',
  warningForeground: '--warning-foreground',
  destructive: '--destructive',
  destructiveForeground: '--destructive-foreground',
  info: '--info',
  infoForeground: '--info-foreground',
  hover: '--hover',
  pressed: '--pressed',
  ring: '--ring',
  selection: '--selection',
  selectionBorder: '--selection-border',
  disabledOpacity: '--disabled-opacity',
  fontSans: '--font-sans',
  textDisplaySize: '--text-display-size',
  textH1Size: '--text-h1-size',
  textH2Size: '--text-h2-size',
  textH3Size: '--text-h3-size',
  textTitleSize: '--text-title-size',
  textSubtitleSize: '--text-subtitle-size',
  textBodySize: '--text-body-size',
  textCaptionSize: '--text-caption-size',
  textLabelSize: '--text-label-size',
  textButtonSize: '--text-button-size',
  space0: '--space-0',
  space1: '--space-1',
  space2: '--space-2',
  space3: '--space-3',
  space4: '--space-4',
  space5: '--space-5',
  space6: '--space-6',
  space8: '--space-8',
  space10: '--space-10',
  space12: '--space-12',
  space16: '--space-16',
  space20: '--space-20',
  space24: '--space-24',
  radius: '--radius',
  radiusSm: '--radius-sm',
  radiusMd: '--radius-md',
  radiusLg: '--radius-lg',
  radiusXl: '--radius-xl',
  shadowSm: '--shadow-sm',
  shadowMd: '--shadow-md',
  shadowLg: '--shadow-lg',
  elevation1: '--elevation-1',
  elevation2: '--elevation-2',
  elevation3: '--elevation-3',
  durationFast: '--duration-fast',
  durationNormal: '--duration-normal',
  durationSlow: '--duration-slow',
  easeStandard: '--ease-standard',
  zDropdown: '--z-dropdown',
  zSticky: '--z-sticky',
  zOverlay: '--z-overlay',
  zModal: '--z-modal',
  zToast: '--z-toast',
  zTooltip: '--z-tooltip'
} as const

export type CssVarKey = keyof typeof CSS_VARS

export const REQUIRED_CSS_VARS: readonly string[] = Object.values(CSS_VARS)

export const TYPOGRAPHY_SCALE = [
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
] as const

export type TypographyScale = (typeof TYPOGRAPHY_SCALE)[number]

export const SPACING_STEPS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24] as const

export const ICON_SIZE_PX = {
  sm: 16,
  md: 20,
  lg: 24
} as const

export type IconSizeToken = keyof typeof ICON_SIZE_PX

export const themeMeta = {
  id: THEME_ID,
  mode: THEME_MODE,
  name: 'Juman Premium Dark'
} as const
