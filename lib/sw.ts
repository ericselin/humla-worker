/// <reference path="../domain.d.ts" />

import { sunday, thisMonday, today } from "./dates.ts";
import { groupBy, linkList } from "./list.ts";
import { renderPage } from "./page.ts";
import { getActionSaver } from "./save.ts";

type ActionFilter = (action: Action) => boolean;

const filterActions = (filterer: ActionFilter) =>
  (actions: Action[]) => {
    return actions.filter(filterer);
  };

type RouteConfig = {
  heading: string;
  filter?: ActionFilter;
  searchFilter?: (searchTerm: string) => ActionFilter;
};

const routes: { [pathname: string]: RouteConfig } = {
  "unprocessed": {
    heading: "Unprocessed",
    filter: (action) => !action.date && !action.done,
  },
  "today": {
    heading: "Today",
    filter: (action) =>
      (!!action.date && action.date <= today() && !action.done) ||
      action.done === today(),
  },
  "week": {
    heading: "This week",
    filter: (action) =>
      !!action.date &&
      (action.date >= thisMonday() && action.date <= sunday()),
  },
  "later": {
    heading: "Later",
    filter: (action) => !action.done && action.date === "later",
  },
  "someday": {
    heading: "Someday",
    filter: (action) => !action.done && action.date === "someday",
  },
  "all": {
    heading: "All",
    filter: (action) => !action.done,
  },
  "contexts": {
    heading: "Contexts",
    searchFilter: (context) =>
      (action) => !action.done && action.context === `@${context}`,
  },
  "tags": {
    heading: "Tags",
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
    let heading = "Actions";

    // find route
    const [, section, searchTerm] = url.pathname.split("/");
    const route = routes[section];
    if (route) {
      heading = route.heading;
      if (route.filter) filter = route.filter;
      if (route.searchFilter) filter = route.searchFilter(searchTerm);
    }

    const allActions = await getActions(request);
    const actionGroup = await Promise
      .resolve(allActions)
      .then(filterActions(filter))
      .then(groupBy("context"));

    const contexts = linkList("context")(allActions);
    const tags = linkList("tags")(allActions);

    const renderOptions: PageRendererOptions = {
      list: {
        heading,
        children: actionGroup,
      },
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
  async (event) => {
    const { request } = event;
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
    }, event);
    let redirect = request.referrer;
    // if this was an add, re-focus the add textarea
    if (!id) redirect += "?focus=add";
    return new Response(
      `Redirecting to ${redirect}`,
      { status: 302, headers: { "Location": redirect } },
    );
  };

const returnJson = (data: any): Response =>
  new Response(
    JSON.stringify(data),
    { headers: { "Content-Type": "application/json" } },
  );

export const getMainHandler: MainHandler = (
  { listActions, saveActions, handleAssetRequest, handleRoutes },
) => {
  const handlePage = getPageHandler(listActions);
  const handleSave = getSaveHandler(getActionSaver(listActions, saveActions));
  return async (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // specifically set routes
    if (handleRoutes && handleRoutes[url.pathname]) {
      return handleRoutes[url.pathname](request);
    }

    // actions api
    if (url.pathname === "/actions.json") {
      if (request.method === "POST") {
        return handleSave(event);
      }
      if (request.method === "GET") {
        return Promise.resolve(request)
          .then(listActions)
          .then(returnJson);
      }
    }

    // normal get requests
    if (request.method === "GET") {
      if (url.pathname.includes(".")) return handleAssetRequest(request);
      return handlePage(request);
    }

    // otherwise method is not supported
    return new Response(undefined, { status: 405 });
  };
};
