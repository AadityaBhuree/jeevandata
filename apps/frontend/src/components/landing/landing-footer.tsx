import Link from 'next/link';
import { HeartPulse, ShieldCheck, Lock, Activity } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="border-t border-slate-200/60 bg-white/70 py-12 backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-950/70">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-8 border-b border-slate-100 pb-8 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800/80">
          <div className="space-y-3 sm:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="from-jeevandata-500 to-jeevandata-700 shadow-xs flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br text-white">
                <HeartPulse className="h-4 w-4" />
              </div>
              <span className="text-base font-bold text-slate-900 dark:text-white">
                Jeevandata Health
              </span>
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Smart clinical intake system powered by on-device biometric landmark detection and
              conversational medical AI.
            </p>
            <div className="flex items-center gap-3 pt-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> HIPAA Compliant
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3.5 w-3.5 text-teal-500" /> AES-256 Encrypted
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Activity className="h-3.5 w-3.5 text-violet-500" /> 99.9% Uptime
              </span>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Platform
            </h4>
            <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <li>
                <Link
                  href="/"
                  className="transition-colors hover:text-teal-600 dark:hover:text-teal-400"
                >
                  Kiosk Intake
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="transition-colors hover:text-teal-600 dark:hover:text-teal-400"
                >
                  Doctor Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/queue"
                  className="transition-colors hover:text-teal-600 dark:hover:text-teal-400"
                >
                  Patient Queue
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/health"
                  className="transition-colors hover:text-teal-600 dark:hover:text-teal-400"
                >
                  System Health
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Governance &amp; Privacy
            </h4>
            <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <li>
                <span className="cursor-pointer transition-colors hover:text-teal-600 dark:hover:text-teal-400">
                  Biometric Consent Policy
                </span>
              </li>
              <li>
                <span className="cursor-pointer transition-colors hover:text-teal-600 dark:hover:text-teal-400">
                  Clinical Audit Trail
                </span>
              </li>
              <li>
                <span className="cursor-pointer transition-colors hover:text-teal-600 dark:hover:text-teal-400">
                  EHR &amp; PMS Integration
                </span>
              </li>
              <li>
                <span className="cursor-pointer transition-colors hover:text-teal-600 dark:hover:text-teal-400">
                  Security Architecture
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pt-6 text-[11px] text-slate-400 sm:flex-row dark:text-slate-500">
          <p>© 2026 Jeevandata Smart Clinic AI. All rights reserved.</p>
          <p className="text-center sm:text-right">
            Medical Disclaimer: Jeevandata assists clinical triage and is not a substitute for
            professional medical diagnosis.
          </p>
        </div>
      </div>
    </footer>
  );
}
