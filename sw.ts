/// <reference no-default-lib="true"/>
/// <reference lib="webworker" />
/// <reference lib="es2020" />

declare const self: ServiceWorkerGlobalScope;

import { renderPage } from "./page.ts";
import type { Action, ActionGroup } from "./actions.ts";
import { getActions, saveAction } from "./actions.ts";

const groupBy = <K extends keyof Action>(field: K) =>
  (actions: Action[]): ActionGroup[] => {
    if (field !== "context") throw new Error("Not implemented");
    const groupMap = actions.reduce((map, action) => {
      if (!map[action.context]) {
        map[action.context] = {
          heading: action.context,
          children: [],
        };
      }
      map[action.context].children.push(action);
      return map;
    }, {} as { [context: string]: ActionGroup });
    return Object.values(groupMap);
  };

type ResponseHandler = (request: Request) => Promise<Response> | Response;

const handleAssetRequest: ResponseHandler = async (request) => {
  return await caches.match(request) || fetch(request);
};

const handlePageRequest: ResponseHandler = async (request) => {
  const list = await Promise
    .resolve()
    .then(getActions)
    .then(groupBy("context"));

  return new Response(
    renderPage({ list }),
    {
      headers: {
        "Content-Type": "text/html",
      },
    },
  );
};

const handleFormRequest: ResponseHandler = async (request) => {
  const form = await request.formData();
  const id = form.get("id");
  const done = form.get("done");
  const body = form.get("body");
  if (id && typeof id !== "string") {
    throw new Error("Wrong id");
  }
  if (typeof body !== "string" || !body) {
    throw new Error("Wrong body");
  }
  if (done && typeof done !== "string") {
    throw new Error("Wrong body");
  }
  await saveAction({
    id,
    done,
    body,
  });
  return new Response(
    `Redirecting to ${request.referrer}`,
    { status: 302, headers: { "Location": request.referrer } },
  );
};

const handleRequest: ResponseHandler = async (request) => {
  const url = new URL(request.url);

  if (request.method === "GET" && !url.pathname.includes(".")) {
    return handlePageRequest(request);
  } else if (request.method === "POST") {
    return handleFormRequest(request);
  }

  return handleAssetRequest(request);
};

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

const populateCache = async () => {
  const cache = await caches.open("v1");
  return cache.addAll([
    "/app.js",
    "actions.json",
  ]);
};

self.addEventListener("install", (event) => {
  event.waitUntil(populateCache());
});
