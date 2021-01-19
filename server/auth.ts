import { encode, RSA } from "https://deno.land/x/god_crypto@v1.4.8/mod.ts";
import { decode } from "https://deno.land/x/djwt@v2.0/mod.ts";
import { getCookies } from "https://deno.land/std@0.83.0/http/cookie.ts";

type UserIdGetter = (request: Request) => Promise<string | undefined>;

const getGoogleAuthKey = async () => ({
  "kid": "783ec031c59e11f257d0ec15714ef607ce6a2a6f",
  "n":
    "8Yb9hQAJroV6VKCsZZ6ylhVJqo0gsFa0Ca8ytzanKKWsCjo6RaqLjej7QKniTKwhUheCvbfLUqY9Mc6iMbA3gI-6_2lLQbbxExt6WUpf-CAEv1oUcnH_jA6X5Bdu4TdUX29s3D8J95d0eR8z8J1pe-7CjTBClx7lZd5xSRcoDXHDhzkwvc-EehYV46FsJyZCthLpAXvj81gpfycveavNFBMj-nlHKopZvhMcwbsK5JZ37wn2SxFigpfmIojheFVShJsNmLErHVC9HoHTC0iMibsKdyo7mk5QNM_rdBK-KjJhlQr8l7CktAqUJIQzkW8qC7tV7Hl0xicp6ylWZ-pj-Q",
  "alg": "RS256",
  "e": "AQAB",
  "kty": "RSA",
  "use": "sig",
});

export const getUserId: UserIdGetter = async (request) => {
  const cookies = getCookies(request);
  const key = await getGoogleAuthKey();
  const jwt = cookies.token;
  try {
    // from https://stackoverflow.com/questions/62228271/how-to-verify-a-jwt-with-rs256-signature-in-deno
    const publicKey = RSA.parseKey(key);
    const rsa = new RSA(publicKey);
    const [headerb64, payloadb64, signatureb64] = jwt.split(".");
    // verify the signature based on the given public key
    const verified = await rsa.verify(
      encode.base64url(signatureb64),
      headerb64 + "." + payloadb64,
      { algorithm: "rsassa-pkcs1-v1_5", hash: "sha256" },
    );

    if (!verified) throw new Error("Token signature invalid");

    const { payload } = decode(jwt);
    return payload.sub;
  } catch (error) {
    console.log(error);
    return undefined;
  }
};
