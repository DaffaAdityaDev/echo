===============================================================================
  Design Tokens — SCSS & W3C JSON
===============================================================================
  Module    : Design Tokens
  Service   : Web
  Version   : 1.1.0
  Updated   : 2026-07-25
===============================================================================

> **Note:** This document describes the target Guardbase design system as an
> SCSS/W3C JSON token specification. The actual frontend implementation uses
> inline Tailwind classes (e.g., `rounded-[2px]`, `text-[#2563eb]`) rather than
> SCSS variables or `gb-*` custom classes. No `_tokens.scss` or `tokens.json`
> file exists in the codebase. This spec serves as the design reference for
> future token consolidation.

💻 1. SCSS Token Manifest (_tokens.scss)

Dapat langsung di-import ke proyek SASS:

```scss
// ==========================================================================
// GUARDBASE DESIGN SYSTEM — SCSS TOKENS (100% IBM PLEX MONO)
// ==========================================================================

// Color Palette Tokens
$gb-color-primary: #2563eb !default;
$gb-color-primary-hover: #1d4ed8 !default;
$gb-color-blue-bright: #3b82f6 !default;
$gb-color-blue-light: #60a5fa !default;
$gb-color-periwinkle: #93c5fd !default;

$gb-color-dark: #09090b !default;
$gb-color-muted: #64748b !default;
$gb-color-border: #e2e8f0 !default;
$gb-color-bg-light: #ffffff !default;
$gb-color-bg-subtle: #fafafa !default;

// 100% IBM Plex Mono Font Stack
$gb-font-mono: 'IBM Plex Mono', 'JetBrains Mono', monospace !default;
$gb-font-display: $gb-font-mono;
$gb-font-sans: $gb-font-mono;

// Typography Letter Spacing Tokens
$gb-tracking-hero: -0.045em !default;
$gb-tracking-section: -0.035em !default;
$gb-tracking-button: 0.06em !default;
$gb-tracking-eyebrow: 0.10em !default;

// Radii & Borders
$gb-radius-sm: 2px !default;
$gb-radius-md: 6px !default;
$gb-border-solid: 1px solid $gb-color-border !default;
$gb-border-dotted: 1px dotted #cbd5e1 !default;

// Reusable Mixins
@mixin gb-btn-base {
  font-family: $gb-font-mono;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: $gb-tracking-button;
  text-transform: uppercase;
  border-radius: $gb-radius-sm;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@mixin gb-crosshair-marker($top, $left, $right, $bottom) {
  position: absolute;
  font-family: $gb-font-mono;
  font-size: 14px;
  line-height: 1;
  color: $gb-crosshair-color;
  pointer-events: none;
  z-index: 20;
  user-select: none;
  font-weight: 500;
  top: $top;
  left: $left;
  right: $right;
  bottom: $bottom;
}
```

---

📦 2. W3C Standard JSON Design Tokens (tokens.json)

Format token standar untuk Style Dictionary / Figma Tokens / Android / iOS:

```json
{
  "color": {
    "primary": {
      "base": { "value": "#2563eb", "type": "color" },
      "hover": { "value": "#1d4ed8", "type": "color" },
      "bright": { "value": "#3b82f6", "type": "color" },
      "light": { "value": "#60a5fa", "type": "color" },
      "periwinkle": { "value": "#93c5fd", "type": "color" }
    },
    "neutral": {
      "dark": { "value": "#09090b", "type": "color" },
      "muted": { "value": "#64748b", "type": "color" },
      "border": { "value": "#e2e8f0", "type": "color" },
      "bg-light": { "value": "#ffffff", "type": "color" },
      "bg-subtle": { "value": "#fafafa", "type": "color" }
    },
    "status": {
      "blocked": { "value": "#f43f5e", "type": "color" },
      "verified": { "value": "#10b981", "type": "color" },
      "parameter": { "value": "#22d3ee", "type": "color" }
    }
  },
  "font": {
    "family": {
      "mono": { "value": "'IBM Plex Mono', 'JetBrains Mono', monospace", "type": "fontFamily" },
      "display": { "value": "'IBM Plex Mono', 'JetBrains Mono', monospace", "type": "fontFamily" },
      "sans": { "value": "'IBM Plex Mono', 'JetBrains Mono', monospace", "type": "fontFamily" }
    },
    "letterSpacing": {
      "hero": { "value": "-0.045em", "type": "letterSpacing" },
      "section": { "value": "-0.035em", "type": "letterSpacing" },
      "button": { "value": "0.06em", "type": "letterSpacing" },
      "eyebrow": { "value": "0.1em", "type": "letterSpacing" }
    }
  },
  "border": {
    "radius": {
      "sm": { "value": "2px", "type": "borderRadius" },
      "md": { "value": "6px", "type": "borderRadius" }
    }
  }
}
```

===============================================================================
  © 2026 Echo — All Rights Reserved
===============================================================================
