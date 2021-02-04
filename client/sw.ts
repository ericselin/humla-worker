/// <reference path="../domain.d.ts" />

declare const self: ServiceWorkerGlobalScope;

import { getMainHandler } from "../lib/sw.ts";

const listActions: ActionLister = async () => {
  const cache = await caches.open("v1");
  const response = await cache.match("/actions.json");
  return response?.json();
};

const saveActions: ActionPersister = async (actions, event) => {
  const cache = await caches.open("v1");
  const actionsJson = JSON.stringify(actions);
  event.waitUntil(
    fetch(
      "/api/actions.json",
      { method: "POST", body: actionsJson, redirect: "manual" },
    ),
  );
  return cache.put("/api/actions.json", new Response(actionsJson));
};

const handleAssetRequest: RequestHandler = async (request) => {
  return await caches.match(request) || fetch(request);
};

const handleRequest = getMainHandler({
  listActions,
  saveActions,
  handleAssetRequest,
});

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});

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

self.addEventListener("install", (event) => {
  event.waitUntil(populateCache());
});
