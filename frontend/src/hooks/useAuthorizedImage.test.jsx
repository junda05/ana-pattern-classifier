import { render, screen } from '@testing-library/react';
import axiosClient from '../config/axios';
import useAuthorizedImage from './useAuthorizedImage';

jest.mock('../config/axios', () => ({ __esModule: true, default: { get: jest.fn() } }));

const Probe = ({ url }) => {
  const { src, error, loading } = useAuthorizedImage(url);
  return <p>{loading ? 'loading' : error ? 'error' : src}</p>;
};

describe('useAuthorizedImage', () => {
  let created;

  beforeEach(() => {
    created = 0;
    URL.createObjectURL = jest.fn(() => `blob:object-${++created}`);
    URL.revokeObjectURL = jest.fn();
  });

  it('fetches API images (relative or absolute) through the authenticated client as blobs', async () => {
    axiosClient.get.mockResolvedValue({ data: new Blob(['x']) });

    render(<Probe url="/files/reference/NUCLEAR_HOMOGENEOUS/example-1.png" />);

    expect(await screen.findByText('blob:object-1')).toBeInTheDocument();
    expect(axiosClient.get).toHaveBeenCalledWith('/files/reference/NUCLEAR_HOMOGENEOUS/example-1.png', {
      responseType: 'blob',
    });
  });

  it('revokes the object URL when the image changes and on unmount', async () => {
    axiosClient.get.mockResolvedValue({ data: new Blob(['x']) });
    const { rerender, unmount } = render(<Probe url="/files/reference/A/one.png" />);
    await screen.findByText('blob:object-1');

    rerender(<Probe url="/files/reference/A/two.png" />);
    await screen.findByText('blob:object-2');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:object-1');

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:object-2');
  });

  it('uses local object URLs as they are, without a request', () => {
    render(<Probe url="blob:local-preview" />);

    expect(screen.getByText('blob:local-preview')).toBeInTheDocument();
    expect(axiosClient.get).not.toHaveBeenCalled();
  });

  it('reports a failed download', async () => {
    axiosClient.get.mockRejectedValue(new Error('Request failed with status code 401'));

    render(<Probe url="/files/reference/A/one.png" />);

    expect(await screen.findByText('error')).toBeInTheDocument();
  });
});
