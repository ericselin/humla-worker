/// <reference path="../domain.d.ts" />

import { renderPage } from "./page.ts";

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

export const getPageHandler: PageHandler = (getActions) => async (request) => {
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

export const getSaveHandler: SaveHandler = (saveAction) => async (request) => {
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

export const getMainHandler: MainHandler = (
  { handleAsset, handlePage, handleSave },
) =>
  async (request) => {
    const url = new URL(request.url);

    if (request.method === "GET" && !url.pathname.includes(".")) {
      return handlePage(request);
    } else if (request.method === "POST") {
      return handleSave(request);
    }

    return handleAsset(request);
  };
