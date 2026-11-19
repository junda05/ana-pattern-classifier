import { act, render, waitFor } from '@testing-library/react';
import axiosClient from '../../config/axios';
import InteractiveImageCanvas from './InteractiveImageCanvas';

jest.mock('../../config/axios', () => ({ __esModule: true, default: { get: jest.fn() } }));

describe('InteractiveImageCanvas', () => {
  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => 'blob:object-1');
    URL.revokeObjectURL = jest.fn();
    axiosClient.get.mockResolvedValue({ data: new Blob(['x']) });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('loads a reference image through the authenticated client', async () => {
    render(<InteractiveImageCanvas imageUrl="/files/reference/NUCLEAR/example-1.png" alt="Reference" />);

    await waitFor(() =>
      expect(axiosClient.get).toHaveBeenCalledWith('/files/reference/NUCLEAR/example-1.png', { responseType: 'blob' })
    );
  });

  it('removes exactly the contextmenu listener it added', async () => {
    jest.useFakeTimers();
    const added = jest.spyOn(HTMLCanvasElement.prototype, 'addEventListener');
    const removed = jest.spyOn(HTMLCanvasElement.prototype, 'removeEventListener');

    const view = render(<InteractiveImageCanvas imageUrl="blob:local-preview" alt="Preview" />);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    view.unmount();

    const addedHandlers = added.mock.calls.filter(([type]) => type === 'contextmenu').map(([, handler]) => handler);
    const removedHandlers = removed.mock.calls.filter(([type]) => type === 'contextmenu').map(([, handler]) => handler);
    expect(addedHandlers.length).toBeGreaterThan(0);
    addedHandlers.forEach((handler) => expect(removedHandlers).toContain(handler));
  });
});
