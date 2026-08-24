# Design System Master File: Jeevandata (Aura Clinical 2.0)

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Jeevandata (Face Detection & Clinical AI Intake System)  
**Reference:** [Figma Community: Nutritionist Healthy Diet - Mobile (1369987639067169288)](https://www.figma.com/community/file/1369987639067169288)  
**Category:** Clinical Health App & Patient Biometric Portal  
**Design Dials:** Variance 7/10 (Modern Balanced) | Motion 6/10 (Subtle & Fluid) | Density 7/10 (Information-Rich)

---

## 1. Global Token Architecture

### 1.1 Three-Layer Architecture

```
Layer 1: Primitive Tokens (Raw Palette)
  --color-sky-50: #F0F9FF;
  --color-sky-100: #E0F2FE;
  --color-sky-500: #0EA5E9;
  --color-sky-600: #0284C7;
  --color-emerald-500: #10B981;
  --color-emerald-600: #16A34A;
  --color-amber-500: #F59E0B;
  --color-rose-500: #EF4444;
  --color-violet-500: #8B5CF6;
  --color-obsidian-950: #0A0F1E;

Layer 2: Semantic Tokens (Role-Based, Theme-Adaptive)
  --color-primary: var(--color-sky-600);
  --color-accent: var(--color-emerald-600);
  --color-surface-bg: var(--color-sky-50);
  --color-surface-card: #FFFFFF;
  --color-emergency: var(--color-rose-500);

Layer 3: Component Tokens
  --card-radius: 1rem;
  --btn-primary-bg: var(--color-primary);
  --gauge-ring-track: rgba(2, 132, 199, 0.12);
  --gauge-ring-fill: var(--color-primary);
```

### 1.2 Theme Color Mapping Table

| Role                       | Light Hex             | Dark Hex (OLED)       | CSS Variable           | Purpose & Contrast                            |
| :------------------------- | :-------------------- | :-------------------- | :--------------------- | :-------------------------------------------- |
| **Primary**                | `#0284C7` (Sky-600)   | `#38BDF8` (Sky-400)   | `--primary`            | Clinical brand, interactive triggers (4.5:1+) |
| **Primary Foreground**     | `#FFFFFF`             | `#0C4A6E`             | `--primary-foreground` | High contrast button/badge text               |
| **Secondary**              | `#E0F2FE` (Sky-100)   | `#1E293B` (Slate-800) | `--secondary`          | Subtle surface chips and toggles              |
| **Accent (Health)**        | `#16A34A` (Green-600) | `#4ADE80` (Green-400) | `--accent`             | Health metrics, verified states, success      |
| **Background**             | `#F0F9FF` (Sky-50)    | `#0A0F1E` (Obsidian)  | `--background`         | Main page canvas background                   |
| **Foreground**             | `#0C4A6E` (Sky-900)   | `#F0F9FF` (Sky-50)    | `--foreground`         | Primary body typography (11.2:1 / 14.5:1)     |
| **Card**                   | `#FFFFFF`             | `#111827` (Gray-900)  | `--card`               | Elevated surface containers                   |
| **Muted**                  | `#E8F2F8`             | `#1E293B`             | `--muted`              | Secondary content background                  |
| **Muted Foreground**       | `#475569` (Slate-600) | `#94A3B8` (Slate-400) | `--muted-foreground`   | Subtitles, timestamp captions (5.4:1)         |
| **Border**                 | `#BAE6FD` (Sky-200)   | `#1E293B`             | `--border`             | Dividers and input contours                   |
| **Destructive / Red-Flag** | `#DC2626`             | `#F87171`             | `--destructive`        | Emergency triage alert, critical risk flags   |
| **Nutrition Carb**         | `#F59E0B` (Amber)     | `#FBBF24`             | `--nutrition-carb`     | Carbohydrates gauge segment                   |
| **Nutrition Protein**      | `#0284C7` (Sky Blue)  | `#38BDF8`             | `--nutrition-protein`  | Protein gauge segment                         |
| **Nutrition Fat**          | `#8B5CF6` (Violet)    | `#A78BFA`             | `--nutrition-fat`      | Healthy fats gauge segment                    |

---

## 2. Typography

- **Heading Font:** `Figtree` / `Atkinson Hyperlegible`
- **Body Font:** `Noto Sans` / `Inter` (with multi-language Devanagari/Latin support)
- **Mood:** Empathetic, accessible, clinical clarity, dyslexia-friendly

```css
@import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Figtree:wght@400;500;600;700;800&family=Noto+Sans:wght@400;500;600;700&display=swap');
```

---

## 3. Component Specifications (Mobile Nutritionist & Clinical Triage)

### 3.1 Nutrition & Health Gauge Ring (`<NutritionGaugeRing />`)

- Multi-segment SVG circular progress ring.
- Displays consumed vs target calories in the center with dynamic macro arcs (Carbs / Protein / Fat).
- Smooth radial gradients with drop shadow glow on active segment.

### 3.2 Meal Plan & Diet Card (`<MealPlanCard />`)

- Pill tag with meal time (Breakfast, Lunch, Dinner, Snack).
- Calorie counter pill (`380 kcal`).
- List of doctor-approved dietary ingredients with glycemic / sodium indicators.
- Expandable recipe or clinical substitution tips.

### 3.3 Voice Visualizer Orb (`<VoiceVisualizerOrb />`)

- Three animation states:
  1. `idle`: Gentle breathing pulse (3s loop).
  2. `listening`: Dynamic multi-bar audio equalizer reacting to microphone decibels.
  3. `processing`: Rotating iridescent gradient ring.

### 3.4 Floating Bottom Navigation (`<FloatingBottomNav />`)

- Glassmorphism backdrop (`backdrop-blur-xl bg-white/80 dark:bg-slate-950/80`).
- Pill active indicator with smooth slide transition.
- Tactile pressed feedback (80-120ms ease-out).

---

## 4. Forbidden Anti-Patterns (Strict Rules)

- ❌ **No Emojis as Structural Icons** — Always use vector icons (`lucide-react`).
- ❌ **No Missing cursor-pointer** — Every interactive button, pill, tab, or card must have `cursor-pointer`.
- ❌ **No Layout-Shifting Hovers** — Use subtle elevation shadow and `translateY(-2px)`, never resizing element dimensions.
- ❌ **No Low-Contrast Text** — Keep primary text $\ge 4.5:1$ and large headings $\ge 3:1$.
- ❌ **No Hardcoded Raw Hex in Components** — Use semantic Tailwind tokens (`bg-primary`, `text-foreground`, `border-border`).

---

## 5. Pre-Delivery Checklist

- [x] Tested with `prefers-reduced-motion`
- [x] Dark mode verified on all custom surfaces
- [x] Touch targets meet 44px $\times$ 44px minimum for mobile
- [x] Zero console warnings or untyped any props
