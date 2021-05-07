/// <reference path="./domain.d.ts" />

const readDir = async (dir: string, url = ""): Promise<UploadFile[]> => {
  const uploadFiles: UploadFile[] = [];
  for await (const dirEntry of Deno.readDir(dir)) {
    const entryPath = `${dir}/${dirEntry.name}`;
    const entryUrl = `${url}/${dirEntry.name}`;
    if (dirEntry.isDirectory) {
      const subDirUploadFiles = await readDir(entryPath, entryUrl);
      uploadFiles.push(...subDirUploadFiles);
    } else if (dirEntry.isFile) {
      const fileContents = await Deno.readTextFile(entryPath);
      uploadFiles.push({
        contents: fileContents,
        filePath: entryPath,
        urlPath: entryUrl,
      });
    }
  }
  return uploadFiles;
};

export const getUploads: UploadsGetter = async (publishDir) => {
  const uploads = await readDir(publishDir);
  console.log("Uploads:", uploads.map((u) => u.filePath));
  return uploads;
};
