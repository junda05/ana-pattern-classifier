import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordField from './PasswordField';
import ModalPasswordField from './ModalPasswordField';

describe.each([
  ['PasswordField', (props) => <PasswordField id="password" label="Password" {...props} />],
  ['ModalPasswordField', (props) => <ModalPasswordField label="Password" {...props} />],
])('%s', (_name, renderField) => {
  it('links the label to the input', () => {
    render(renderField());

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('has a focusable show/hide toggle that reports its pressed state', async () => {
    const user = userEvent.setup();
    render(renderField());

    await user.tab();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    await user.tab();
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.keyboard('{Enter}');

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  });

  it('ties the error message to the input', () => {
    render(renderField({ error: 'Password is required.' }));

    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Password is required.');
  });
});
