/// <reference path="../domain.d.ts" />

declare const caches: CacheStorage;

import { getMainEventListener } from "../lib/sw.ts";

const listActions: ActionLister = async () => {
  // TODO: ADD UPDATED ACTIONS TO CACHE
  // const cache = await caches.open("v1");
  // const response = await cache.match("/api/actions.json");
  const response = await fetch("/api/actions.json");
  return response?.json() || [];
};

const saveActions: ActionPersister = async (actions, event) => {
  const actionsJson = JSON.stringify(actions);
  // TODO: PUT ACTIONS TO CACHE
  // const cache = await caches.open("v1");
  // event.waitUntil(
  //   fetch(
  //     "/api/actions.json",
  //     { method: "POST", body: actionsJson, redirect: "manual" },
  //   ),
  // );
  // return cache.put("/api/actions.json", new Response(actionsJson));
  await fetch(
    "/api/actions.json",
    { method: "POST", body: actionsJson },
  );
};

const handleAssetRequest: RequestHandler = async (request) => {
  return await caches.match(request) || fetch(request);
};

const mainEventListener = getMainEventListener({
  listActions,
  saveActions,
  handleAssetRequest,
});

self.addEventListener("fetch", mainEventListener);

const populateCache = async () => {
  const assets = [
    "/app.js",
  ];
  const cache = await caches.open("v1");
  const actions = await cache.match("/api/actions.json");
  if (actions) {
    console.log("We already have some actions:", actions);
  } else {
    assets.push("/api/actions.json");
  }
  return cache.addAll(assets);
};

self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(populateCache());
});
