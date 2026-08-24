'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { TitleSetter } from '@/components/ui/title-setter';
import { NutritionGaugeRing } from '@/components/ui/nutrition-gauge-ring';
import { MealPlanCard } from '@/components/patient/meal-plan-card';
import type { MealItem } from '@/components/patient/meal-plan-card';
import { BentoCard } from '@/components/ui/bento-card';
import { ClinicalTriageBadge } from '@/components/ui/clinical-triage-badge';
import { FloatingBottomNav } from '@/components/layout/floating-bottom-nav';
import { Brand } from '@/components/ui/brand';
import { DarkModeToggle } from '@/components/ui/dark-mode-toggle';
import { LanguageSelector } from '@/components/ui/language-selector';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Camera,
  Activity,
  Heart,
  Droplet,
  Plus,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  ChevronRight,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function PatientPortalPage() {
  const { locale, setLocale } = useLanguage();

  // Water tracking state
  const [waterLiters, setWaterLiters] = useState(2.4);

  // Meal plan data (prescribed according to clinical triage)
  const [meals, setMeals] = useState<MealItem[]>([
    {
      id: 'm1',
      type: 'breakfast',
      title: 'Oatmeal Porridge with Almonds & Berries',
      calories: 380,
      time: '08:30 AM',
      completed: true,
      items: [
        'Rolled oats in low-fat milk',
        'Handful of raw almonds',
        'Fresh blueberries & chia seeds',
      ],
      clinicalNote: 'Low-glycemic breakfast prescribed to stabilize morning blood glucose.',
    },
    {
      id: 'm2',
      type: 'lunch',
      title: 'Steamed Brown Rice with Moong Dal & Spinach',
      calories: 580,
      time: '01:15 PM',
      completed: false,
      items: [
        '1 cup brown basmati rice',
        'Yellow moong dal with turmeric',
        'Stir-fried palak/spinach',
        'Cucumber salad',
      ],
      clinicalNote: 'Rich in dietary fiber and magnesium to assist cardiovascular health.',
    },
    {
      id: 'm3',
      type: 'evening',
      title: 'Green Tea with Roasted Spiced Chickpeas',
      calories: 160,
      time: '05:00 PM',
      completed: false,
      items: ['Organic matcha or green tea (unsweetened)', '40g roasted chickpeas / chana'],
      clinicalNote: 'Antioxidant-dense snack with zero refined sugar.',
    },
    {
      id: 'm4',
      type: 'dinner',
      title: 'Multigrain Roti with Paneer & Sautéed Greens',
      calories: 460,
      time: '08:00 PM',
      completed: false,
      items: [
        '2 Multigrain rotis (millet + wheat)',
        '120g grilled low-fat paneer/tofu',
        'Zucchini and bell pepper stir-fry',
      ],
      clinicalNote: 'Light dinner with easily digestible plant proteins before 8:30 PM.',
    },
  ]);

  const handleToggleMeal = (id: string) => {
    setMeals((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const nextCompleted = !m.completed;
          toast({
            title: nextCompleted ? 'Meal Logged!' : 'Meal Marked Incomplete',
            description: `${m.title} has been updated.`,
          });
          return { ...m, completed: nextCompleted };
        }
        return m;
      }),
    );
  };

  const handleAddWater = () => {
    setWaterLiters((prev) => {
      const next = Math.min(4.0, +(prev + 0.25).toFixed(2));
      toast({
        title: '+250ml Water Added 💧',
        description: `Total today: ${next}L of 3.0L target.`,
      });
      return next;
    });
  };

  return (
    <div className="bg-background bg-radial-mesh min-h-screen pb-24">
      <TitleSetter title="Patient Portal & Diet" />

      {/* Header Bar */}
      <header className="sticky top-0 z-30 border-b border-sky-200/50 bg-white/75 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/75">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Brand />
            <span className="hidden rounded-full bg-sky-100/70 px-2 py-0.5 text-[10px] font-bold text-sky-800 sm:inline-block dark:bg-sky-950/60 dark:text-sky-300">
              Patient Portal
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSelector currentLocale={locale} onLocaleChange={setLocale} compact />
            <DarkModeToggle />
            <Link
              href="/login"
              className="shadow-xs hidden rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Staff Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        {/* Welcome Greeting Strip */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl dark:text-white">
                Namaste, Rahul Sharma 👋
              </h1>
              <ClinicalTriageBadge urgency="ROUTINE" size="sm" showPulse={false} />
            </div>
            <p className="text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400">
              Your personalized health, nutrition, and clinical intake dashboard.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="shadow-xs flex items-center gap-1.5 rounded-2xl border border-sky-200/70 bg-white/90 px-3.5 py-2 dark:border-slate-800 dark:bg-slate-900/90">
              <Calendar className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <div className="text-left">
                <p className="text-[10px] font-semibold uppercase text-slate-400">
                  Next Consultation
                </p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Today, 10:30 AM
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Quick-Action Card: Contactless Face & Voice Check-In */}
        <div className="mb-8 overflow-hidden rounded-3xl border border-sky-200/80 bg-gradient-to-r from-sky-600 via-sky-500 to-emerald-500 p-6 text-white shadow-xl shadow-sky-950/10">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI Biometric Kiosk Ready</span>
              </div>
              <h2 className="text-xl font-extrabold sm:text-2xl">
                Arrived at the clinic? Check in instantly.
              </h2>
              <p className="max-w-xl text-xs text-sky-100 sm:text-sm">
                No paper forms or waiting in line. Step up to verify your face and speak your
                current symptoms directly to Gemini Clinical AI.
              </p>
            </div>

            <Link
              href="/intake"
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-sky-700 shadow-lg transition-all duration-150 hover:bg-sky-50 hover:shadow-xl active:scale-95"
            >
              <Camera className="h-4 w-4" />
              <span>Start Kiosk Intake</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Bento Grid: Nutrition & Vitals Section */}
        <div id="diet" className="grid gap-6 lg:grid-cols-3">
          {/* Column 1: Nutrition & Calorie Ring (Figma Reference) */}
          <div className="lg:col-span-1">
            <NutritionGaugeRing
              currentCalories={1580}
              targetCalories={2100}
              carbs={{
                label: 'Carbs',
                consumed: 165,
                target: 220,
                unit: 'g',
                colorClass: 'bg-amber-500',
                strokeColor: '#F59E0B',
              }}
              protein={{
                label: 'Protein',
                consumed: 82,
                target: 110,
                unit: 'g',
                colorClass: 'bg-sky-600',
                strokeColor: '#0284C7',
              }}
              fat={{
                label: 'Fat',
                consumed: 38,
                target: 55,
                unit: 'g',
                colorClass: 'bg-violet-500',
                strokeColor: '#8B5CF6',
              }}
              waterLiters={waterLiters}
              targetWaterLiters={3.0}
            />

            {/* Quick Water Logger Widget */}
            <div className="shadow-xs mt-4 flex items-center justify-between rounded-2xl border border-sky-100 bg-white/90 p-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Droplet className="h-5 w-5 fill-current" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Hydration Goal
                  </h4>
                  <p className="text-[11px] text-slate-500">{waterLiters}L logged today</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddWater}
                className="shadow-xs flex items-center gap-1 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-sky-500 active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+250 ml</span>
              </button>
            </div>
          </div>

          {/* Column 2 & 3: Daily Prescribed Meal Plan & Clinical Notes */}
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Today&apos;s Prescribed Meal Schedule
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Customized nutrition plan based on your latest clinical intake brief
                </p>
              </div>

              <span className="rounded-full bg-emerald-100/70 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                1 of 4 Completed
              </span>
            </div>

            {/* Meal Items List */}
            <div className="space-y-3">
              {meals.map((meal) => (
                <MealPlanCard key={meal.id} meal={meal} onToggleComplete={handleToggleMeal} />
              ))}
            </div>
          </div>
        </div>

        {/* Section: Clinical Briefs & Health Vitals */}
        <div id="history" className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Clinical Vitals & Consult History
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Data recorded during previous kiosk check-ins and physician reviews
              </p>
            </div>

            <Link
              href="/patient/p-demo-123"
              className="flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400"
            >
              <span>Full Medical Record</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Vitals Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <BentoCard>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-400">
                  Blood Pressure
                </span>
                <Heart className="h-4 w-4 text-rose-500" />
              </div>
              <p className="mt-2 text-lg font-extrabold text-slate-900 sm:text-xl dark:text-white">
                118/78 <span className="text-xs font-normal text-slate-400">mmHg</span>
              </p>
              <span className="mt-1 inline-block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                ✓ Normal Range
              </span>
            </BentoCard>

            <BentoCard>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-400">Heart Rate</span>
                <Activity className="h-4 w-4 text-sky-500" />
              </div>
              <p className="mt-2 text-lg font-extrabold text-slate-900 sm:text-xl dark:text-white">
                72 <span className="text-xs font-normal text-slate-400">bpm</span>
              </p>
              <span className="mt-1 inline-block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                ✓ Resting Ideal
              </span>
            </BentoCard>

            <BentoCard>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-400">Blood Oxygen</span>
                <Droplet className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="mt-2 text-lg font-extrabold text-slate-900 sm:text-xl dark:text-white">
                99 <span className="text-xs font-normal text-slate-400">% SpO2</span>
              </p>
              <span className="mt-1 inline-block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                ✓ Optimal
              </span>
            </BentoCard>

            <BentoCard>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-400">Body Temp</span>
                <Stethoscope className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-2 text-lg font-extrabold text-slate-900 sm:text-xl dark:text-white">
                98.4 <span className="text-xs font-normal text-slate-400">°F</span>
              </p>
              <span className="mt-1 inline-block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                ✓ Afebrile
              </span>
            </BentoCard>
          </div>

          {/* Recent Intake Brief Banner */}
          <div className="shadow-xs mt-4 rounded-2xl border border-sky-100 bg-white/90 p-5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Latest Consultation Summary (Dr. Ananya Sen)
                    </h4>
                    <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                      Verified
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    &quot;Routine follow-up for mild seasonal allergy and dietary counseling. Vitals
                    stable. Advised to maintain hydration &gt;2.5L and continue low-sodium
                    breakfast.&quot;
                  </p>
                </div>
              </div>

              <Link
                href="/patient/p-demo-123"
                className="shrink-0 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
              >
                View Full Brief
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Mobile Bottom Navigation */}
      <FloatingBottomNav />
    </div>
  );
}
