type AssetRequestHandler = (request: Request) => Promise<Response | undefined>;

type UploadFile = {
  filePath: string;
  urlPath: string;
  contents: string;
};

type CloudflareAPIKVOptions = {
  account: string;
  token: string;
  namespace: string;
};

type CloudflareAPIKVWriteParams = {
  key: string;
  value: string;
};

type CloudflareAPIResponse = {
  success: boolean;
  errors: unknown[];
  messages: unknown[];
};

type UploadsGetter = (publishDir: string) => Promise<UploadFile[]>;

type UploadResult = CloudflareAPIResponse;

type KVUploader = (
  cloudflareOptions: CloudflareAPIKVOptions,
  publishDir: string,
) => Promise<UploadResult>;
