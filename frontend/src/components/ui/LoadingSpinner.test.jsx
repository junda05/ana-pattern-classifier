import { render, screen } from '@testing-library/react';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('is announced as a status with visually hidden text', () => {
    render(<LoadingSpinner />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading…');
    expect(screen.getByText('Loading…')).toHaveClass('sr-only');
  });

  it('announces a custom label', () => {
    render(<LoadingSpinner type="circle" label="Loading users…" />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading users…');
  });

  it('can be purely decorative when the caller already shows the text', () => {
    render(
      <div data-testid="host">
        <LoadingSpinner type="circle" label={null} />
      </div>
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    // All that is left is the spinning visual, hidden from assistive technology
    expect(screen.getByTestId('host').innerHTML).toMatch(/^<span aria-hidden="true"[^>]*><\/span>$/);
  });
});
