import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VerifyResultsModal from './VerifyResultsModal';
import axiosClient from '../../config/axios';

jest.mock('../../config/axios', () => ({ __esModule: true, default: { get: jest.fn() } }));

const newResult = {
  id: 'img-1',
  fileName: 'a.png',
  predictionKey: 'NUCLEAR_HOMOGENEOUS',
  confidence: 91.5,
  imageUrl: 'blob:preview-1',
};

const existingPrediction = {
  predictionId: 501,
  prediction: 'NEGATIVE',
  confidencePercentage: 97,
  imagePath: 'abc-1700000000-saved1.png',
  imageUrl: 'http://api/files/predictions/abc-1700000000-saved1.png',
};

const renderModal = (props = {}) => {
  const handlers = { onClose: jest.fn(), onConfirm: jest.fn(), onCorrect: jest.fn() };
  render(
    <VerifyResultsModal
      isOpen
      results={[newResult]}
      existingPredictions={[existingPrediction]}
      {...handlers}
      {...props}
    />
  );
  return { ...handlers, ...props };
};

describe('VerifyResultsModal', () => {
  beforeEach(() => {
    axiosClient.get.mockResolvedValue({ data: new Blob(['x']) });
  });

  it("does not offer the model's own class as a correction", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Correct' }));

    const newSelect = screen.getByLabelText('Corrected classification for a.png');
    expect(within(newSelect).getByRole('option', { name: 'AC-1 Nuclear Homogeneous' })).toBeDisabled();
    expect(within(newSelect).getByRole('option', { name: /Negative/ })).toBeEnabled();

    const existingSelect = screen.getByLabelText('Corrected classification for saved1.png');
    expect(within(existingSelect).getByRole('option', { name: /Negative/ })).toBeDisabled();
    expect(within(existingSelect).getByRole('option', { name: 'AC-1 Nuclear Homogeneous' })).toBeEnabled();
  });

  it('passes the correction notes separately from the corrections', async () => {
    const user = userEvent.setup();
    const { onCorrect } = renderModal({ onCorrect: jest.fn().mockResolvedValue(true) });

    await user.click(screen.getByRole('button', { name: 'Correct' }));
    await user.selectOptions(screen.getByLabelText('Corrected classification for a.png'), 'NUCLEAR_SPECKLED');
    await user.type(screen.getByLabelText('Correction Notes'), 'Speckles visible at 1:160.');
    await user.click(screen.getByRole('button', { name: 'Save Corrections' }));

    await waitFor(() => expect(onCorrect).toHaveBeenCalledWith({
      newCorrections: { 'img-1': 'NUCLEAR_SPECKLED' },
      existingCorrections: {},
      observations: 'Speckles visible at 1:160.',
    }));
  });

  it('needs at least one correction: notes alone have nothing to be saved with', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Correct' }));
    await user.type(screen.getByLabelText('Correction Notes'), 'Looks fine.');

    expect(screen.getByRole('button', { name: 'Save Corrections' })).toBeDisabled();
  });

  it('starts over when the page closes and reopens it', async () => {
    const user = userEvent.setup();
    const handlers = { onClose: jest.fn(), onConfirm: jest.fn(), onCorrect: jest.fn() };
    const view = render(<VerifyResultsModal isOpen results={[newResult]} {...handlers} />);

    await user.click(screen.getByRole('button', { name: 'Correct' }));
    view.rerender(<VerifyResultsModal isOpen={false} results={[newResult]} {...handlers} />);
    view.rerender(<VerifyResultsModal isOpen results={[newResult]} {...handlers} />);

    expect(screen.getByText('Confirm Classification?')).toBeInTheDocument();
  });

  it('cannot be closed while the confirmation is being saved', async () => {
    let finish;
    const user = userEvent.setup();
    const { onClose } = renderModal({ onConfirm: jest.fn(() => new Promise((resolve) => { finish = resolve; })) });

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await user.keyboard('{Escape}');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Correct' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();

    finish(false);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close dialog' })).toBeEnabled());
  });

  it('cannot be closed while the corrections are being saved', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal({ onCorrect: jest.fn(() => new Promise(() => {})) });

    await user.click(screen.getByRole('button', { name: 'Correct' }));
    await user.selectOptions(screen.getByLabelText('Corrected classification for a.png'), 'NUCLEAR_SPECKLED');
    await user.click(screen.getByRole('button', { name: 'Save Corrections' }));
    await user.keyboard('{Escape}');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
