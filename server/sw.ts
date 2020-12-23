/// <reference path="../domain.d.ts" />

declare const self: ServiceWorkerGlobalScope;

import { getActionSaver } from "../lib/save.ts";
import { getMainHandler, getPageHandler, getSaveHandler } from "../lib/sw.ts";
import { getAssetFromKV } from "./kv-sites/mod.ts";

const listActions: ActionLister = async () => {
  return [];
};

const saveActions = async (actions: Action[]): Promise<void> => {
  throw new Error("Not implemented");
};

const handleAssetRequest: ResponseHandler = getAssetFromKV;

const handleRequest = getMainHandler({
  handlePage: getPageHandler(listActions),
  handleSave: getSaveHandler(getActionSaver(listActions, saveActions)),
  handleAsset: handleAssetRequest,
});

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});
