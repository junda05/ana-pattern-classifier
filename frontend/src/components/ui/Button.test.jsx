import { render, screen } from '@testing-library/react';
import Button from './Button';

describe('Button', () => {
  it.each([
    ['primary', 'medium'],
    ['secondary', 'medium'],
    ['secondary', 'table'],
  ])('shows the %s/%s label exactly as written (no CSS capitalization)', (variant, size) => {
    render(<Button variant={variant} size={size}>Save for Later</Button>);

    const button = screen.getByRole('button', { name: 'Save for Later' });
    expect(button.className).not.toMatch(/\bcapitalize\b/);
  });
});
