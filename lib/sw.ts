/// <reference path="../domain.d.ts" />

import { sunday, thisMonday, today } from "./dates.ts";
import { groupBy, linkList } from "./list.ts";
import { renderPage } from "./page.ts";

type ActionFilter = (action: Action) => boolean;

const filterActions = (filterer: ActionFilter) =>
  (actions: Action[]) => {
    return actions.filter(filterer);
  };

type RouteConfig = {
  filter?: ActionFilter;
  searchFilter?: (searchTerm: string) => ActionFilter;
};

const routes: { [pathname: string]: RouteConfig } = {
  "unprocessed": {
    filter: (action) => !action.date && !action.done,
  },
  "today": {
    filter: (action) =>
      (!!action.date && action.date <= today()) ||
      action.done === today(),
  },
  "week": {
    filter: (action) =>
      !!action.date &&
      (action.date >= thisMonday() && action.date <= sunday()),
  },
  "later": {
    filter: (action) => !action.done && action.date === "later",
  },
  "someday": {
    filter: (action) => !action.done && action.date === "someday",
  },
  "all": {
    filter: (action) => !action.done,
  },
  "contexts": {
    searchFilter: (context) =>
      (action) => !action.done && action.context === `@${context}`,
  },
  "tags": {
    searchFilter: (tag) =>
      (action) =>
        !action.done && action.tags && action.tags.includes(`#${tag}`),
  },
};

export const getPageHandler: PageHandler = (getActions) =>
  async (request) => {
    const url = new URL(request.url);

    // default filter is no filter
    let filter: ActionFilter = () => true;

    // find route
    const [, section, searchTerm] = url.pathname.split("/");
    const route = routes[section];
    if (route) {
      if (route.filter) filter = route.filter;
      if (route.searchFilter) filter = route.searchFilter(searchTerm);
    }

    const allActions = await getActions();
    const list = await Promise
      .resolve(allActions)
      .then(filterActions(filter))
      .then(groupBy("context"));

    const contexts = linkList('context')(allActions);
    const tags = linkList('tags')(allActions);

    const renderOptions: PageRendererOptions = {
      list,
      contexts,
      tags,
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
