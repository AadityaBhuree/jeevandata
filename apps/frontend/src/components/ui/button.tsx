'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        // Jeevandata-specific variants
        jeevandata:
          'bg-jeevandata-500 text-white shadow-sm hover:bg-jeevandata-600 active:bg-jeevandata-700',
        'jeevandata-outline':
          'border-2 border-jeevandata-200 text-jeevandata-700 bg-jeevandata-50 hover:bg-jeevandata-100 hover:border-jeevandata-300 active:bg-jeevandata-200',
        'jeevandata-ghost':
          'text-jeevandata-700 hover:bg-jeevandata-50 hover:text-jeevandata-800 active:bg-jeevandata-100',
        success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800',
        'success-outline':
          'border-2 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300',
        warning: 'bg-amber-600 text-white shadow-sm hover:bg-amber-700 active:bg-amber-800',
        'warning-outline':
          'border-2 border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:border-amber-300',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-lg px-8 text-base',
        xl: 'h-12 rounded-lg px-10 text-base',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
        'icon-md': 'h-11 w-11',
        'icon-lg': 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading,
      disabled,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    const isIconOnly = size?.startsWith('icon');

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {!isIconOnly && children}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            {leftIcon && !isIconOnly && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && !isIconOnly && <span className="flex-shrink-0">{rightIcon}</span>}
          </span>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
