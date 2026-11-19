import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavigationGuardProvider, useNavigationGuard, useUnsavedChangesGuard } from './NavigationGuardContext';

const Page = ({ unsaved }) => {
  useUnsavedChangesGuard(unsaved);
  return null;
};

const LeaveButton = ({ onLeave }) => {
  const { confirmLeave } = useNavigationGuard();
  return <button type="button" onClick={() => confirmLeave(onLeave)}>Leave page</button>;
};

const fireBeforeUnload = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event;
};

describe('navigation guard', () => {
  it('asks the browser to confirm unloading only while there is unsaved work', () => {
    const view = render(<Page unsaved />);
    expect(fireBeforeUnload().defaultPrevented).toBe(true);

    view.rerender(<Page unsaved={false} />);
    expect(fireBeforeUnload().defaultPrevented).toBe(false);

    view.rerender(<Page unsaved />);
    view.unmount();
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('leaves at once when nothing is unsaved', async () => {
    const user = userEvent.setup();
    const onLeave = jest.fn();
    render(
      <NavigationGuardProvider>
        <Page unsaved={false} />
        <LeaveButton onLeave={onLeave} />
      </NavigationGuardProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Leave page' }));

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks before leaving unsaved work and leaves only when confirmed', async () => {
    const user = userEvent.setup();
    const onLeave = jest.fn();
    render(
      <NavigationGuardProvider>
        <Page unsaved />
        <LeaveButton onLeave={onLeave} />
      </NavigationGuardProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Leave page' }));
    expect(screen.getByRole('dialog', { name: 'Leave Without Saving?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stay' }));
    expect(onLeave).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Leave page' }));
    await user.click(screen.getByRole('button', { name: 'Leave' }));
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('works without a provider (leaves at once)', async () => {
    const user = userEvent.setup();
    const onLeave = jest.fn();
    render(<LeaveButton onLeave={onLeave} />);

    await user.click(screen.getByRole('button', { name: 'Leave page' }));

    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
