import "https://raw.githubusercontent.com/ericselin/worker-types/v1.0.0/cloudflare-worker-types.ts";

import { uuid } from "./deps.ts";

/**
 * Options needed for authenticating with Google
 */
export type AuthOptions = {
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
};

/**
 * Parameters passed in the query string when the user
 * is redirected back to us as part of the oauth flow
 */
type AuthRedirect = {
  code: string;
  csrfToken: string;
};

/**
 * Parameters returned when exchanging code to access
 * token and id token (etc.)
 */
type AuthResponse = {
  token: string;
};

declare const ACTIONS: KVNamespace;

export const _createCsrfToken = async (): Promise<string> => {
  const token = uuid.v4.generate();
  await ACTIONS.put(`token-${token}`, "csrf token", { expirationTtl: 300 });
  return token;
};

export const _confirmCsrfToken = async (
  authRedirectParams: AuthRedirect,
): Promise<AuthRedirect> => {
  const token = await ACTIONS.get(`token-${authRedirectParams.csrfToken}`);
  if (!token) throw new Error("CSRF Token not found");
  return authRedirectParams;
};

export const _getGoogleAuthRequestUrl = (
  { clientId, redirectUri, authorizationEndpoint }: AuthOptions,
) =>
  (csrfToken: string): string => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: "openid email",
      redirect_uri: redirectUri,
      state: csrfToken,
    });
    return `${authorizationEndpoint}?${params.toString()}`;
  };

export const redirectToGooleAuth = (opts: AuthOptions) =>
  (): Promise<Response> =>
    Promise.resolve()
      .then(_createCsrfToken)
      .then(_getGoogleAuthRequestUrl(opts))
      .then((url) =>
        new Response(undefined, {
          status: 302,
          headers: {
            "Location": url,
          },
        })
      );

export const _getAuthRedirectParams = (
  url: string,
): AuthRedirect => {
  const urlObj = new URL(url);
  const code = urlObj.searchParams.get("code");
  const csrfToken = urlObj.searchParams.get("state");
  if (!code || !csrfToken) {
    throw new Error("Malformed url from redirect request");
  }
  return {
    code,
    csrfToken,
  };
};

/**
 * Exchange `code` for access token and ID token
 * by requesting the oauth token endpoint
 */
export const _getAuthResponse = (
  { clientId, clientSecret, redirectUri, tokenEndpoint }: AuthOptions,
) =>
  async ({ code }: AuthRedirect): Promise<AuthResponse> => {
    const params = {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    };
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error(`Could not exchange code for client id`);
    const { id_token } = await response.json();
    if (!id_token) throw new Error(`Could not get id_token from auth response`);
    return {
      token: id_token,
    };
  };

export const _getRedirectToRootResponse = (
  { token }: AuthResponse,
): Response =>
  new Response(undefined, {
    status: 302,
    headers: {
      "Location": "/",
      "Set-Cookie": `token=${token}; Same-Site=Lax; Path=/; Max-Age=2592000`, // 30 days in seconds
    },
  });

export const redirectToRootWithTokenCookie = (opts: AuthOptions) =>
  (event: FetchEvent): Promise<Response> =>
    Promise.resolve(event.request.url)
      .then(_getAuthRedirectParams)
      .then(_getAuthResponse(opts))
      .then(_getRedirectToRootResponse);
