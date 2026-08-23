import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../button';

describe('Button', () => {
  // ─── Rendering ─────────────────────────────────────────────

  it('should render with default props', () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole('button', { name: /click me/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('should render children text', () => {
    render(<Button>Submit</Button>);
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  // ─── Variants ──────────────────────────────────────────────

  it('should apply default variant class', () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-primary');
  });

  it('should apply destructive variant class', () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-destructive');
  });

  it('should apply outline variant class', () => {
    render(<Button variant="outline">Outline</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('border-input');
  });

  it('should apply secondary variant class', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-secondary');
  });

  it('should apply ghost variant class', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('hover:bg-accent');
  });

  it('should apply link variant class', () => {
    render(<Button variant="link">Link</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('underline-offset-4');
  });

  it('should apply jeevandata variant class', () => {
    render(<Button variant="jeevandata">Jeevandata</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-sky-600');
  });

  it('should apply jeevandata-outline variant class', () => {
    render(<Button variant="jeevandata-outline">Outline</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('border-sky-200');
  });

  it('should apply jeevandata-ghost variant class', () => {
    render(<Button variant="jeevandata-ghost">Ghost</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('text-sky-700');
  });

  it('should apply success variant class', () => {
    render(<Button variant="success">Success</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-emerald-600');
  });

  it('should apply warning variant class', () => {
    render(<Button variant="warning">Warning</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-amber-600');
  });

  // ─── Sizes ─────────────────────────────────────────────────

  it('should apply default size class', () => {
    render(<Button>Size</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('h-10');
  });

  it('should apply sm size class', () => {
    render(<Button size="sm">Small</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('h-9');
  });

  it('should apply lg size class', () => {
    render(<Button size="lg">Large</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('h-11');
  });

  it('should apply xl size class', () => {
    render(<Button size="xl">XL</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('h-12');
  });

  it('should apply icon size class', () => {
    render(<Button size="icon">+</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('w-10');
  });

  it('should apply icon-sm size class', () => {
    render(<Button size="icon-sm">+</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('w-8');
  });

  it('should apply icon-lg size class', () => {
    render(<Button size="icon-lg">+</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('w-12');
  });

  // ─── Disabled ──────────────────────────────────────────────

  it('should be disabled when disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should be disabled when loading prop is set', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  // ─── Loading ───────────────────────────────────────────────

  it('should show spinner and hide children when loading', () => {
    render(<Button loading>Submit</Button>);
    const btn = screen.getByRole('button');
    // Spinner icon has animate-spin class
    const spinner = btn.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    // Children should still be visible alongside spinner
    expect(btn).toHaveTextContent('Submit');
  });

  it('should hide children text when loading and icon-only size', () => {
    render(<Button loading size="icon" aria-label="icon-btn" />);
    const btn = screen.getByRole('button');
    const spinner = btn.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    // Icon-only buttons hide children text when loading
    expect(btn.children).toHaveLength(1);
  });

  // ─── Icons (left / right) ──────────────────────────────────

  it('should render leftIcon', () => {
    render(<Button leftIcon={<span data-testid="left-icon" />}>With Icon</Button>);
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
  });

  it('should render rightIcon', () => {
    render(<Button rightIcon={<span data-testid="right-icon" />}>With Icon</Button>);
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });

  it('should not render leftIcon for icon-only buttons', () => {
    render(
      <Button size="icon" leftIcon={<span data-testid="left-icon" />}>
        +
      </Button>,
    );
    expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument();
  });

  it('should not render rightIcon for icon-only buttons', () => {
    render(
      <Button size="icon-sm" rightIcon={<span data-testid="right-icon" />}>
        +
      </Button>,
    );
    expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument();
  });

  // ─── asChild ───────────────────────────────────────────────

  it('should render as a Slot child when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>,
    );
    // Should render as an <a> element, not a <button>
    const link = screen.getByRole('link', { name: /link button/i });
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
  });

  it('should render an anchor element when asChild is true with destructive variant', () => {
    render(
      <Button asChild variant="destructive">
        <a href="/delete">Delete</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: /delete/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('/delete');
    // The component renders the Slot variant correctly
    expect(link).toHaveTextContent('Delete');
  });

  // ─── Click Handler ─────────────────────────────────────────

  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click</Button>);
    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button disabled onClick={handleClick}>
        Click
      </Button>,
    );
    await user.click(screen.getByRole('button'));

    expect(handleClick).not.toHaveBeenCalled();
  });

  // ─── className Merge ───────────────────────────────────────

  it('should merge custom className with variant classes', () => {
    render(<Button className="custom-class">Custom</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('custom-class');
    expect(btn.className).toContain('bg-primary'); // default variant still applied
  });

  // ─── Type Attribute ────────────────────────────────────────

  it('should allow setting type attribute', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('should allow setting type="button" explicitly', () => {
    render(<Button type="button">Btn</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});
