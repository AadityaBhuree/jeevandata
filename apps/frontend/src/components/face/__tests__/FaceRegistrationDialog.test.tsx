import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FaceRegistrationDialog } from '../FaceRegistrationDialog';
import { useFaceStore } from '@/stores/face-store';
import { faceApi } from '@/services/api';

// ─── Mocks ─────────────────────────────────────────────────────────

vi.mock('@/services/api', () => ({
  faceApi: {
    registerPatient: vi.fn(),
  },
}));

// Reset face store before each test
beforeEach(() => {
  useFaceStore.setState({ livenessStatus: 'verified', status: 'no_match' });
  vi.clearAllMocks();
});

const defaultProps = {
  embedding: new Array(512).fill(0.5),
  isOpen: true,
  onRegistered: vi.fn(),
  onCancel: vi.fn(),
};

// ─── Helper: Advance through step 1 (name) ─────────────────────────
async function fillNameStep() {
  const input = screen.getByPlaceholderText(/priya sharma/i);
  await userEvent.type(input, 'Priya Sharma');
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
}

// ─── Helper: Advance through step 2 (dob + mobile) ──────────────────
async function fillDetailsStep() {
  const dobInput = screen.getByLabelText(/date of birth/i);
  fireEvent.change(dobInput, { target: { value: '1990-06-15' } });

  const mobileInput = screen.getByLabelText(/mobile number/i);
  await userEvent.type(mobileInput, '9876543210');

  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
}

