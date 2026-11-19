import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompareImageModal from './CompareImageModal';
import filesService from '../../services/api/filesService';
import axiosClient from '../../config/axios';

jest.mock('../../config/axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../../services/api/filesService', () => ({
  __esModule: true,
  default: {
    getReferenceClasses: jest.fn(),
    getReferenceImagesByClass: jest.fn(),
    getImageName: (filename) => filename.replace(/\.(png|jpg)$/i, ''),
  },
}));

const selectedImage = {
  imageUrl: 'blob:local-preview',
  fileName: 'a.png',
  formattedPattern: 'AC-1 Nuclear Homogeneous',
  confidence: 92,
};

const renderModal = (image = selectedImage) =>
  render(<CompareImageModal isOpen onClose={() => {}} selectedImage={image} />);

describe('CompareImageModal reference gallery', () => {
  beforeEach(() => {
    axiosClient.get.mockReset();
    axiosClient.get.mockResolvedValue({ data: new Blob(['x']) });
  });

  it('shows the empty state when no reference images exist', async () => {
    filesService.getReferenceClasses.mockResolvedValue([]);

    renderModal();

    expect(await screen.findByText('No Reference Images Yet')).toBeInTheDocument();
  });

  it('loads the first reference image through the authenticated client', async () => {
    filesService.getReferenceClasses.mockResolvedValue(['NUCLEAR_HOMOGENEOUS']);
    filesService.getReferenceImagesByClass.mockResolvedValue([
      { filename: 'example-1.png', url: '/files/reference/NUCLEAR_HOMOGENEOUS/example-1.png' },
    ]);

    renderModal();

    await waitFor(() =>
      expect(axiosClient.get).toHaveBeenCalledWith('/files/reference/NUCLEAR_HOMOGENEOUS/example-1.png', {
        responseType: 'blob',
      })
    );
  });

  it('offers a retry when the gallery cannot be loaded', async () => {
    filesService.getReferenceClasses.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce([]);

    renderModal();
    expect(await screen.findByText('Could not load the reference images.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('No Reference Images Yet')).toBeInTheDocument();
  });

  it('opens on the reference class of the image prediction when that class has images', async () => {
    filesService.getReferenceClasses.mockResolvedValue(['NEGATIVE', 'NUCLEAR_SPECKLED']);
    filesService.getReferenceImagesByClass.mockImplementation(async (className) => [
      { filename: `${className}-1.png`, url: `/files/reference/${className}/${className}-1.png` },
    ]);

    renderModal({ ...selectedImage, prediction: 'NUCLEAR_SPECKLED' });

    await waitFor(() =>
      expect(axiosClient.get).toHaveBeenCalledWith('/files/reference/NUCLEAR_SPECKLED/NUCLEAR_SPECKLED-1.png', { responseType: 'blob' })
    );
    expect(axiosClient.get).not.toHaveBeenCalledWith('/files/reference/NEGATIVE/NEGATIVE-1.png', expect.anything());
  });

  it('falls back to the first class when the predicted class has no reference images', async () => {
    filesService.getReferenceClasses.mockResolvedValue(['NEGATIVE', 'NUCLEAR_SPECKLED']);
    filesService.getReferenceImagesByClass.mockImplementation(async (className) => [
      { filename: `${className}-1.png`, url: `/files/reference/${className}/${className}-1.png` },
    ]);

    renderModal({ ...selectedImage, prediction: 'NUCLEAR_CENTROMERE' });

    await waitFor(() =>
      expect(axiosClient.get).toHaveBeenCalledWith('/files/reference/NEGATIVE/NEGATIVE-1.png', { responseType: 'blob' })
    );
  });
});
