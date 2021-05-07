import "https://raw.githubusercontent.com/ericselin/worker-types/v1.0.0/cloudflare-worker-types.ts";

declare const __STATIC_CONTENT: KVNamespace;
declare const __STATIC_CONTENT_MANIFEST: string;

const contentTypes: {
  [extension: string]: string;
} = {
  "js": "application/javascript",
  "css": "text/css",
};

export const getAssetFromKV: (request: Request) => Promise<Response> = async (request) => {
  const url = new URL(request.url);
  const manifest = JSON.parse(__STATIC_CONTENT_MANIFEST);

  const manifestKey = url.pathname.replace(/^\/+/, '');
  const pathKey = manifest[manifestKey];

  const contents = await __STATIC_CONTENT.get(pathKey);
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
