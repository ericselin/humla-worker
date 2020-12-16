/// <reference path="../domain.d.ts" />

import { sunday, thisMonday, today } from "./dates.ts";
import { groupBy } from "./list.ts";
import { PageRendererOptions, renderPage } from "./page.ts";

type ActionFilter = (action: Action) => boolean;

const filterActions = (filterer: ActionFilter) =>
  (actions: Action[]) => {
    return actions.filter(filterer);
  };

type RouteConfig = {
  filter: ActionFilter;
};

const routes: { [pathname: string]: RouteConfig } = {
  "/unprocessed": {
    filter: (action) => !action.date && !action.done,
  },
  "/today": {
    filter: (action) =>
      (!!action.date && action.date <= today()) ||
      action.done === today(),
  },
  "/week": {
    filter: (action) =>
      !!action.date &&
      (action.date >= thisMonday() && action.date <= sunday()),
  },
  "/later": {
    filter: (action) => !action.done && action.date === "later",
  },
  "/someday": {
    filter: (action) => !action.done && action.date === "someday",
  },
  "/all": {
    filter: (action) => !action.done,
  },
};

export const getPageHandler: PageHandler = (getActions) =>
  async (request) => {
    const url = new URL(request.url);

    // default filter is no filter
    let filter: ActionFilter = () => true;
    const route = routes[url.pathname];
    if (route) {
      filter = route.filter;
    }

    const list = await Promise
      .resolve()
      .then(getActions)
      .then(filterActions(filter))
      .then(groupBy("context"));

    const renderOptions: PageRendererOptions = {
      list,
    };

    // add autofocus from hash
    const focus = url.searchParams.get("focus");
    if (focus) {
      renderOptions.autofocus = focus;
    }

    return new Response(
      renderPage(renderOptions),
      {
        headers: {
          "Content-Type": "text/html",
        },
      },
    );
  };

export const getSaveHandler: SaveHandler = (saveAction) =>
  async (request) => {
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
    let redirect = request.referrer;
    // if this was an add, re-focus the add textarea
    if (!id) redirect += "?focus=add";
    return new Response(
      `Redirecting to ${redirect}`,
      { status: 302, headers: { "Location": redirect } },
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
