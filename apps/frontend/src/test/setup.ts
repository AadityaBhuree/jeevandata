import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// ─── ResizeObserver ─────────────────────────────────────────────
// jsdom doesn't implement ResizeObserver. Required by Radix UI.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

// ─── Next.js Router Mock ────────────────────────────────────────
// Vitest replaces next/navigation with this mock for all tests.

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// ─── matchMedia ─────────────────────────────────────────────────
// jsdom doesn't implement matchMedia. Required by Radix UI.

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// ─── IntersectionObserver ───────────────────────────────────────
// jsdom doesn't implement IntersectionObserver.

class IntersectionObserverStub {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: IntersectionObserverStub,
});

// ─── PointerEvent ───────────────────────────────────────────────
// jsdom needs a PointerEvent constructor for Radix UI pointer interactions.

if (!window.PointerEvent) {
  class PointerEventStub extends Event {
    readonly pointerType: string = 'mouse';
    readonly pointerId: number = 0;
    readonly clientX: number = 0;
    readonly clientY: number = 0;
    readonly button: number = 0;
    readonly buttons: number = 1;
    readonly isPrimary: boolean = true;

    constructor(type: string, init?: PointerEventInit) {
      super(type, init);
      this.pointerType = init?.pointerType ?? 'mouse';
      this.pointerId = init?.pointerId ?? 0;
      this.clientX = init?.clientX ?? 0;
      this.clientY = init?.clientY ?? 0;
      this.button = init?.button ?? 0;
      this.buttons = init?.buttons ?? 1;
      this.isPrimary = init?.isPrimary ?? true;
    }
  }

  Object.defineProperty(window, 'PointerEvent', {
    writable: true,
    value: PointerEventStub,
  });
}

// ─── TextEncoder/TextDecoder (for mediapipe compatibility) ──────
// Already present in jsdom, but ensure they exist.

if (typeof TextEncoder === 'undefined') {
  Object.defineProperty(globalThis, 'TextEncoder', {
    value: class TextEncoder {
      encode(input: string = ''): Uint8Array {
        return new Uint8Array(Buffer.from(input, 'utf-8'));
      }
    },
  });
}
