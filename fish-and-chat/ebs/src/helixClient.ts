interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

let cachedToken: CachedToken | null = null;

async function getAppAccessToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAtMs > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });
  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params.toString()}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Helix app token request failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };

  cachedToken = { accessToken: data.access_token, expiresAtMs: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
}

export async function fetchDisplayName(
  userId: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const token = await getAppAccessToken(clientId, clientSecret);
  const res = await fetch(`https://api.twitch.tv/helix/users?id=${encodeURIComponent(userId)}`, {
    headers: { 'Client-Id': clientId, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { data: Array<{ display_name: string }> };
  return data.data[0]?.display_name ?? null;
}
