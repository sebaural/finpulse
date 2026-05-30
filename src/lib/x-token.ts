import { prisma } from './db';

const CLIENT_ID = 'Nk1Pb0JoUmpBam8wMkdRV1pBX2k6MTpjaQ';
const CLIENT_SECRET = process.env.X_CLIENT_SECRET!;

export async function getValidAccessToken(): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: 'uralsebastian' },   // ← Changed here
  });

  if (!user?.xAccessToken || !user.xRefreshToken) {
    throw new Error('No X tokens found. Please authorize first.');
  }

  // Check if token is still valid (with 5 min buffer)
  if (user.xTokenExpiresAt && user.xTokenExpiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return user.xAccessToken;
  }

  // Token expired → refresh it
  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const refreshRes = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: user.xRefreshToken,
      client_id: CLIENT_ID,
    }),
  });

  const newTokens = await refreshRes.json();

  if (!refreshRes.ok) {
    throw new Error('Failed to refresh X token');
  }

  // Save new tokens
  await prisma.user.update({
    where: { id: 'uralsebastian' },   // ← Changed here
    data: {
      xAccessToken: newTokens.access_token,
      xRefreshToken: newTokens.refresh_token,
      xTokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
    },
  });

  return newTokens.access_token;
}