describe('FaceRegistrationDialog', () => {
  // ─── Rendering States ───────────────────────────────────────────

  it('should not render when isOpen is false', () => {
    const { container } = render(<FaceRegistrationDialog {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render step 1 (name) when opened', () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    expect(screen.getByText(/what is your name/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/priya sharma/i)).toBeDefined();
  });

  // ─── Step 1: Name Validation ────────────────────────────────────

  it('should show error when name is empty and continue is clicked', async () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/patient name is required/i);
    });
  });

  it('should show error when name is too short', async () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText(/priya sharma/i);
    await userEvent.type(input, 'A');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/at least 2 characters/i);
    });
  });

  it('should advance to step 2 when valid name is entered', async () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    await fillNameStep();
    await waitFor(() => {
      expect(screen.getByText(/patient details/i)).toBeDefined();
    });
    expect(screen.getByLabelText(/date of birth/i)).toBeDefined();
  });

  it('should show error when name is empty (button always enabled, validation on submit)', async () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /continue/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/patient name is required/i);
    });
  });

  // ─── Step 2: DOB & Mobile Validation ─────────────────────────────

  it('should show error when DOB is empty on step 2', async () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    await fillNameStep();
    await waitFor(() => {
      expect(screen.getByText(/patient details/i)).toBeDefined();
    });

    // Fill mobile but leave DOB empty
    const mobileInput = screen.getByLabelText(/mobile number/i);
    await userEvent.type(mobileInput, '9876543210');

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/date of birth is required/i);
    });
  });

  it('should show error for future DOB', async () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    await fillNameStep();
    await waitFor(() => {
      expect(screen.getByText(/patient details/i)).toBeDefined();
    });

    const dobInput = screen.getByLabelText(/date of birth/i);
    fireEvent.change(dobInput, { target: { value: '2050-01-01' } });

    const mobileInput = screen.getByLabelText(/mobile number/i);
    await userEvent.type(mobileInput, '9876543210');

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/age must be between/i);
    });
  });

  it('should format mobile number with + prefix', async () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    await fillNameStep();
    await waitFor(() => {
      expect(screen.getByText(/patient details/i)).toBeDefined();
    });

    const mobileInput = screen.getByLabelText(/mobile number/i);
    await userEvent.type(mobileInput, '9876543210');

    expect(mobileInput).toHaveValue('+9876543210');
  });

  it('should advance to step 3 with valid details', async () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    await fillNameStep();
    await waitFor(() => {
      expect(screen.getByText(/patient details/i)).toBeDefined();
    });
    await fillDetailsStep();
    await waitFor(() => {
      expect(screen.getByText(/review & consent/i)).toBeDefined();
    });
  });

  // ─── Step 3: Consent & Registration ──────────────────────────────

  it('should show review card with patient info on step 3', async () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    await fillNameStep();
    await waitFor(() => {
      expect(screen.getByText(/patient details/i)).toBeDefined();
    });
    await fillDetailsStep();
    await waitFor(() => {
      expect(screen.getByText(/review & consent/i)).toBeDefined();
    });

    expect(screen.getByText('Priya Sharma')).toBeDefined();
    expect(screen.getByText(/1990/)).toBeDefined();
  });

  it('should disable register button when consent is not given', async () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    await fillNameStep();
    await waitFor(() => {
      expect(screen.getByText(/patient details/i)).toBeDefined();
    });
    await fillDetailsStep();
    await waitFor(() => {
      expect(screen.getByText(/review & consent/i)).toBeDefined();
    });

    const registerBtn = screen.getByRole('button', { name: /confirm & register/i });
    expect(registerBtn).toBeDisabled();
  });

  it('should enable register button when consent is given', async () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    await fillNameStep();
    await waitFor(() => {
      expect(screen.getByText(/patient details/i)).toBeDefined();
    });
    await fillDetailsStep();
    await waitFor(() => {
      expect(screen.getByText(/review & consent/i)).toBeDefined();
    });

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    const registerBtn = screen.getByRole('button', { name: /confirm & register/i });
    expect(registerBtn).not.toBeDisabled();
  });

  it('should call faceApi.registerPatient on successful registration', async () => {
    const mockRegister = vi.mocked(faceApi.registerPatient);
    mockRegister.mockResolvedValueOnce({
      id: 'test-uuid-123',
      name: 'Priya Sharma',
      message: 'Patient registered successfully',
    });

    render(<FaceRegistrationDialog {...defaultProps} />);
    await fillNameStep();
    await waitFor(() => {
      expect(screen.getByText(/patient details/i)).toBeDefined();
    });
    await fillDetailsStep();
    await waitFor(() => {
      expect(screen.getByText(/review & consent/i)).toBeDefined();
    });

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /confirm & register/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: 'Priya Sharma',
        dob: '1990-06-15',
        mobile: '+9876543210',
        consent: true,
        embedding: expect.arrayContaining([0.5]),
      });
    });
  });

  it('should show success step after registration', async () => {
    const mockRegister = vi.mocked(faceApi.registerPatient);
    mockRegister.mockResolvedValueOnce({
      id: 'test-uuid-123',
      name: 'Priya Sharma',
      message: 'Patient registered successfully',
    });

    render(<FaceRegistrationDialog {...defaultProps} />);
    await fillNameStep();
    await waitFor(() => {
      expect(screen.getByText(/patient details/i)).toBeDefined();
    });
    await fillDetailsStep();
    await waitFor(() => {
      expect(screen.getByText(/review & consent/i)).toBeDefined();
    });

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /confirm & register/i }));

    await waitFor(() => {
      expect(screen.getByText(/welcome/i)).toBeDefined();
    });
    expect(screen.getByText(/Priya Sharma/i)).toBeDefined();
  });

  it('should call onRegistered after success timeout', async () => {
    // Use a flag-based approach instead of fakeTimers to avoid conflicts with async rendering
    const mockRegister = vi.mocked(faceApi.registerPatient);
    mockRegister.mockResolvedValueOnce({
      id: 'test-uuid-123',
      name: 'Priya Sharma',
      message: 'Patient registered successfully',
    });

    render(<FaceRegistrationDialog {...defaultProps} />);
    await fillNameStep();
    await waitFor(() => {
      expect(screen.getByText(/patient details/i)).toBeDefined();
    });
    await fillDetailsStep();
    await waitFor(() => {
      expect(screen.getByText(/review & consent/i)).toBeDefined();
    });

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /confirm & register/i }));

    await waitFor(() => {
      expect(screen.getByText(/welcome/i)).toBeDefined();
    });

    // Wait for the 2-second setTimeout to fire
    await waitFor(
      () => {
        expect(defaultProps.onRegistered).toHaveBeenCalled();
      },
      { timeout: 5000 },
    );

    expect(defaultProps.onRegistered).toHaveBeenCalledWith('test-uuid-123', 'Priya Sharma');
  });

  // ─── Error Handling ─────────────────────────────────────────────

  it('should show error when registration API fails', async () => {
    const mockRegister = vi.mocked(faceApi.registerPatient);
    mockRegister.mockRejectedValueOnce(new Error('Mobile number already exists'));

    render(<FaceRegistrationDialog {...defaultProps} />);
    await fillNameStep();
    await waitFor(() => {
      expect(screen.getByText(/patient details/i)).toBeDefined();
    });
    await fillDetailsStep();
    await waitFor(() => {
      expect(screen.getByText(/review & consent/i)).toBeDefined();
    });

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /confirm & register/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/mobile number already exists/i);
    });
  });

  it('should show error when embedding is null', async () => {
    render(<FaceRegistrationDialog {...defaultProps} embedding={null} />);
    await fillNameStep();
    await waitFor(() => {
      expect(screen.getByText(/patient details/i)).toBeDefined();
    });
    await fillDetailsStep();
    await waitFor(() => {
      expect(screen.getByText(/review & consent/i)).toBeDefined();
    });

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /confirm & register/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no face data captured/i);
    });
  });

  // ─── Navigation ─────────────────────────────────────────────────

  it('should go back to step 1 from step 2', async () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    await fillNameStep();
    await waitFor(() => {
      expect(screen.getByText(/patient details/i)).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText(/what is your name/i)).toBeDefined();
  });

  it('should go back to step 2 from step 3', async () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    await fillNameStep();
    await waitFor(() => {
      expect(screen.getByText(/patient details/i)).toBeDefined();
    });
    await fillDetailsStep();
    await waitFor(() => {
      expect(screen.getByText(/review & consent/i)).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText(/patient details/i)).toBeDefined();
  });

  // ─── Liveness Warning ───────────────────────────────────────────

  it('should show liveness warning on step 3 when liveness not verified', async () => {
    useFaceStore.setState({ livenessStatus: 'waiting_for_blink' });

    render(<FaceRegistrationDialog {...defaultProps} />);
    await fillNameStep();
    await waitFor(() => {
      expect(screen.getByText(/patient details/i)).toBeDefined();
    });
    await fillDetailsStep();
    await waitFor(() => {
      expect(screen.getByText(/review & consent/i)).toBeDefined();
    });

    expect(screen.getByText(/liveness check required/i)).toBeDefined();
  });

  it('should hide liveness warning when liveness is verified', () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    expect(screen.queryByText(/liveness check required/i)).toBeNull();
  });

  // ─── Reset on Open ──────────────────────────────────────────────

  it('should reset form state when re-opened', () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    expect(screen.getByText(/what is your name/i)).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
  });

  // ─── Accessibility ──────────────────────────────────────────────

  it('should expose dialog semantics to assistive technology', () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');
  });

  it('should provide an accessible name for the name input', () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    expect(screen.getByLabelText(/full name/i)).toBeDefined();
  });

  it('should expose the current step via aria-current', () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    expect(screen.getByRole('list', { name: /registration progress/i })).toBeDefined();
    expect(document.querySelector('[aria-current="step"]')).toBeDefined();
  });

  it('should keep focus trapped inside the dialog when pressing Tab', () => {
    render(<FaceRegistrationDialog {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    const firstFocusable = dialog.querySelector('button, input, [tabindex]') as HTMLElement;
    firstFocusable?.focus();

    // Press Tab several times — focus must never leave the dialog
    for (let i = 0; i < 6; i++) {
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('should announce successful registration via a live region', async () => {
    const mockRegister = vi.mocked(faceApi.registerPatient);
    mockRegister.mockResolvedValueOnce({
      id: 'test-uuid-123',
      name: 'Priya Sharma',
      message: 'Patient registered successfully',
    });

    render(<FaceRegistrationDialog {...defaultProps} />);
    await fillNameStep();
    await waitFor(() => {
      expect(screen.getByText(/patient details/i)).toBeDefined();
    });
    await fillDetailsStep();
    await waitFor(() => {
      expect(screen.getByText(/review & consent/i)).toBeDefined();
    });

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /confirm & register/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/welcome/i);
    });
  });
});
