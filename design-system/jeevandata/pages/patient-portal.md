# Page Design System: Patient Mobile Portal & Diet Planner (`/patient`)

> **Overrides:** This file overrides `design-system/MASTER.md` for all `/patient` mobile surfaces.

---

## 1. Page Purpose & Layout Structure

A patient-facing mobile application and wellness portal that allows patients to:

1. View daily health & diet goals, calories, and macronutrient targets.
2. Review clinical diet plans prescribed after their AI triage intake.
3. Access contactless kiosk check-in with one tap.
4. Track hydration, vitals, and consultation history with doctor briefs.

### Layout Wireframe (Mobile 375px–430px)

- **Sticky Top Bar**: Greeting ("Hello, Rahul 👋"), Date, Quick Status Pill ("Next checkup: 10:30 AM"), Avatar.
- **Hero Card**: Biometric Check-in & AI Intake Quick Action CTA.
- **Nutrition Summary Bento**:
  - Main Circular Progress Gauge (`<NutritionGaugeRing />`): Daily 1,850 / 2,100 kcal with Carbs (180g), Protein (95g), Fat (45g).
  - Quick Log / Water Widget: 2.4L / 3.0L with quick `+250ml` button.
- **Daily Meal Timeline (`<MealPlanCard />`)**:
  - 🌅 Breakfast: Oats bowl with chia seeds & almonds (320 kcal).
  - ☀️ Lunch: Brown rice with dal, roasted vegetables & curd (580 kcal).
  - ☕ Evening: Green tea + roasted chickpeas (150 kcal).
  - 🌙 Dinner: Multigrain roti + paneer/tofu curry + salad (480 kcal).
- **Recent Doctor & Clinical Intake Briefs**:
  - Summary preview of symptoms, doctor's diagnosis, and diet adjustment notes.
- **Floating Bottom Nav Bar (`<FloatingBottomNav />`)**: Home · Diet · Intake · History.

---

## 2. Token & Component Specifics

| Component      | Token / Class                                                | Behavior                                             |
| :------------- | :----------------------------------------------------------- | :--------------------------------------------------- |
| **Gauge Ring** | `--nutrition-carb`, `--nutrition-protein`, `--nutrition-fat` | Smooth SVG stroke dashoffset animation on mount.     |
| **Meal Card**  | `bg-white/80 dark:bg-gray-900/80 glass-card`                 | Expandable to reveal micro-nutrients & recipe notes. |
| **Bottom Bar** | `fixed bottom-4 inset-x-4 max-w-md mx-auto z-40`             | Floating pill with blur effect and active highlight. |
| **Water Pill** | `bg-sky-100 dark:bg-sky-950/40 text-sky-700`                 | Interactive increment feedback with ripple effect.   |
