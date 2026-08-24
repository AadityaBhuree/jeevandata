import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MealPlanCard } from '../meal-plan-card';
import type { MealItem } from '../meal-plan-card';
import { FloatingBottomNav } from '@/components/layout/floating-bottom-nav';

describe('MealPlanCard', () => {
  const sampleMeal: MealItem = {
    id: 'm1',
    type: 'breakfast',
    title: 'Oats & Berries',
    calories: 350,
    time: '08:00 AM',
    items: ['Rolled oats', 'Almonds', 'Blueberries'],
    clinicalNote: 'Low sodium option.',
    completed: false,
  };

  it('renders meal title, time, and calories', () => {
    render(<MealPlanCard meal={sampleMeal} />);

    expect(screen.getByText('Breakfast')).toBeInTheDocument();
    expect(screen.getByText('Oats & Berries')).toBeInTheDocument();
    expect(screen.getByText('350 kcal')).toBeInTheDocument();
    expect(screen.getByText('08:00 AM')).toBeInTheDocument();
  });

  it('expands meal items and clinical note when toggled', () => {
    render(<MealPlanCard meal={sampleMeal} />);

    const expandBtn = screen.getByLabelText('Toggle meal details');
    fireEvent.click(expandBtn);

    expect(screen.getByText('Rolled oats')).toBeInTheDocument();
    expect(screen.getByText(/Low sodium option/)).toBeInTheDocument();
  });

  it('calls onToggleComplete when completion button clicked', () => {
    const handleToggle = vi.fn();
    render(<MealPlanCard meal={sampleMeal} onToggleComplete={handleToggle} />);

    const toggleBtn = screen.getByLabelText('Mark Oats & Berries complete');
    fireEvent.click(toggleBtn);

    expect(handleToggle).toHaveBeenCalledWith('m1');
  });
});

describe('FloatingBottomNav', () => {
  it('renders mobile navigation links', () => {
    render(<FloatingBottomNav />);

    expect(screen.getByLabelText('Mobile Navigation')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Diet')).toBeInTheDocument();
    expect(screen.getByText('Intake')).toBeInTheDocument();
    expect(screen.getByText('Visits')).toBeInTheDocument();
  });
});
