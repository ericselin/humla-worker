/// <reference path="./domain.d.ts" />

import { map } from "../fn.ts";
import { getUploads } from "./filesystem.ts";

const uploadToKVWriterParams = (
  upload: UploadFile,
): CloudflareAPIKVWriteParams => ({
  key: upload.urlPath,
  value: upload.contents,
});

export const getKVWriter = (opts: CloudflareAPIKVOptions) =>
  async (
    params: CloudflareAPIKVWriteParams[],
  ): Promise<CloudflareAPIResponse> => {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${opts.account}/storage/kv/namespaces/${opts.namespace}/bulk`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${opts.token}`,
        },
        body: JSON.stringify(params),
      },
    );
    if (!response.ok) {
      const errorText =
        `Could not fetch: ${response.status} ${response.statusText}`;
      console.error(`ERROR: ${errorText}`, await response.text());
      throw new Error(errorText);
    }
    return response.json();
  };

export const logFailedResponse = (
  cloudflareResponse: CloudflareAPIResponse,
): void => {
  if (!cloudflareResponse.success) {
    console.error("ERROR: API request failed", cloudflareResponse.errors);
  }
};

export const uploadDirToKV: KVUploader = async (cfOpts, publishDir) => {
  const writeToKV = getKVWriter(cfOpts);
  return Promise
    .resolve(publishDir)
    .then(getUploads)
    .then(map(uploadToKVWriterParams))
    .then(writeToKV);
};
