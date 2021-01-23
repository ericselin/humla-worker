import { encode, RSA } from "https://deno.land/x/god_crypto@v1.4.8/mod.ts";
import { decode, Payload } from "https://deno.land/x/djwt@v2.0/mod.ts";
import { getCookies } from "https://deno.land/std@0.83.0/http/cookie.ts";
import type { JSONWebKey } from "https://deno.land/x/god_crypto@v1.4.8/src/rsa/common.ts";

const getToken = (request: Request): string | undefined => {
  const cookies = getCookies(request);
  return cookies.token;
};

type TokenVerifier = (jwtToken: string) => Promise<Payload>;

const verifySignatureAndDecode = (
  jwks: JSONWebKey[],
): TokenVerifier =>
  async (jwtToken) => {
    const { header, payload } = decode(jwtToken);
    const key = jwks.find((jwk) => jwk.kid === header.kid);
    if (!key) throw new Error(`JWK with id ${header.kid} not found`);

    // from https://stackoverflow.com/questions/62228271/how-to-verify-a-jwt-with-rs256-signature-in-deno
    const publicKey = RSA.parseKey(key);
    const rsa = new RSA(publicKey);
    const [headerb64, payloadb64, signatureb64] = jwtToken.split(".");
    const verified = await rsa.verify(
      encode.base64url(signatureb64),
      headerb64 + "." + payloadb64,
      { algorithm: "rsassa-pkcs1-v1_5", hash: "sha256" },
    );

    if (verified) return payload;

    throw new Error("Token signature invalid");
  };

const verifyIssuer = (payload: Payload): Payload => {
  if (
    payload.iss === "https://accounts.google.com" ||
    payload.iss === "accounts.google.com"
  ) {
    return payload;
  }
  throw new Error(`Could not verify issuer (${payload.iss})`);
};

const verifyAudience = (clientId: string) =>
  (payload: Payload): Payload => {
    if (payload.aud === clientId) {
      return payload
    }
    throw new Error(`Could not verify audience / client id (${payload.aud})`);
  };

const verifyExpiry = (payload: Payload): Payload => {
  // exp claim is in seconds, Date.now() in milliseconds
  if (payload.exp && payload.exp > Date.now() / 1000) {
    return payload;
  }
  throw new Error(`Token has expired (${payload.exp})`);
};

const getUserIdFromPayload = ({ sub }: Payload): string => {
  if (sub) return sub;
  throw new Error("`sub` claim not found in payload");
};

export type UserIdGetter = (request: Request) => Promise<string | undefined>;

export const getUserIdGetter = (jwks: JSONWebKey[], clientId: string): UserIdGetter =>
  async (request) => {
    const token = getToken(request);

    if (!token) return undefined;

    return Promise.resolve(token)
      // steps from https://developers.google.com/identity/protocols/oauth2/openid-connect#validatinganidtoken
      .then(verifySignatureAndDecode(jwks))
      .then(verifyIssuer)
      .then(verifyAudience(clientId))
      .then(verifyExpiry)
      .then(getUserIdFromPayload);
  };
