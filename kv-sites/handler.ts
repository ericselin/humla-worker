/// <reference path="./domain.d.ts" />
import "https://raw.githubusercontent.com/ericselin/worker-types/v1.0.0/cloudflare-worker-types.ts";

declare const ASSETS: KVNamespace | undefined;

const contentTypes: {
  [extension: string]: string;
} = {
  "js": "application/javascript",
};

export const getAssetFromKV: AssetRequestHandler = async (request) => {
  if (!ASSETS) {
    return new Response("Need KV binding `ASSETS`", { status: 500 });
  }

  const url = new URL(request.url);

  const contents = await ASSETS.get(url.pathname);
  if (contents === null) {
    return new Response("Not found", { status: 404 });
  }

  let contentType = "text/html";
  const extension = url.pathname.split(".").pop();
  if (extension && contentTypes[extension]) {
    contentType = contentTypes[extension];
  }

  return new Response(contents, {
    headers: {
      "Content-Type": contentType,
    },
  });
};
