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

export default function HomePage() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="bg-background min-h-screen">
      <TitleSetter title="Welcome" />
      <div className="relative z-10 mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 pt-4">
        <LanguageSelector currentLocale={locale} onLocaleChange={setLocale} compact />
        <Link
          href="/login"
          className="border-border bg-card/70 text-muted-foreground hover:border-primary/30 hover:text-primary inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-colors"
        >
          Staff login
        </Link>
      </div>
      <HeroSection />
      <HowItWorks />
      <FeaturesGrid />
      <StatsBar />
      <TrustSection />
      <LandingFooter />
    </div>
  );
}
