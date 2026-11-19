/**
 * Users controller
 *
 * Handles all CRUD endpoints for user management
 * Base route: /api/v1/users
 *
 * Security:
 * - All endpoints are protected with JWT (PassportJwtAuthGuard)
 * - All endpoints require the ADMIN role (RolesGuard + @Roles)
 *
 * Available endpoints:
 *
 * GET /api/v1/users
 * - Lists users with pagination
 * - Query params: page (default: 1), limit (default: 10)
 * - Returns: PaginatedResponseDto<UserListDto>
 *
 * GET /api/v1/users/:id
 * - Gets a specific user by ID
 * - Returns: UserDetailDto (every field except the password)
 *
 * POST /api/v1/users
 * - Creates a new user
 * - Body: CreateUserDto
 * - Returns: UserDetailDto of the created user
 * - Checks that username and email are unique
 * - Hashes the password automatically
 *
 * PATCH /api/v1/users/:id
 * - Partially updates a user
 * - Body: UpdateUserDto (optional fields)
 * - Returns: UserDetailDto of the updated user
 * - Checks that the email is unique if it changes
 *
 * DELETE /api/v1/users/:id
 * - Deactivates a user (soft delete)
 * - Sets isActive = false
 * - Returns: confirmation message
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from '../../DTOs/users/create-user.dto';
import { UpdateUserDto } from '../../DTOs/users/update-user.dto';
import { UserListDto } from '../../DTOs/users/user-list.dto';
import { UserDetailDto } from '../../DTOs/users/user-detail.dto';
import {
  PaginatedResponseDto,
  PaginationQueryDto,
} from '../../DTOs/users/pagination-query.dto';
import { PassportJwtAuthGuard } from '../auth/guards/passport-jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/users/user.types';
import { USER_ROUTES } from './users.routes';

@Controller(USER_ROUTES.BASE)
@UseGuards(PassportJwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/v1/users
   * Lists users with pagination
   */
  @Get(USER_ROUTES.GET_ALL)
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<UserListDto>> {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 10;

    return await this.usersService.findAllPaginated(page, limit);
  }

  /**
   * GET /api/v1/users/:id
   * Gets a specific user
   */
  @Get(USER_ROUTES.GET_BY_ID)
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<UserDetailDto> {
    return await this.usersService.findByIdDetailed(id);
  }

  /**
   * POST /api/v1/users
   * Creates a new user
   */
  @Post(USER_ROUTES.CREATE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createUserDto: CreateUserDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<UserDetailDto> {
    const currentUserId = req.user.userId;
    return await this.usersService.create(createUserDto, currentUserId);
  }

  /**
   * PATCH /api/v1/users/:id
   * Partially updates a user
   */
  @Patch(USER_ROUTES.UPDATE)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<UserDetailDto> {
    const currentUserId = req.user.userId;
    return await this.usersService.update(id, updateUserDto, currentUserId);
  }

  /**
   * DELETE /api/v1/users/:id
   * Deactivates a user (soft delete)
   */
  @Delete(USER_ROUTES.DELETE)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    const currentUserId = req.user.userId;
    await this.usersService.softDelete(id, currentUserId);
    return {
      message: 'User deactivated successfully.',
    };
  }
}
