import { prisma } from './db';
import { refreshXToken, type XTokens } from './x-oauth';

const DEFAULT_OPERATOR_ID = 'uralsebastian';

function getOperatorId(): string {
  return process.env.X_OPERATOR_ID?.trim() || DEFAULT_OPERATOR_ID;
}

function getOperatorEmail(operatorId: string): string {
  return process.env.X_OPERATOR_EMAIL?.trim() || `${operatorId}@local.invalid`;
}

export async function saveXTokens(tokens: XTokens): Promise<void> {
  const operatorId = getOperatorId();

  await prisma.user.upsert({
    where: { id: operatorId },
    update: {
      xAccessToken: tokens.access_token,
      xRefreshToken: tokens.refresh_token ?? null,
      xTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
    create: {
      id: operatorId,
      email: getOperatorEmail(operatorId),
      xAccessToken: tokens.access_token,
      xRefreshToken: tokens.refresh_token ?? null,
      xTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });
}

export async function getValidAccessToken(): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: getOperatorId() },
  });

  if (!user?.xAccessToken || !user.xRefreshToken) {
    throw new Error('No X tokens found. Please authorize first.');
  }

  // Check if token is still valid (with 5 min buffer)
  if (user.xTokenExpiresAt && user.xTokenExpiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return user.xAccessToken;
  }

  const newTokens = await refreshXToken(user.xRefreshToken);
  await saveXTokens(newTokens);

  return newTokens.access_token;
}