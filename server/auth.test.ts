import { assertEquals } from "https://deno.land/std@0.81.0/testing/asserts.ts";
import { getUserId } from "./auth.ts";

const token =
  "eyJhbGciOiJSUzI1NiIsImtpZCI6Ijc4M2VjMDMxYzU5ZTExZjI1N2QwZWMxNTcxNGVmNjA3Y2U2YTJhNmYiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI0MDc0MDg3MTgxOTIuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI0MDc0MDg3MTgxOTIuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTM1MjA3Nzg0MzU3NDMxNzIwNzgiLCJhdF9oYXNoIjoiYWpZT291TWNJVmZoSUF0MzRwMURzdyIsImlhdCI6MTYxMTA4OTM4OCwiZXhwIjoxNjExMDkyOTg4fQ.AejXjHc3vB9xHK0hVvGEpgJWftS8ksVaLqHo65LGSeODNyHD0uh42e9iDVsjCcNZEX64tSx1a_Ah0TDnEGorOKfJYXSYqmBE3RSwY2QHFhoP4lbgaEo6usyyeIIG5pcdCI5Vgir11zL4BfuuqoiTZK2t6TRlBCEqNeuA8-je3kjeNiISbPm5Hmx_qzPom2UNimPj4zLBv4h2O0sR98Dz9Hpra9RZwMPLZFWDb28CHoty3NFW1aeXHwCC0EpXVjbh7jB7OlzKLQhV_66QQeX9SBv_gx9h5vVnLWj341wL-utIS6-EQrmnAMN07dXyhgH1K8ErIwklsezDYrVhEqpywg";
const sub = "113520778435743172078";

Deno.test("returns user claim", async () => {
  const request = new Request(
    "http://localhost",
    { headers: { cookie: `token=${token}` } },
  );
  const id = await getUserId(request);
  assertEquals(id, sub);
});
