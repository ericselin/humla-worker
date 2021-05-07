import { uploadDirToKV } from "./uploader.ts";

const usage = `
Upload assets to Cloudflare KV storage. Usage:

> deno run --allow-read=PUBLISH_DIR --allow-net=api.cloudflare.com --allow-env kv-sites/cmd.ts PUBLISH_DIR CF_ACCOUNT CF_KV_NAMESPACE

The Cloudflare token should be set in the CF_API_TOKEN environment variable.
`;

try {
  const [publishDir, cfAccount, cfKVNamespace] = Deno.args;
  const cfToken = Deno.env.get("CF_API_TOKEN");

  if (!publishDir || !cfAccount || !cfKVNamespace || !cfToken) {
    throw new Error(`Wrong parameters`);
  }

  await uploadDirToKV(
    {
      account: cfAccount,
      namespace: cfKVNamespace,
      token: cfToken,
    },
    publishDir,
  );
} catch (error) {
  console.log(usage);
  console.error(error);
}
