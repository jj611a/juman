# UI UX Pro Max (Juman)

Use the project skill at `.cursor/skills/ui-ux-pro-max/`.

## Constraint (Juman)

This skill is a **checklist / search layer only**. Do **not** replace Juman design tokens, fonts, or theme:

- Theme: `juman-dark` only
- Font: IBM Plex Sans Arabic
- Gold accent ~2% of UI
- RTL desktop Electron + React
- Components: `@/components/ui/*` only

## Search

```bash
python .cursor/skills/ui-ux-pro-max/scripts/search.py --domain ux "focus empty loading overlay"
python .cursor/skills/ui-ux-pro-max/scripts/search.py --stack react "forms tables dialog accessibility"
```

Map guidance onto existing tokens — never invent parallel primitives or new palettes.
