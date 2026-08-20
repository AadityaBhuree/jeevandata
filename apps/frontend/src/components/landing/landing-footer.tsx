import Link from 'next/link';
import { HeartPulse } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="border-t border-slate-200/60 bg-slate-50/50 py-8 dark:border-slate-800/60 dark:bg-slate-900/20">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <HeartPulse className="text-jeevandata-500 h-4 w-4" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Jeevandata
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            - AI-powered smart clinic intake
          </span>
        </div>
        <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400">
          <Link
            href="#"
            className="hover:text-jeevandata-600 dark:hover:text-jeevandata-400 transition-colors"
          >
            About
          </Link>
          <Link
            href="#"
            className="hover:text-jeevandata-600 dark:hover:text-jeevandata-400 transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="#"
            className="hover:text-jeevandata-600 dark:hover:text-jeevandata-400 transition-colors"
          >
            Contact
          </Link>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          (c) 2026 Jeevandata. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
