import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow-sm',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground shadow-sm',
        outline: 'text-foreground',
        // Clinic-specific status variants
        success:
          'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
        warning:
          'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        error: 'border-transparent bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        info: 'border-transparent bg-jeevandata-100 text-jeevandata-800 dark:bg-jeevandata-900/30 dark:text-jeevandata-400',
        pending:
          'border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        'outline-success':
          'border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300',
        'outline-warning':
          'border-amber-200 bg-amber-50/60 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
        'outline-info':
          'border-jeevandata-200 bg-jeevandata-50/60 text-jeevandata-700 dark:border-jeevandata-800 dark:bg-jeevandata-950/30 dark:text-jeevandata-300',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0.5 text-[10px]',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

// ─── Clinic Status Badge (convenience) ─────────────────────────

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusVariantMap: Record<string, 'success' | 'warning' | 'error' | 'info' | 'pending'> = {
  ready: 'success',
  completed: 'success',
  matched: 'success',
  verified: 'success',
  active: 'info',
  in_progress: 'info',
  pending: 'pending',
  scheduled: 'pending',
  initiated: 'pending',
  warning: 'warning',
  timeout: 'warning',
  failed: 'error',
  error: 'error',
  cancelled: 'error',
};

function StatusBadge({ status, className }: StatusBadgeProps) {
  const safeStatus = status?.toLowerCase() ?? 'pending';
  const variant = statusVariantMap[safeStatus] ?? 'pending';
  const label = (status ?? '').replace(/_/g, ' ');

  return (
    <Badge variant={variant} className={cn('capitalize', className)}>
      {status === 'verified' || status === 'ready' || status === 'matched' ? (
        <span className="mr-1">✓</span>
      ) : status === 'error' || status === 'failed' ? (
        <span className="mr-1">✕</span>
      ) : null}
      {label}
    </Badge>
  );
}

export { Badge, badgeVariants, StatusBadge };
