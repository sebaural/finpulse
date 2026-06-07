import { getPrisma } from './db';
import { refreshXToken, type XTokens } from './x-oauth';

const DEFAULT_OPERATOR_ID = 'uralsebastian';

function getOperatorId(): string {
  return process.env.X_OPERATOR_ID?.trim() || DEFAULT_OPERATOR_ID;
}

function getOperatorEmail(operatorId: string): string {
  return process.env.X_OPERATOR_EMAIL?.trim() || `${operatorId}@local.invalid`;
}

function getTokenExpiresAt(expiresIn: number): Date {
  return new Date(Date.now() + expiresIn * 1000);
}

export async function saveXTokens(tokens: XTokens): Promise<void> {
  const prisma = getPrisma();
  const operatorId = getOperatorId();
  const existingUser = await prisma.user.findUnique({
    where: { id: operatorId },
    select: { xRefreshToken: true },
  });
  const refreshToken = tokens.refresh_token ?? existingUser?.xRefreshToken ?? null;

  await prisma.user.upsert({
    where: { id: operatorId },
    update: {
      xAccessToken: tokens.access_token,
      xRefreshToken: refreshToken,
      xTokenExpiresAt: getTokenExpiresAt(tokens.expires_in),
    },
    create: {
      id: operatorId,
      email: getOperatorEmail(operatorId),
      xAccessToken: tokens.access_token,
      xRefreshToken: refreshToken,
      xTokenExpiresAt: getTokenExpiresAt(tokens.expires_in),
    },
  });
}

export async function clearXTokens(): Promise<void> {
  const prisma = getPrisma();
  await prisma.user.updateMany({
    where: { id: getOperatorId() },
    data: {
      xAccessToken: null,
      xRefreshToken: null,
      xTokenExpiresAt: null,
    },
  });
}

export async function refreshStoredXToken(): Promise<{ accessToken: string; expiresAt: string }> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: getOperatorId() },
    select: { xRefreshToken: true },
  });

  if (!user?.xRefreshToken) {
    throw new Error('No refresh token found');
  }

  const newTokens = await refreshXToken(user.xRefreshToken);
  await saveXTokens(newTokens);

  return {
    accessToken: newTokens.access_token,
    expiresAt: getTokenExpiresAt(newTokens.expires_in).toISOString(),
  };
}

export async function getValidAccessToken(): Promise<string> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: getOperatorId() },
  });

  if (!user?.xAccessToken || !user.xRefreshToken) {
    throw new Error('No X tokens found. Please authorize first.');
  }

  if (user.xTokenExpiresAt && user.xTokenExpiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return user.xAccessToken;
  }

  const newTokens = await refreshXToken(user.xRefreshToken);
  await saveXTokens(newTokens);

  return newTokens.access_token;
}