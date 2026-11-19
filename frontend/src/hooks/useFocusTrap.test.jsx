import React, { useRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFocusTrap } from './useFocusTrap';

const Trap = ({ active = true, onEscape, label = 'Trap', children }) => {
  const ref = useRef(null);
  useFocusTrap(ref, active, onEscape);
  return (
    <div ref={ref} tabIndex={-1} data-testid={label}>
      {children ?? (
        <>
          <button type="button">First</button>
          <button type="button">Middle</button>
          <button type="button">Last</button>
        </>
      )}
    </div>
  );
};

const Opener = ({ onEscape }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <button type="button">Outside</button>
      {open && (
        <Trap
          onEscape={() => {
            onEscape?.();
            setOpen(false);
          }}
        />
      )}
    </>
  );
};

describe('useFocusTrap', () => {
  it('moves focus to the first focusable element when activated', () => {
    render(<Trap />);

    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('prefers the element marked with data-autofocus', () => {
    render(
      <Trap>
        <button type="button">First</button>
        <button type="button" data-autofocus>
          Preferred
        </button>
      </Trap>
    );

    expect(screen.getByRole('button', { name: 'Preferred' })).toHaveFocus();
  });

  it('wraps Tab from the last focusable element to the first', async () => {
    const user = userEvent.setup();
    render(<Trap />);

    screen.getByRole('button', { name: 'Last' }).focus();
    await user.tab();

    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('wraps Shift+Tab from the first focusable element to the last', async () => {
    const user = userEvent.setup();
    render(<Trap />);

    await user.tab({ shift: true });

    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });

  it('calls onEscape once when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onEscape = jest.fn();
    render(<Trap onEscape={onEscape} />);

    await user.keyboard('{Escape}');

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the opener when deactivated', async () => {
    const user = userEvent.setup();
    render(<Opener />);

    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('button', { name: 'First' })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('keeps focus in place when the parent re-renders with a new onEscape callback', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Trap onEscape={() => {}} />);

    screen.getByRole('button', { name: 'Middle' }).focus();
    rerender(<Trap onEscape={() => {}} />);

    expect(screen.getByRole('button', { name: 'Middle' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });

  it('lets only the topmost trap handle Escape when traps are stacked', async () => {
    const user = userEvent.setup();
    const onOuterEscape = jest.fn();
    const onInnerEscape = jest.fn();
    const { rerender } = render(
      <Trap label="outer" onEscape={onOuterEscape}>
        <button type="button">Outer</button>
      </Trap>
    );

    rerender(
      <Trap label="outer" onEscape={onOuterEscape}>
        <button type="button">Outer</button>
        <Trap label="inner" onEscape={onInnerEscape}>
          <button type="button">Inner</button>
        </Trap>
      </Trap>
    );
    expect(screen.getByRole('button', { name: 'Inner' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(onInnerEscape).toHaveBeenCalledTimes(1);
    expect(onOuterEscape).not.toHaveBeenCalled();
  });

  it('pulls focus back inside when Tab is pressed while focus is outside the trap', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Page button</button>
        <Trap />
      </>
    );

    screen.getByRole('button', { name: 'Page button' }).focus();
    await user.tab();

    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });
});
