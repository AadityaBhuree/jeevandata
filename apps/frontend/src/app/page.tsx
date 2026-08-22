'use client';

import { TitleSetter } from '@/components/ui/title-setter';
import { HeroSection } from '@/components/landing/hero-section';
import { HowItWorks } from '@/components/landing/how-it-works';
import { FeaturesGrid } from '@/components/landing/features-grid';
import { StatsBar } from '@/components/landing/stats-bar';
import { TrustSection } from '@/components/landing/trust-section';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LanguageSelector } from '@/components/ui/language-selector';
import { useLanguage } from '@/hooks/useLanguage';
import Link from 'next/link';

import { Brand } from '@/components/ui/brand';
import { DarkModeToggle } from '@/components/ui/dark-mode-toggle';

export default function HomePage() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="bg-background bg-radial-mesh min-h-screen">
      <TitleSetter title="Welcome" />

      {/* Modern Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/50 bg-white/70 backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Brand />

          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50/60 px-2.5 py-1 text-[11px] font-medium text-emerald-700 sm:inline-flex dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <span>System Ready</span>
            </div>

            <LanguageSelector currentLocale={locale} onLocaleChange={setLocale} compact />
            <DarkModeToggle />

            <Link
              href="/login"
              className="shadow-xs dark:bg-slate-850 inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Staff login
            </Link>
          </div>
        </div>
      </header>

      <HeroSection />
      <HowItWorks />
      <FeaturesGrid />
      <StatsBar />
      <TrustSection />
      <LandingFooter />
    </div>
  );
}
