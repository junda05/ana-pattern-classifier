import { render, screen } from '@testing-library/react';
import Logo from './Logo';
import LoginHeader from '../common/LoginHeader';

describe('Logo', () => {
  it('is an image named after the product by default', () => {
    render(<Logo />);

    expect(screen.getByRole('img', { name: 'ANA Pattern Classifier' })).toBeInTheDocument();
  });

  it('is hidden from assistive technology when decorative', () => {
    render(<Logo decorative data-testid="logo" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    const svg = screen.getByTestId('logo');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
    expect(svg).not.toHaveAttribute('aria-label');
  });

  it('is decorative in the login header, where the product name is already text', () => {
    render(<LoginHeader />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ANA Pattern Classifier' })).toBeInTheDocument();
  });
});
