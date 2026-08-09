import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CameraSelector } from '../CameraSelector';

const defaultProps = {
  currentFacingMode: 'user' as const,
  devices: [
    { deviceId: 'front-cam', label: 'Front Camera', facingMode: 'user' as const },
    { deviceId: 'back-cam', label: 'Back Camera', facingMode: 'environment' as const },
  ],
  isActive: false,
  error: null,
  onToggleCamera: vi.fn().mockResolvedValue(undefined),
  onStartCamera: vi.fn().mockResolvedValue(undefined),
  onStopCamera: vi.fn(),
  isMobile: false,
  isEnumeratingDevices: false,
};

describe('CameraSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render Start Camera button when inactive', () => {
    render(<CameraSelector {...defaultProps} />);
    expect(screen.getByText(/start camera/i)).toBeDefined();
  });

  it('should call onStartCamera when Start button is clicked', () => {
    render(<CameraSelector {...defaultProps} />);
    fireEvent.click(screen.getByText(/start camera/i));
    expect(defaultProps.onStartCamera).toHaveBeenCalledOnce();
  });

  it('should show detecting state during enumeration', () => {
    render(<CameraSelector {...defaultProps} isEnumeratingDevices={true} />);
    expect(screen.getByText(/detecting cameras/i)).toBeDefined();
    expect(screen.getByText(/detecting cameras/i)).toBeDisabled();
  });

  it('should show Stop Camera when active', () => {
    render(<CameraSelector {...defaultProps} isActive={true} />);
    expect(screen.getByText(/stop camera/i)).toBeDefined();
  });

  it('should call onStopCamera when Stop is clicked', () => {
    render(<CameraSelector {...defaultProps} isActive={true} />);
    fireEvent.click(screen.getByText(/stop camera/i));
    expect(defaultProps.onStopCamera).toHaveBeenCalledOnce();
  });

  it('should show toggle button when multiple cameras available', () => {
    render(<CameraSelector {...defaultProps} isActive={true} />);
    expect(screen.getByTitle(/switch/i)).toBeDefined();
  });

  it('should show toggle button when on mobile', () => {
    render(
      <CameraSelector
        {...defaultProps}
        isActive={true}
        devices={[{ deviceId: 'only-cam', label: 'Only Camera', facingMode: 'user' }]}
        isMobile={true}
      />,
    );
    expect(screen.getByTitle(/switch/i)).toBeDefined();
  });

  it('should hide toggle button when no multiple cameras and not mobile', () => {
    render(
      <CameraSelector
        {...defaultProps}
        isActive={true}
        devices={[{ deviceId: 'only-cam', label: 'Only Camera', facingMode: 'user' }]}
        isMobile={false}
      />,
    );
    expect(screen.queryByTitle(/switch/i)).toBeNull();
  });

  it('should call onToggleCamera when toggle is clicked', () => {
    render(<CameraSelector {...defaultProps} isActive={true} />);
    fireEvent.click(screen.getByTitle(/switch/i));
    expect(defaultProps.onToggleCamera).toHaveBeenCalledOnce();
  });

  it('should display front/rear label on toggle button', () => {
    const { rerender } = render(
      <CameraSelector {...defaultProps} isActive={true} currentFacingMode="user" />,
    );
    expect(screen.getByText(/rear/i)).toBeDefined();

    rerender(<CameraSelector {...defaultProps} isActive={true} currentFacingMode="environment" />);
    expect(screen.getByText(/front/i)).toBeDefined();
  });

  it('should show camera count when active', () => {
    render(<CameraSelector {...defaultProps} isActive={true} />);
    expect(screen.getByText(/2 cameras/)).toBeDefined();
  });

  it('should show error message when error is set', () => {
    render(<CameraSelector {...defaultProps} error="Camera permission denied" />);
    expect(screen.getByText(/camera permission denied/i)).toBeDefined();
  });

  // ─── Accessibility ─────────────────────────────────────────────

  it('should render camera errors as alerts for screen readers', () => {
    render(<CameraSelector {...defaultProps} error="Camera permission denied" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/camera permission denied/i);
  });

  it('should expose an accessible name on the camera toggle button', () => {
    render(<CameraSelector {...defaultProps} isActive={true} />);
    expect(screen.getByRole('button', { name: /switch to rear camera/i })).toBeDefined();
  });

  it('should expose accessible names on the start and stop buttons', () => {
    const { rerender } = render(<CameraSelector {...defaultProps} />);
    expect(screen.getByRole('button', { name: /start camera/i })).toBeDefined();

    rerender(<CameraSelector {...defaultProps} isActive={true} />);
    expect(screen.getByRole('button', { name: /stop camera/i })).toBeDefined();
  });
});
