/**
 * Login form validators
 * More permissive than the user-management rules: they only check presence and length
 */
export const loginValidators = {
  username: (username) => {
    if (!username) return 'Username is required.';
    if (username.length < 2) return 'Username must be at least 2 characters long.';
    if (username.length > 50) return 'Username must be at most 50 characters long.';
    return null;
  },
  password: (password) => {
    if (!password) return 'Password is required.';
    if (password.length < 1) return 'Password cannot be empty.';
    return null; // The password format is not checked at login
  }
};
