type KVNamespace = {
  get: (key: string) => Promise<string | null>;
};
