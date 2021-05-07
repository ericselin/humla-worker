/// <reference path="../domain.d.ts" />

import { sunday, thisMonday, today } from "./dates.ts";
import { groupBy, linkList } from "./list.ts";
import { renderPage } from "./page.ts";
import { getActionSaver } from "./save.ts";

/**
 * Action filtering function for use with e.g. `array.map`
 */
type ActionFilter = (action: Action) => boolean;

/**
 * Route configuration for action list rendering routes
 */
type RouteConfig = {
  /** Page title / heading */
  heading: string;
  /** Optional action filtering function */
  filter?: ActionFilter;
  /** Optional action filtering function that filters based on a specific search term */
  searchFilter?: (searchTerm: string) => ActionFilter;
};

/**
 * Main routes used for rendering specific action lists
 */
const routes: { [pathname: string]: RouteConfig } = {
  "": {
    heading: "Today",
    filter: (action) =>
      (!!action.date && action.date <= today() && !action.done) ||
      action.done === today(),
  },
  "unprocessed": {
    heading: "Unprocessed",
    filter: (action) => !action.date && !action.done,
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

/**
 * Get a request handler that renders a "page" i.e. route. Handler returns
 * undefined if no route is found.
 */
export const _getPageHandler = (getActions: ActionLister) =>
  (request: Request): Promise<Response> | undefined => {
    const url = new URL(request.url);

    // find route
    const [, section = "", searchTerm] = url.pathname.split("/");
    const route = routes[section];

    // bail if no route found
    if (!route) return;

    // default filter is no filter
    let filter: ActionFilter = () => true;
    let heading = "Actions";

    heading = route.heading;
    if (route.filter) filter = route.filter;
    if (route.searchFilter) filter = route.searchFilter(searchTerm);

    return Promise.resolve(request)
      .then(getActions)
      .then((allActions) => {
        const groupedActions = groupBy("context")(allActions.filter(filter));
        const contexts = linkList("context")(allActions);
        const tags = linkList("tags")(allActions);

        const renderOptions: PageRendererOptions = {
          list: {
            heading,
            children: groupedActions,
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
      });
  };

/**
 * Save handler will parse the request form data and save the 
 * action with the provided `saveAction` function. Then it will
 * redirect back to the referrer, possibly specifying the
 * page to focus the add action textbox.
 */
export const _getSaveHandler: SaveHandler = (saveAction) =>
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

/**
 * Response getter will return a promise of a response based on the request,
 * or undefined if no suitable route was found.
 */
export const _getResponseGetter = (
  { listActions, saveActions, handleAssetRequest }: MainListenerDependencies,
): (event: FetchEvent) => Promise<Response> | undefined => {
  const handlePage = _getPageHandler(listActions);
  const handleSave = _getSaveHandler(getActionSaver(listActions, saveActions));
  return (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // normal get requests
    if (request.method === "GET") {
      if (url.pathname.includes(".")) return handleAssetRequest(request);
      return handlePage(request);
    }

    // actions saving
    if (request.method === "POST" && url.pathname === "/upsert") {
      return handleSave(event);
    }
  };
};

/**
 * Get the main page event listener. This function calls `event.respondWith()`
 * if a suitable route is found, otherwise just returns void without responding.
 * 
 * Add this as a fetch event handler with `addEventListener("fetch", ...)`.
 * You should add a fallback (e.g. 404 returning) event listener after this
 * for the cases where a route was not found.
 */
export const getMainEventListener: MainListenerGetter = (deps) => {
  const getResponse = _getResponseGetter(deps);
  return (event) => {
    const response = getResponse(event);
    if (response) event.respondWith(response);
  };
};
