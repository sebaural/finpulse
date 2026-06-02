import { prisma } from './db';
import { refreshXToken, type XTokens } from './x-oauth';

const DEFAULT_OPERATOR_EMAIL = 'x-operator@local.invalid';

function getOperatorEmail(): string {
  return process.env.X_OPERATOR_EMAIL?.trim() || DEFAULT_OPERATOR_EMAIL;
}

export async function saveXTokens(tokens: XTokens): Promise<void> {
  const operatorEmail = getOperatorEmail();

  await prisma.user.upsert({
    where: { email: operatorEmail },
    update: {
      xAccessToken: tokens.access_token,
      xRefreshToken: tokens.refresh_token ?? null,
      xTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
    create: {
      email: operatorEmail,
      xAccessToken: tokens.access_token,
      xRefreshToken: tokens.refresh_token ?? null,
      xTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });
}

export async function getValidAccessToken(): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { email: getOperatorEmail() },
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