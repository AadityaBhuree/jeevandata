import { describe, it, expect } from 'vitest';
import {
  cn,
  formatDate,
  formatTime,
  formatDateTime,
  formatDuration,
  API_BASE_URL,
  WS_BASE_URL,
} from '../utils';

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('base', 'extra')).toBe('base extra');
  });

  it('should handle conditional classes with clsx', () => {
    const result = cn('always', false && 'never', true && 'always-too');
    expect(result).toContain('always');
    expect(result).not.toContain('never');
    expect(result).toContain('always-too');
  });

  it('should resolve tailwind conflicts via tailwind-merge', () => {
    // tailwind-merge should pick the last conflicting class
    const result = cn('px-4', 'px-6');
    expect(result).toBe('px-6');
  });

  it('should handle empty inputs', () => {
    expect(cn()).toBe('');
  });

  it('should handle array inputs', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c');
  });

  it('should handle object inputs', () => {
    expect(cn({ active: true, disabled: false })).toBe('active');
  });
});

describe('formatDate', () => {
  it('should format a date string in en-IN format', () => {
    const result = formatDate('2025-07-28');
    // en-IN format: "28 Jul, 2025"
    expect(result).toMatch(/28\s+Jul/);
    expect(result).toContain('2025');
  });

  it('should format a Date object', () => {
    const date = new Date(2025, 0, 15); // Jan 15, 2025
    const result = formatDate(date);
    expect(result).toContain('Jan');
    expect(result).toContain('2025');
  });
});

describe('formatTime', () => {
  it('should format time in 12-hour format', () => {
    // 14:30 → "02:30 PM" (en-IN)
    const date = new Date(2025, 0, 1, 14, 30);
    const result = formatTime(date);
    expect(result).toMatch(/02:30\s*(PM|pm)/i);
  });

  it('should format morning time correctly', () => {
    const date = new Date(2025, 0, 1, 9, 15);
    const result = formatTime(date);
    expect(result).toMatch(/09:15\s*(AM|am)/i);
  });
});

describe('formatDateTime', () => {
  it('should combine date and time', () => {
    const result = formatDateTime('2025-07-28T14:30:00');
    expect(result).toContain('Jul');
    expect(result).toContain('2025');
    expect(result).toMatch(/02:30/i);
  });
});

describe('formatDuration', () => {
  it('should format minutes only', () => {
    expect(formatDuration(45)).toBe('45m');
  });

  it('should format exact hours', () => {
    expect(formatDuration(120)).toBe('2h');
  });

  it('should format hours and minutes', () => {
    expect(formatDuration(150)).toBe('2h 30m');
  });

  it('should format single hour', () => {
    expect(formatDuration(60)).toBe('1h');
  });

  it('should format 0 minutes', () => {
    expect(formatDuration(0)).toBe('0m');
  });
});

describe('API_BASE_URL', () => {
  it('should default to localhost:4000', () => {
    expect(API_BASE_URL).toBe('http://localhost:4000');
  });
});

describe('WS_BASE_URL', () => {
  it('should default to localhost:4000', () => {
    expect(WS_BASE_URL).toBe('http://localhost:4000');
  });
});
