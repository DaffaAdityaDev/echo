===============================================================================
  UI Blueprint Components
===============================================================================
  Module    : Components
  Service   : Web
  Version   : 1.1.0
  Updated   : 2026-07-25
===============================================================================

🧩 Panduan Komponen Utama

---

### 1. Primary Action Button (.gb-btn-primary)

```
┌──────────────────────────────────────────────┐
│  [→]  DEPLOY GUARD                            │
└──────────────────────────────────────────────┘
```

| Property       | Value                                        |
|----------------|----------------------------------------------|
| Background     | Linear Gradient 180deg: #3b82f6 → #2563eb   |
| Typography     | 11px SemiBold IBM Plex Mono, Uppercase       |
| Letter Spacing | 0.06em                                       |
| Padding        | 10px 20px                                    |
| Border Radius  | 2px ($gb-radius-sm)                          |
| Transition     | all 0.2s cubic-bezier(0.16, 1, 0.3, 1)      |

States:
- **Default**: Gradient bg, white text
- **Hover**: Darker gradient (shift toward #1d4ed8)
- **Active**: Scale press feedback

---

### 2. Bracketed Icon Box (.gb-icon-bracket)

```
┌──────────────────┐
│  [  🔒  ]        │
└──────────────────┘
```

| Property       | Value                              |
|----------------|------------------------------------|
| Dimension      | 36px x 36px                        |
| Border         | 1px solid #e2e8f0                 |
| Border Radius  | 2px ($gb-radius-sm)               |
| Hover Border   | #3b82f6                            |
| Hover BG       | #eff6ff                            |
| Hover Icon     | #2563eb                            |

---

### 3. Numbered Item Row (01–04)

```
 01  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
     │  Title Text (16px Bold)              │
     │  Description (14px Regular)          │
     └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

| Element        | Style                                      |
|----------------|--------------------------------------------|
| Divider        | 1px dotted #cbd5e1                         |
| Number Badge   | 12px IBM Plex Mono SemiBold, Slate 500     |
| Title          | 16px Bold IBM Plex Mono, #09090b           |
| Title Hover    | #2563eb                                    |

---

### 4. Grid Crosshair Wrapper (.crosshair-container)

```
     +───────────────+
     │               │
+    │   Content     │    +
     │               │
     +───────────────+
```

Wrapper relative dengan empat penanda `+` absolute di sudut:

| Position    | Offset                              |
|-------------|-------------------------------------|
| Top-Left    | top: -7px, left: -7px              |
| Top-Right   | top: -7px, right: -7px             |
| Bottom-Left | bottom: -7px, left: -7px           |
| Bottom-Right| bottom: -7px, right: -7px          |

```scss
.crosshair-container {
  position: relative;

  &::before,
  &::after {
    content: '+';
    position: absolute;
    font-family: $gb-font-mono;
    font-size: 14px;
    color: #94a3b8;
    pointer-events: none;
  }

  &::before { top: -7px; left: -7px; }
  &::after  { bottom: -7px; right: -7px; }
}
```

---

### 5. Technical Grid Background

```css
background-image:
  linear-gradient(rgba(100,116,139,0.15) 1px, transparent 1px),
  linear-gradient(90deg, rgba(100,116,139,0.15) 1px, transparent 1px);
background-size: 40px 40px;
```

===============================================================================
  © 2026 Echo — All Rights Reserved
===============================================================================
