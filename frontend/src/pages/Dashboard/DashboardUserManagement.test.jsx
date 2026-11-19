import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardUserManagement from './DashboardUserManagement';
import usersService from '../../services/api/usersService';
import { NotificationProvider } from '../../context/NotificationContext';

jest.mock('../../services/api/usersService', () => ({
  __esModule: true,
  default: {
    listUsers: jest.fn(),
    getUser: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
  },
}));

const listItems = [
  {
    userId: 1,
    username: 'admin',
    fullName: 'Dr. Jane Doe',
    email: 'jane.doe@example.com',
    role: 'ADMIN',
    lastLogin: null,
    isActive: true,
    dateJoined: '2026-01-10T12:00:00.000Z',
  },
  {
    userId: 2,
    username: 'jsmith',
    fullName: 'John Smith',
    email: 'john.smith@example.com',
    role: 'STANDARD',
    lastLogin: null,
    isActive: false,
    dateJoined: '2026-02-10T12:00:00.000Z',
  },
];

const renderPage = () =>
  render(
    <NotificationProvider>
      <DashboardUserManagement />
    </NotificationProvider>
  );

// A table row is named after its cells, so the row that mentions the user is theirs
const rowNamed = (name) => ({ name: (accessibleName) => accessibleName.includes(name) });
const rowFor = (name) => screen.getByRole('row', rowNamed(name));

describe('DashboardUserManagement', () => {
  beforeEach(() => {
    usersService.listUsers.mockResolvedValue({ data: listItems, total: 2, page: 1, limit: 100, totalPages: 1 });
  });

  it('shows each user with the role label and the real active status', async () => {
    renderPage();

    const admin = within(await screen.findByRole('row', rowNamed('Dr. Jane Doe')));
    expect(admin.getByText('Administrator')).toBeInTheDocument();
    expect(admin.getByText('Active')).toBeInTheDocument();

    const standard = within(rowFor('John Smith'));
    expect(standard.getByText('Standard')).toBeInTheDocument();
    expect(standard.getByText('Inactive')).toBeInTheDocument();
  });

  it('filters by role code', async () => {
    renderPage();
    await screen.findByText('Dr. Jane Doe');

    await userEvent.selectOptions(screen.getByLabelText('Filter by Role'), 'STANDARD');

    expect(screen.queryByText('Dr. Jane Doe')).not.toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  it('shows an inline error with a retry when the list cannot be loaded', async () => {
    usersService.listUsers.mockRejectedValueOnce(new Error('Could not load the user list.'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the user list.');
    expect(screen.queryByText('No users found.')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('Dr. Jane Doe')).toBeInTheDocument();
  });

  it('keeps the role code when a user is edited', async () => {
    usersService.getUser.mockResolvedValue({ ...listItems[0], professionalCard: 'LIC-12345' });
    usersService.updateUser.mockResolvedValue({});
    renderPage();
    await screen.findByText('Dr. Jane Doe');

    await userEvent.click(within(rowFor('Dr. Jane Doe')).getByRole('button', { name: 'Edit Dr. Jane Doe' }));
    const dialog = await screen.findByText('Edit User');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText('System Role')).toHaveValue('ADMIN');

    const fullName = screen.getByLabelText(/Full Name/);
    await userEvent.clear(fullName);
    await userEvent.type(fullName, 'Dr. Jane A. Doe');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(usersService.updateUser).toHaveBeenCalledWith(1, { fullName: 'Dr. Jane A. Doe' });
  });

  it('sends the role code when the role changes', async () => {
    usersService.getUser.mockResolvedValue({ ...listItems[1], professionalCard: 'LIC-2' });
    usersService.updateUser.mockResolvedValue({});
    renderPage();
    await screen.findByText('John Smith');

    await userEvent.click(within(rowFor('John Smith')).getByRole('button', { name: 'Edit John Smith' }));
    await screen.findByText('Edit User');
    await userEvent.selectOptions(screen.getByLabelText('System Role'), 'ADMIN');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(usersService.updateUser).toHaveBeenCalledWith(2, { role: 'ADMIN', isActive: true });
  });

  it('asks for confirmation before deactivating a user', async () => {
    usersService.deleteUser.mockResolvedValue();
    renderPage();
    await screen.findByText('Dr. Jane Doe');

    expect(within(rowFor('John Smith')).queryByRole('button', { name: 'Deactivate John Smith' })).not.toBeInTheDocument();
    await userEvent.click(within(rowFor('Dr. Jane Doe')).getByRole('button', { name: 'Deactivate Dr. Jane Doe' }));

    expect(screen.getByText('Deactivate User?')).toBeInTheDocument();
    expect(usersService.deleteUser).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Deactivate User' }));

    expect(usersService.deleteUser).toHaveBeenCalledWith(1);
  });
});
