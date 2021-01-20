import { assertEquals } from "https://deno.land/std@0.81.0/testing/asserts.ts";
import { FakeTime } from "https://deno.land/x/mock@v0.9.4/time.ts";
import { getUserId } from "./auth.ts";

const token =
  "eyJhbGciOiJSUzI1NiIsImtpZCI6Ijc4M2VjMDMxYzU5ZTExZjI1N2QwZWMxNTcxNGVmNjA3Y2U2YTJhNmYiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI0MDc0MDg3MTgxOTIuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI0MDc0MDg3MTgxOTIuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTM1MjA3Nzg0MzU3NDMxNzIwNzgiLCJhdF9oYXNoIjoiYWpZT291TWNJVmZoSUF0MzRwMURzdyIsImlhdCI6MTYxMTA4OTM4OCwiZXhwIjoxNjExMDkyOTg4fQ.AejXjHc3vB9xHK0hVvGEpgJWftS8ksVaLqHo65LGSeODNyHD0uh42e9iDVsjCcNZEX64tSx1a_Ah0TDnEGorOKfJYXSYqmBE3RSwY2QHFhoP4lbgaEo6usyyeIIG5pcdCI5Vgir11zL4BfuuqoiTZK2t6TRlBCEqNeuA8-je3kjeNiISbPm5Hmx_qzPom2UNimPj4zLBv4h2O0sR98Dz9Hpra9RZwMPLZFWDb28CHoty3NFW1aeXHwCC0EpXVjbh7jB7OlzKLQhV_66QQeX9SBv_gx9h5vVnLWj341wL-utIS6-EQrmnAMN07dXyhgH1K8ErIwklsezDYrVhEqpywg";
const sub = "113520778435743172078";
const keys = [
  {
    "alg": "RS256",
    "kty": "RSA",
    "use": "sig",
    "e": "AQAB",
    "n":
      "8Yb9hQAJroV6VKCsZZ6ylhVJqo0gsFa0Ca8ytzanKKWsCjo6RaqLjej7QKniTKwhUheCvbfLUqY9Mc6iMbA3gI-6_2lLQbbxExt6WUpf-CAEv1oUcnH_jA6X5Bdu4TdUX29s3D8J95d0eR8z8J1pe-7CjTBClx7lZd5xSRcoDXHDhzkwvc-EehYV46FsJyZCthLpAXvj81gpfycveavNFBMj-nlHKopZvhMcwbsK5JZ37wn2SxFigpfmIojheFVShJsNmLErHVC9HoHTC0iMibsKdyo7mk5QNM_rdBK-KjJhlQr8l7CktAqUJIQzkW8qC7tV7Hl0xicp6ylWZ-pj-Q",
    "kid": "783ec031c59e11f257d0ec15714ef607ce6a2a6f",
  },
  {
    "alg": "RS256",
    "kid": "eea1b1f42807a8cc136a03a3c16d29db8296daf0",
    "e": "AQAB",
    "n":
      "0zNdxOgV5VIpoeAfj8TMEGRBFg-gaZWz94ePR1yxTKzScHakH4F4wcMEyL0vNE-yW_u4pOl9E-hAalPa2tFv4fCVNMMkmKwcf0gm9wNFWXGakVQ8wER4iUg33MyUGOWj2RGX1zlZxCdFoZRtshLx8xcpL3F5Hlh6m8MqIAowWtusTf5TtYMXFlPaWLQgRXvoOlLZ-muzEuutsZRu-agdOptnUiAZ74e8BgaKN8KNEZ2SqP6vE4w16mgGHQjEPUKz9exxcsnbLru6hZdTDvXbX9IduabyvHy8vQRZsqlE9lTiOOOC9jwh27TXsD05HAXmNYiR6voekzEvfS88vnot2Q",
    "use": "sig",
    "kty": "RSA",
  },
];
const clientId = "407408718192.apps.googleusercontent.com";

Deno.test("authenticator returns user claim", async () => {
  const time = new FakeTime("2021-01-19 21:00");
  try {
    const request = new Request(
      "http://localhost",
      { headers: { cookie: `token=${token}` } },
    );
    const id = await getUserId(keys, clientId)(request);
    assertEquals(id, sub);
  } finally {
    time.restore();
  }
});

Deno.test("authenticator returns undefined if no token in request", async () => {
  const request = new Request("http://localhost");
  const id = await getUserId(keys, clientId)(request);
  assertEquals(id, undefined);
});
