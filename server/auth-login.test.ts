import {
  _getAuthRedirectParams,
  _getGoogleAuthRequestUrl,
} from "./auth-login.ts";
import { assertEquals } from "https://deno.land/std@0.81.0/testing/asserts.ts";

Deno.test("google auth request url works (no nonce)", () => {
  const url = _getGoogleAuthRequestUrl(
    {
      clientId: "424911365001.apps.googleusercontent.com",
      redirectUri: "https://oauth2.example.com/code",
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      clientSecret: "",
      tokenEndpoint: "",
    },
  )("csrf_token");
  assertEquals(
    url,
    "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=424911365001.apps.googleusercontent.com&scope=openid+email&redirect_uri=https%3A%2F%2Foauth2.example.com%2Fcode&state=csrf_token",
  );
});

Deno.test("auth redirect params getter", () => {
  const params = _getAuthRedirectParams(
    "https://oauth2.example.com/code?state=csrf_token&code=4/P7q7W91a-oMsCeLvIaQm6bTrgtp7&scope=openid%20email%20https://www.googleapis.com/auth/userinfo.email",
  );
  assertEquals(params.csrfToken, "csrf_token");
  assertEquals(params.code, "4/P7q7W91a-oMsCeLvIaQm6bTrgtp7");
});
