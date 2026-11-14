import {
  ROLES,
  type LoginInput,
  type RegisterInput,
  type RoleName,
  type UserDTO,
} from '@datascope/shared';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { datasets, roles, userPreferences, users } from '../../db/schema/index.js';
import { AppError } from '../../middleware/error.middleware.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt.js';
import { findUserDtoById } from '../users/users.service.js';

export interface AuthSessionResult {
  user: UserDTO;
  accessToken: string;
  refreshToken: string;
}

function issueTokensForUser(user: UserDTO): {
  accessToken: string;
  refreshToken: string;
} {
  const claims = {
    sub: user.id,
    email: user.email,
    role: user.role,
    roleId: user.roleId,
  };
  return {
    accessToken: signAccessToken(claims),
    refreshToken: signRefreshToken(claims),
  };
}

export async function register(input: RegisterInput): Promise<AuthSessionResult> {
  const email = input.email.trim().toLowerCase();
  const requestedRole: RoleName = input.role ?? ROLES.ANALYST;

  if (requestedRole === ROLES.ADMIN) {
    throw new AppError(
      403,
      'FORBIDDEN_ROLE',
      'Self-registration as Administrator is not permitted'
    );
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    throw new AppError(
      409,
      'EMAIL_ALREADY_EXISTS',
      'An account with this email address already exists'
    );
  }

  const roleRows = await db
    .select({ id: roles.id, name: roles.name })
    .from(roles)
    .where(eq(roles.name, requestedRole))
    .limit(1);

  const roleRow = roleRows[0];
  if (!roleRow) {
    throw new AppError(500, 'ROLE_NOT_FOUND', `Role '${requestedRole}' is not configured`);
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const defaultDatasetRows = await db
    .select({ id: datasets.id })
    .from(datasets)
    .limit(1);
  const defaultDatasetId = defaultDatasetRows[0]?.id ?? null;

  const createdUserId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        fullName: input.fullName.trim(),
        roleId: roleRow.id,
        isActive: true,
        lastLoginAt: new Date(),
      })
      .returning({ id: users.id });

    await tx.insert(userPreferences).values({
      userId: created!.id,
      theme: 'dark',
      defaultPageSize: 50,
      tableDensity: 'compact',
      defaultDatasetId,
      columnConfigs: {},
    });

    return created!.id;
  });

  const user = await findUserDtoById(createdUserId, true);
  if (!user) {
    throw new AppError(500, 'USER_CREATION_FAILED', 'Failed to load created user');
  }

  const { accessToken, refreshToken } = issueTokensForUser(user);
  return { user, accessToken, refreshToken };
}

export async function login(input: LoginInput): Promise<AuthSessionResult> {
  const email = input.email.trim().toLowerCase();

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const account = rows[0];
  if (!account) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (!account.isActive) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'Your account has been deactivated');
  }

  const isPasswordValid = await bcrypt.compare(input.password, account.passwordHash);
  if (!isPasswordValid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, account.id));

  const user = await findUserDtoById(account.id, true);
  if (!user) {
    throw new AppError(500, 'AUTH_LOAD_FAILED', 'Failed to load authenticated user');
  }

  const { accessToken, refreshToken } = issueTokensForUser(user);
  return { user, accessToken, refreshToken };
}

export async function refreshSession(
  rawRefreshToken: string | undefined
): Promise<AuthSessionResult> {
  if (!rawRefreshToken || rawRefreshToken.trim().length === 0) {
    throw new AppError(401, 'UNAUTHORIZED', 'Refresh token is required');
  }

  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken.trim());
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired refresh token');
  }

  const user = await findUserDtoById(payload.sub, true);
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'User account no longer exists');
  }

  if (!user.isActive) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'User account has been deactivated');
  }

  const { accessToken, refreshToken } = issueTokensForUser(user);
  return { user, accessToken, refreshToken };
}
