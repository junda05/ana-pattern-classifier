import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InlineError from './InlineError';

describe('InlineError', () => {
  it('announces the message as an alert', () => {
    render(<InlineError message="Could not load results." />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load results.');
  });

  it('offers a retry action when one is given', async () => {
    const onRetry = jest.fn();
    render(<InlineError message="Could not load results." onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('has no retry button without a retry action', () => {
    render(<InlineError message="Could not load results." />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
