import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { NutritionGaugeRing } from '../nutrition-gauge-ring';
import { ClinicalTriageBadge } from '../clinical-triage-badge';
import { BentoCard } from '../bento-card';

describe('NutritionGaugeRing', () => {
  const mockCarbs = {
    label: 'Carbs',
    consumed: 150,
    target: 200,
    unit: 'g',
    colorClass: 'bg-amber-500',
    strokeColor: '#F59E0B',
  };
  const mockProtein = {
    label: 'Protein',
    consumed: 80,
    target: 100,
    unit: 'g',
    colorClass: 'bg-sky-600',
    strokeColor: '#0284C7',
  };
  const mockFat = {
    label: 'Fat',
    consumed: 40,
    target: 50,
    unit: 'g',
    colorClass: 'bg-violet-500',
    strokeColor: '#8B5CF6',
  };

  it('renders calorie target, progress percentage, and macro goals', () => {
    render(
      <NutritionGaugeRing
        currentCalories={1500}
        targetCalories={2000}
        carbs={mockCarbs}
        protein={mockProtein}
        fat={mockFat}
        waterLiters={2.5}
        targetWaterLiters={3.0}
      />,
    );

    expect(screen.getByText('1,500')).toBeInTheDocument();
    expect(screen.getByText('/ 2,000 kcal')).toBeInTheDocument();
    expect(screen.getByText('75% Goal')).toBeInTheDocument();
    expect(screen.getByText('150g')).toBeInTheDocument();
    expect(screen.getByText('80g')).toBeInTheDocument();
    expect(screen.getByText('40g')).toBeInTheDocument();
    expect(screen.getByText('2.5L')).toBeInTheDocument();
  });
});

describe('ClinicalTriageBadge', () => {
  it('renders emergency status correctly', () => {
    render(<ClinicalTriageBadge urgency="EMERGENCY" />);
    expect(screen.getByText('Critical / Red Flag')).toBeInTheDocument();
  });

  it('renders routine status correctly', () => {
    render(<ClinicalTriageBadge urgency="ROUTINE" />);
    expect(screen.getByText('Routine')).toBeInTheDocument();
  });

  it('renders priority review status correctly', () => {
    render(<ClinicalTriageBadge urgency="PRIORITY" />);
    expect(screen.getByText('Priority Review')).toBeInTheDocument();
  });
});

describe('BentoCard', () => {
  it('renders title, subtitle, and children', () => {
    render(
      <BentoCard title="Test Card" subtitle="Test Subtitle">
        <p>Bento Content</p>
      </BentoCard>,
    );

    expect(screen.getByText('Test Card')).toBeInTheDocument();
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
    expect(screen.getByText('Bento Content')).toBeInTheDocument();
  });
});
