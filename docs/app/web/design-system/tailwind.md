===============================================================================
  Tailwind CSS Config Integration
===============================================================================
  Module    : Tailwind Config
  Service   : Web
  Version   : 1.1.0
  Updated   : 2026-07-25
===============================================================================

🛠️ Tailwind CSS Config — Guardbase Tokens

Konfigurasi Tailwind CSS yang selaras dengan Design Tokens Guardbase:

```js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Mono"', '"JetBrains Mono"', 'monospace'],
        display: ['"IBM Plex Mono"', '"JetBrains Mono"', 'monospace'],
        mono: ['"IBM Plex Mono"', '"JetBrains Mono"', 'monospace'],
      },
      colors: {
        gb: {
          blue: '#2563eb',
          brightBlue: '#3b82f6',
          darkBlue: '#1d4ed8',
          lightBlue: '#60a5fa',
          periwinkle: '#93c5fd',
          border: '#e2e8f0',
          dark: '#09090b',
          muted: '#64748b',
          lightBg: '#fafafa',
        }
      },
      letterSpacing: {
        tightest: '-0.045em',
        tight: '-0.035em',
        techMono: '0.06em',
        eyebrow: '0.1em',
      },
      borderRadius: {
        'gb-sm': '2px',
        'gb-md': '6px',
      }
    }
  }
}
```

### Utility Classes Reference

```css
/* Technical grid background */
.bg-grid-tech {
  background-image:
    linear-gradient(rgba(100,116,139,0.15) 1px, transparent 1px),
    linear-gradient(90deg, rgba(100,116,139,0.15) 1px, transparent 1px);
  background-size: 40px 40px;
}

/* Crosshair container */
.crosshair-container {
  position: relative;
}
.crosshair-container::before,
.crosshair-container::after {
  content: '+';
  position: absolute;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 14px;
  color: #94a3b8;
  pointer-events: none;
}
.crosshair-container::before { top: -7px; left: -7px; }
.crosshair-container::after  { bottom: -7px; right: -7px; }
```

### Usage Example

```html
<button class="font-mono text-[11px] font-semibold tracking-techMono uppercase
               px-5 py-2.5 rounded-gb-sm bg-gradient-to-b from-gb-brightBlue
               to-gb-blue text-white transition-all duration-200
               hover:from-gb-darkBlue hover:to-gb-darkBlue">
  [→]  DEPLOY GUARD
</button>
```

===============================================================================
  © 2026 Echo — All Rights Reserved
===============================================================================
