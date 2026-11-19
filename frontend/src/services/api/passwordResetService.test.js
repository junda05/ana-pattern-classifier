import axiosClient from '../../config/axios';
import passwordResetService from './passwordResetService';

jest.mock('../../config/axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

describe('passwordResetService.resetPassword', () => {
  it('sends the approval token and never an administrator id', async () => {
    axiosClient.post.mockResolvedValue({ data: { success: true, message: 'Password updated successfully.' } });

    await passwordResetService.resetPassword('reset-token', 'N3w-password', 'approval-token');

    expect(axiosClient.post).toHaveBeenCalledWith('/auth/reset-password', {
      token: 'reset-token',
      newPassword: 'N3w-password',
      approvalToken: 'approval-token',
    });
  });
});
