type AssetRequestHandler = (request: Request) => Promise<Response | undefined>;

type UploadFile = {
  filePath: string;
  urlPath: string;
  contents: string;
};

type CloudflareAPIKVOptions = {
  namespace: string;
  account: string;
  token: string;
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

type Uploader = (
  cloudflareOptions: CloudflareAPIKVOptions,
  publishDir: string,
) => Promise<UploadResult>;
