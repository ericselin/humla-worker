/**
 * Options needed for authenticating with Google
 */
type AuthOptions = {
  redirectUri: string;
  clientId: string;
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

export const _createCsrfToken = async (): Promise<string> => {
  throw new Error("Not implemented");
};

export const _getGoogleAuthRequestUrl = (opts: AuthOptions) =>
  (csrfToken: string): string => {
    throw new Error("Not implemented");
  };

export const redirectToGooleAuth = (opts: AuthOptions) =>
  async (): Promise<Response> =>
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
  event: FetchEvent,
): AuthRedirect => {
  throw new Error("Not implemented");
};

export const _confirmCsrfToken = async (
  authRedirectParams: AuthRedirect,
): Promise<AuthRedirect> => {
  throw new Error("Not implemented");
  return authRedirectParams;
};

export const _getAuthResponse = () =>
  async ({ code }: AuthRedirect): Promise<AuthResponse> => {
    throw new Error("Not implemented");
  };

export const _getRedirectToRootResponse = (
  { token }: AuthResponse,
): Response => {
  throw new Error("Not implemented");
};

export const redirectToRootWithTokenCookie = () =>
  async (event: FetchEvent): Promise<Response> =>
    Promise.resolve(event)
      .then(_getAuthRedirectParams)
      .then(_getAuthResponse())
      .then(_getRedirectToRootResponse);
