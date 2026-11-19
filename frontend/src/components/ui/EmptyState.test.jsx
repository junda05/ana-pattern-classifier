import { render, screen } from '@testing-library/react';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('shows the title and description', () => {
    render(<EmptyState title="No Records Found" description="Try adjusting the filters." />);

    expect(screen.getByText('No Records Found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting the filters.')).toBeInTheDocument();
  });

  it('falls back to the plain message when no title or description is given', () => {
    render(<EmptyState message="There are no pending exams." />);

    expect(screen.getByText('There are no pending exams.')).toBeInTheDocument();
  });
});
