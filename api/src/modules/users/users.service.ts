/**
 * Core user management service
 *
 * Main features:
 * - User CRUD (create, read, update, deactivate)
 * - Lookups by username and email
 * - Uniqueness checks on unique fields
 * - Secure password hashing
 * - User soft delete
 * - Filtering by role and active status
 * - Profile data tailored for authentication
 *
 * Lookup methods:
 * - findAll(): lists all users (without password)
 * - findById(): finds by ID, throwing if it does not exist
 * - findByUsername(): finds by username
 * - findByEmail(): finds by email
 * - findUsersByRole(): filters by role
 *
 * Special methods:
 * - getProfile(): profile data for the frontend
 * - updateLastLogin(): updates the last login timestamp
 * - softDelete(): deactivates a user
 *
 * Auth compatibility:
 * - findUserByName(): shape expected by AuthService
 */

import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { toHttpException } from '../../common/errors/http-errors';
import { User } from '../../entities/users/users.entity';
import { UserRole } from '../../entities/users/user.types';
import { PasswordService } from '../auth/password.service';
import { TraceabilityService } from '../traceability/traceability.service';
import { EntityType } from '../../entities/traceabilities/traceability.types';
import { CreateUserDto } from '../../DTOs/users/create-user.dto';
import { UpdateUserDto } from '../../DTOs/users/update-user.dto';
import { UserListDto } from '../../DTOs/users/user-list.dto';
import { UserDetailDto } from '../../DTOs/users/user-detail.dto';
import { PaginatedResponseDto } from '../../DTOs/users/pagination-query.dto';

