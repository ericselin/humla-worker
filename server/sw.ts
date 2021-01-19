/// <reference path="../domain.d.ts" />

declare const self: ServiceWorkerGlobalScope;

import { getActionSaver } from "../lib/save.ts";
import { getMainHandler, getPageHandler, getSaveHandler } from "../lib/sw.ts";
import { getAssetFromKV } from "./kv-sites/mod.ts";

const listActions: ActionLister = async (request) => {
  // get user id from response
  // return empty array if no user logged in
  // return user todos from 'humla-actions' kv namespace
  return [];
};

const saveActions: ActionPersister = async (actions) => {
  // get user id from response
  // return some useful http status if failed
  // save user todos to kv namespace
  throw new Error("Not implemented");
};

const handleAssetRequest: RequestHandler = getAssetFromKV;

const handleRequest = getMainHandler({
  handlePage: getPageHandler(listActions),
  handleSave: getSaveHandler(getActionSaver(listActions, saveActions)),
  handleAsset: handleAssetRequest,
});

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});
