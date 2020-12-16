/// <reference path="../domain.d.ts" />

declare const self: ServiceWorkerGlobalScope;

import { getActionSaver } from "../lib/save.ts";
import { getMainHandler, getPageHandler, getSaveHandler } from "../lib/sw.ts";

const listActions: ActionLister = async () => {
  const cache = await caches.open("v1");
  const response = await cache.match("/actions.json");
  return response?.json();
};

const saveActions = async (actions: Action[]): Promise<void> => {
  const cache = await caches.open("v1");
  return cache.put("/actions.json", new Response(JSON.stringify(actions)));
};

const handleAssetRequest: ResponseHandler = async (request) => {
  return await caches.match(request) || fetch(request);
};

const handleRequest = getMainHandler({
  handlePage: getPageHandler(listActions),
  handleSave: getSaveHandler(getActionSaver(listActions, saveActions)),
  handleAsset: handleAssetRequest,
});

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

const populateCache = async () => {
  const assets = [
    "/app.js",
  ];
  const cache = await caches.open("v1");
  const actions = await cache.match("/actions.json");
  if (actions) {
    console.log("We already have some actions:", actions);
  } else {
    assets.push("/actions.json");
  }
  return cache.addAll(assets);
};

self.addEventListener("install", (event) => {
  event.waitUntil(populateCache());
});
