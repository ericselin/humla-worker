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

type ActionLister = () => Promise<Action[]>;
type ActionPersister = (actions: Action[]) => Promise<void>;
type ActionSaver = (input: ActionInput) => Promise<void>;
type ActionSaverGetter = (
  getActions: ActionLister,
  saveActions: ActionPersister,
) => ActionSaver;

type RequestHandler = (
  request: Request,
) => Promise<Response> | Response;

type PageHandler = (getActions: ActionLister) => RequestHandler;
type SaveHandler = (saveAction: ActionSaver) => RequestHandler;
type AssetHandler = (cache: Cache) => RequestHandler;

type MainHandlerDependencies = {
  handlePage: RequestHandler;
  handleSave: RequestHandler;
  handleAsset: RequestHandler;
  // this is needed in order to implement a server-side oauth endpoint
  handleRoutes?: {
    [urlPath: string]: RequestHandler;
  };
};

type MainHandler = (
  dependencies: MainHandlerDependencies,
) => RequestHandler;

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
