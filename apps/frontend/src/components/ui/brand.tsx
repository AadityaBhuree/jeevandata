import Link from 'next/link';
import { HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandProps {
  /** Where the logo links to (defaults to home). Pass null to render without a link. */
  href?: string | null;
  /** Show the wordmark next to the mark (default true). */
  showWordmark?: boolean;
  /** Compact size for headers (default false). */
  compact?: boolean;
  className?: string;
}

/**
 * Single Jeevandata brand mark — used everywhere the old "AC" (AyuTalk Care)
 * logo still lingers. Swap the HeartPulse glyph or wordmark here to rebrand.
 */
export function Brand({ href = '/', showWordmark = true, compact = false, className }: BrandProps) {
  const mark = (
    <span
      className={cn(
        'from-jeevandata-500 to-jeevandata-700 flex items-center justify-center rounded-xl bg-gradient-to-br shadow-sm',
        compact ? 'h-8 w-8' : 'h-9 w-9',
      )}
    >
      <HeartPulse className={cn('text-white', compact ? 'h-4 w-4' : 'h-5 w-5')} />
    </span>
  );

  const wordmark = showWordmark ? (
    <span className="text-sm font-semibold text-slate-900 dark:text-white">Jeevandata</span>
  ) : null;

  const content = (
    <span className="flex items-center gap-2.5">
      {mark}
      {wordmark}
    </span>
  );

  if (href === null) {
    return <span className={cn('inline-flex items-center', className)}>{content}</span>;
  }

  return (
    <Link href={href} className={cn('inline-flex items-center', className)}>
      {content}
    </Link>
  );
}
