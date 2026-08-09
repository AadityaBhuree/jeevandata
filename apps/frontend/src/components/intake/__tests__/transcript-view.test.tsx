import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TranscriptView } from '../transcript-view';

const entries = [
  {
    id: '1',
    speaker: 'ai' as const,
    text: 'Hello, what brings you in today?',
    timestamp: 1700000000000,
  },
  {
    id: '2',
    speaker: 'patient' as const,
    text: 'I have a headache.',
    timestamp: 1700000001000,
  },
  {
    id: '3',
    speaker: 'system' as const,
    text: 'Conversation started',
    timestamp: 1700000002000,
  },
];

describe('TranscriptView — accessibility', () => {
  it('announces new messages via a polite live region', () => {
    render(<TranscriptView entries={entries} onStartIntake={vi.fn()} />);
    expect(document.querySelector('[aria-live="polite"]')).toBeDefined();
  });

  it('hides decorative avatars from screen readers', () => {
    render(<TranscriptView entries={entries} onStartIntake={vi.fn()} />);
    const avatars = document.querySelectorAll('[aria-hidden="true"]');
    expect(avatars.length).toBe(entries.length);
  });

  it('provides speaker context for each message', () => {
    render(<TranscriptView entries={entries} onStartIntake={vi.fn()} />);
    const srOnlyLabels = Array.from(document.querySelectorAll('.sr-only')).map(
      (el) => el.textContent,
    );
    expect(srOnlyLabels).toEqual(expect.arrayContaining(['AI assistant: ', 'You: ', 'System: ']));
  });

  it('renders the message text for screen readers', () => {
    render(<TranscriptView entries={entries} onStartIntake={vi.fn()} />);
    expect(screen.getByText('I have a headache.')).toBeDefined();
  });

  it('shows an accessible start button in the empty state', () => {
    render(<TranscriptView entries={[]} onStartIntake={vi.fn()} />);
    expect(screen.getByRole('button', { name: /start ai intake/i })).toBeDefined();
  });
});
