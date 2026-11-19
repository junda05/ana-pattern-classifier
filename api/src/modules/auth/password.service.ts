/**
 * Secure password handling
 *
 * Responsibilities:
 * - Hashes passwords with bcrypt
 * - Validates passwords during login
 * - Generates a fresh salt for every password
 *
 * Main methods:
 * - hashPassword(): hashes a plain-text password
 * - validatePassword(): compares a plain-text password with a hash; without
 *   a stored hash (unknown user) it still runs one comparison against a
 *   dummy hash of the same cost and returns false, so response times do not
 *   reveal whether a username exists
 *
 * Security settings:
 * - Algorithm: bcrypt
 * - Salt rounds: bcrypt default
 * - Plain-text passwords are never stored
 *
 * Typical usage:
 * - Creating users: hash the password before saving
 * - Login: validate the entered password against the stored hash
 * - Password change: hash the new password
 */

import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class PasswordService {
  /** Hash of a random secret with the same cost as real hashes (created on first use). */
  private dummyHash?: Promise<string>;

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt();
    return bcrypt.hash(password, salt);
  }

  /**
   * Compares a password with a stored hash. A missing hash (unknown user)
   * never matches, but costs one bcrypt comparison like a wrong password.
   */
  async validatePassword(
    password: string,
    hashedPassword: string | null | undefined,
  ): Promise<boolean> {
    if (!hashedPassword) {
      await bcrypt.compare(password, await this.getDummyHash());
      return false;
    }
    return bcrypt.compare(password, hashedPassword);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hashPassword(randomBytes(32).toString('hex'));
    return this.dummyHash;
  }
}
