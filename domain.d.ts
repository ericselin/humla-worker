/// <reference path="./lib.d.ts" />

type ID = string;

type Action = {
  id: ID;
  title: string;
  tags: string[];
  date?: string;
  context?: string;
  body: string;
  done?: string;
};

type ActionGroup = {
  heading: string;
  children: (Action | ActionGroup)[];
};

type ActionInput = {
  id?: string | null;
  body: string;
  done?: string | null;
};

type ActionLister = (request: Request) => Promise<Action[]>;
type ActionPersister = (actions: Action[], event: FetchEvent) => Promise<void>;

type EventHandler = (event: FetchEvent) => Promise<Response> | Response;

type RequestHandler = (
  request: Request,
) => Promise<Response> | Response;

type PageHandler = (getActions: ActionLister) => RequestHandler;
type SaveHandler = (saveAction: ActionSaver) => EventHandler;
type ActionSaver = (input: ActionInput, event: FetchEvent) => Promise<void>;
type AssetHandler = (cache: Cache) => RequestHandler;

type MainHandlerDependencies = {
  listActions: ActionLister;
  saveActions: ActionPersister;
  handleAssetRequest: RequestHandler;
  // this is needed in order to implement a server-side oauth endpoint
  handleRoutes?: {
    [urlPath: string]: RequestHandler;
  };
};

type MainHandler = (
  dependencies: MainHandlerDependencies,
) => EventHandler;

type Link = {
  url: string;
  text: string;
};

type PageRendererOptions = {
  list: ActionGroup;
  tags: Link[];
  contexts: Link[];
  autofocus?: ID | "add";
};
