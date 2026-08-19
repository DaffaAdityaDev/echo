===============================================================================
  Guardbase Design System & Design Tokens
===============================================================================
  Module    : Design System
  Service   : Web
  Version   : 1.1.0
  Updated   : 2026-07-25
===============================================================================

🛡️ Guardbase — AI Security & Infrastructure Platform
100% Monospace Technical Blueprint Aesthetic (IBM Plex Mono).

---

📐 1. Filosofi Design System

**100% IBM Plex Mono Identity**
Menggunakan IBM Plex Mono secara eksklusif di seluruh tingkatan tipografi
(Headline, Body, Code, Label, & Buttons). Menciptakan karakter produk
security-first, estetika terminal cybersecurity, serta konsistensi visual
ekstrem.

**Technical Precision & Blueprint Grid**
Menggunakan pola garis grid tipis (1px border), dotted dividers, serta
penanda sudut bertanda crosshair (+) untuk memberikan impresi arsitektur
teknis yang presisi.

**Data-Dense Minimalist**
Tata letak yang bersih, berjarak tepat, tanpa ornamen dekoratif non-
fungsional, memprioritaskan keterbacaan data dan hirarki informasi.

---

🎨 2. Palette & Design Tokens Warna

### A. Primary Blue Scale (Brand & Identity)

| Token Name              | Variable               | Hex       | Usage                                |
|-------------------------|------------------------|-----------|--------------------------------------|
| color.primary.base      | $gb-color-primary      | #2563eb   | Brand primary, CTA main fill         |
| color.primary.hover     | $gb-color-primary-hover| #1d4ed8   | State hover tombol primary           |
| color.primary.bright    | $gb-color-blue-bright  | #3b82f6   | Button top gradient, active states   |
| color.primary.light     | $gb-color-blue-light   | #60a5fa   | Gradient text mid, subtle highlights |
| color.primary.periwinkle| $gb-color-periwinkle   | #93c5fd   | Gradient text end, secondary focus   |

### B. Neutral & Surface Scale

| Token Name              | Variable            | Hex       | Usage                              |
|-------------------------|---------------------|-----------|------------------------------------|
| color.neutral.dark      | $gb-color-dark      | #09090b   | Dark canvas, main headlines        |
| color.neutral.muted     | $gb-color-muted     | #64748b   | Subtitles, body text, labels       |
| color.neutral.border    | $gb-color-border    | #e2e8f0   | Grid line borders, card outlines   |
| color.neutral.bg-light  | $gb-color-bg-light  | #ffffff   | Primary light background canvas    |
| color.neutral.bg-subtle | $gb-color-bg-subtle | #fafafa   | Hover state backgrounds, input fills|

### C. Status & Threat Indicators

| Token Name              | Variable               | Hex       | Usage                              |
|-------------------------|------------------------|-----------|------------------------------------|
| color.status.blocked    | $gb-color-rose-500     | #f43f5e   | Prompt injection, critical alert   |
| color.status.verified   | $gb-color-emerald-500  | #10b981   | Safe prompt verified, online status|
| color.status.parameter  | $gb-color-cyan-400     | #22d3ee   | MCP parameter hijack warning       |

---

🔤 3. Typography System (100% IBM Plex Mono)

Font Family: `'IBM Plex Mono', 'JetBrains Mono', monospace`

### Scale & Tokens

| Token Name             | Size          | Line Ht | Weight | Tracking   | Usage                     |
|------------------------|---------------|---------|--------|------------|---------------------------|
| typography.hero-title  | 76px / 4.75rem| 1.02    | 700    | -0.045em   | Hero Headline utama       |
| typography.section-title| 36px / 2.25rem| 1.12    | 700    | -0.035em   | Section H2 Headlines      |
| typography.heading-sm  | 16px / 1rem   | 1.25    | 700    | -0.020em   | Card Titles, Item Names   |
| typography.body-main   | 14px / 0.875rem| 1.60   | 400    | 0.000em    | Deskripsi, paragraf utama |
| typography.body-sm     | 12px / 0.75rem| 1.50    | 400    | 0.000em    | Item descriptions, logs   |
| typography.eyebrow     | 11px / 0.6875rem| 1.00  | 600    | 0.100em    | Technical Tags (uppercase)|
| typography.button      | 11px / 0.6875rem| 1.00  | 600    | 0.060em    | Action Buttons (uppercase)|

---

📐 4. Spacing, Grid, & Crosshair Metrics

```scss
// Borders & Radii
$gb-border-width: 1px;
$gb-radius-sm: 2px;      // Strict technical square corners
$gb-radius-md: 6px;

// Technical Grid Crosshairs (+)
$gb-crosshair-size: 14px;
$gb-crosshair-color: #94a3b8;
$gb-crosshair-offset: -7px; // Exact intersection alignment on 1px borders
```

### Border Tokens

```scss
$gb-border-solid: 1px solid $gb-color-border;
$gb-border-dotted: 1px dotted #cbd5e1;
```

### Reusable Mixins

```scss
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

## Source References

| File                          | Description                              |
|-------------------------------|------------------------------------------|
| design-system/tokens.md       | SCSS manifest + W3C JSON tokens          |
| design-system/components.md   | UI blueprint component specifications    |
| design-system/tailwind.md     | Tailwind CSS config integration          |

===============================================================================
  © 2026 Echo — All Rights Reserved
===============================================================================