export type UserAuth = {
  userId: number;
  username: string;
  password: string;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject('USER_REPOSITORY')
    private userRepository: Repository<User>,
    private passwordService: PasswordService,
    private traceabilityService: TraceabilityService,
  ) {}

  async findAll(): Promise<User[]> {
    try {
      return await this.userRepository.find({
        select: {
          password: false, // Exclude only the password
        },
      });
    } catch (error) {
      throw toHttpException(error, this.logger, 'Error fetching all users');
    }
  }

  async findAllPaginated(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<UserListDto>> {
    try {
      // Clamp the pagination values
      const currentPage = Math.max(1, page);
      const itemsPerPage = Math.min(Math.max(1, limit), 100); // At most 100 items per page
      const skip = (currentPage - 1) * itemsPerPage;

      // Fetch the page of users and the total count
      const [users, total] = await this.userRepository.findAndCount({
        select: {
          userId: true,
          username: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          dateJoined: true,
          lastLogin: true,
        },
        skip,
        take: itemsPerPage,
        order: {
          dateJoined: 'DESC', // Newest registrations first
        },
      });

      const data: UserListDto[] = users.map((user) => ({
        userId: user.userId,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        dateJoined: user.dateJoined,
        lastLogin: user.lastLogin,
      }));

      return {
        data,
        total,
        page: currentPage,
        limit: itemsPerPage,
        totalPages: Math.ceil(total / itemsPerPage),
      };
    } catch (error) {
      throw toHttpException(
        error,
        this.logger,
        'Error fetching paginated users',
      );
    }
  }

  async findById(id: number): Promise<User> {
    try {
      const user = await this.userRepository.findOne({
        where: { userId: id },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found.`);
      }

      return user;
    } catch (error) {
      throw toHttpException(error, this.logger, 'Error finding user by ID');
    }
  }

  async findByIdDetailed(id: number): Promise<UserDetailDto> {
    try {
      const user = await this.userRepository.findOne({
        where: { userId: id },
        select: {
          userId: true,
          username: true,
          fullName: true,
          email: true,
          professionalCard: true,
          role: true,
          isActive: true,
          dateJoined: true,
          lastLogin: true,
        },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found.`);
      }

      return {
        userId: user.userId,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        professionalCard: user.professionalCard,
        role: user.role,
        isActive: user.isActive,
        dateJoined: user.dateJoined,
        lastLogin: user.lastLogin,
      };
    } catch (error) {
      throw toHttpException(error, this.logger, 'Error finding user by ID');
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    try {
      return await this.userRepository.findOne({
        where: { username },
      });
    } catch (error) {
      throw toHttpException(
        error,
        this.logger,
        'Error finding user by username',
      );
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      return await this.userRepository.findOne({
        where: { email },
      });
    } catch (error) {
      throw toHttpException(error, this.logger, 'Error finding user by email');
    }
  }

  /**
   * Creates a user. createdByUserId is null for system actions (the seed script).
   */
  async create(
    userData: CreateUserDto,
    createdByUserId: number | null,
  ): Promise<UserDetailDto> {
    try {
      // Check if username already exists
      const existingUserByUsername = await this.findByUsername(
        userData.username,
      );
      if (existingUserByUsername) {
        throw new ConflictException(
          'A user with this username already exists.',
        );
      }

      // Check if email already exists
      const existingUserByEmail = await this.findByEmail(userData.email);
      if (existingUserByEmail) {
        throw new ConflictException('A user with this email already exists.');
      }

      // Hash the password before saving
      const hashedPassword = await this.passwordService.hashPassword(
        userData.password,
      );

      const newUser = this.userRepository.create({
        ...userData,
        password: hashedPassword,
        role: userData.role || UserRole.STANDARD,
      });

      const savedUser = await this.userRepository.save(newUser);

      // Record in the audit trail
      await this.traceabilityService.logCreate(
        EntityType.USER,
        savedUser.userId,
        createdByUserId,
        {
          username: savedUser.username,
          fullName: savedUser.fullName,
          email: savedUser.email,
          professionalCard: savedUser.professionalCard,
          role: savedUser.role,
          isActive: savedUser.isActive,
        },
      );

      // Return the DTO without the password
      return {
        userId: savedUser.userId,
        username: savedUser.username,
        fullName: savedUser.fullName,
        email: savedUser.email,
        professionalCard: savedUser.professionalCard,
        role: savedUser.role,
        isActive: savedUser.isActive,
        dateJoined: savedUser.dateJoined,
        lastLogin: savedUser.lastLogin,
      };
    } catch (error) {
      throw toHttpException(error, this.logger, 'Error creating user');
    }
  }

  async update(
    id: number,
    updateData: UpdateUserDto,
    updatedByUserId: number,
  ): Promise<UserDetailDto> {
    try {
      const user = await this.findById(id);

      // Keep the previous values of only the fields being updated
      const previousData: Record<string, unknown> = {};
      const updatedKeys = Object.keys(updateData) as Array<keyof UpdateUserDto>;
      for (const key of updatedKeys) {
        // Only include fields that have a defined value in updateData
        if (updateData[key] !== undefined && key in user) {
          previousData[key] = user[key];
        }
      }

      // If the email is changing, make sure it is not already taken
      if (updateData.email && updateData.email !== user.email) {
        const existingUserByEmail = await this.findByEmail(updateData.email);
        if (existingUserByEmail) {
          throw new ConflictException('A user with this email already exists.');
        }
      }

      // Update only provided fields
      Object.assign(user, updateData);

      const updatedUser = await this.userRepository.save(user);

      // Record in the audit trail (only fields that actually changed are logged)
      await this.traceabilityService.logUpdate(
        EntityType.USER,
        updatedUser.userId,
        updatedByUserId,
        previousData,
        updateData,
      );

      // Return the DTO without the password
      return {
        userId: updatedUser.userId,
        username: updatedUser.username,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        professionalCard: updatedUser.professionalCard,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        dateJoined: updatedUser.dateJoined,
        lastLogin: updatedUser.lastLogin,
      };
    } catch (error) {
      throw toHttpException(error, this.logger, 'Error updating user');
    }
  }

  /**
   * Deactivates a user (soft delete) and audits the status change
   */
  async softDelete(id: number, deletedByUserId: number): Promise<User> {
    try {
      const user = await this.findById(id);
      const previousIsActive = user.isActive;

      user.isActive = false;
      const updatedUser = await this.userRepository.save(user);

      // Only a real status change produces an audit record
      await this.traceabilityService.logUpdate(
        EntityType.USER,
        id,
        deletedByUserId,
        { isActive: previousIsActive },
        { isActive: false },
      );

      return updatedUser;
    } catch (error) {
      throw toHttpException(error, this.logger, 'Error soft deleting user');
    }
  }

  /**
   * Replaces the password hash and records when it changed (tokens issued
   * before `changedAt` stop working). Used only by the password-reset flow,
   * which writes its own audit record, so no UPDATE record is written here.
   * @throws NotFoundException if the user does not exist
   */
  async setPassword(
    id: number,
    hashedPassword: string,
    changedAt: Date,
  ): Promise<void> {
    try {
      const user = await this.userRepository.findOne({ where: { userId: id } });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found.`);
      }
      user.password = hashedPassword;
      user.passwordChangedAt = changedAt;
      await this.userRepository.save(user);
    } catch (error) {
      throw toHttpException(error, this.logger, 'Error changing the password');
    }
  }

  async updateLastLogin(id: number): Promise<void> {
    try {
      // Use save instead of update so TypeORM handles the timezone correctly
      const user = await this.userRepository.findOne({ where: { userId: id } });
      if (user) {
        user.lastLogin = new Date();
        await this.userRepository.save(user);
      }
    } catch (error) {
      throw toHttpException(error, this.logger, 'Error updating last login');
    }
  }

  // Methods for auth service compatibility
  async findUserByName(username: string): Promise<UserAuth | undefined> {
    try {
      const user = await this.userRepository.findOne({
        where: { username },
      });

      if (!user) {
        return undefined;
      }

      return {
        userId: user.userId,
        username: user.username,
        password: user.password,
      };
    } catch (error) {
      throw toHttpException(error, this.logger, 'Error finding user by name');
    }
  }

  async findUsersByRole(role: UserRole): Promise<User[]> {
    try {
      return await this.userRepository.find({
        where: { role },
        select: {
          password: false, // Exclude only the password
        },
      });
    } catch (error) {
      throw toHttpException(error, this.logger, 'Error finding users by role');
    }
  }

  async getProfile(userId: number): Promise<{
    userId: number;
    username: string;
    email: string;
    fullName: string;
    professionalCard: string;
    role: UserRole;
    dateJoined: Date;
    isActive: boolean;
  }> {
    try {
      const user = await this.userRepository.findOne({
        where: { userId },
      });

      if (!user) {
        throw new NotFoundException('User not found.');
      }

      return {
        userId: user.userId,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        professionalCard: user.professionalCard,
        role: user.role,
        dateJoined: user.dateJoined,
        isActive: user.isActive,
      };
    } catch (error) {
      throw toHttpException(error, this.logger, 'Error fetching user profile');
    }
  }
}
