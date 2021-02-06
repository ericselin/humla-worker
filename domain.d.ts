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

type FetchEventListener = (event: FetchEvent) => void;
type EventHandler = (event: FetchEvent) => Promise<Response>;
type RequestHandler = (
  request: Request,
) => Promise<Response>;

type SaveHandler = (saveAction: ActionSaver) => EventHandler;
type ActionSaver = (input: ActionInput, event: FetchEvent) => Promise<void>;
type AssetHandler = (cache: Cache) => RequestHandler;

type MainListenerDependencies = {
  listActions: ActionLister;
  saveActions: ActionPersister;
  handleAssetRequest: RequestHandler;
};

type MainListenerGetter = (
  dependencies: MainListenerDependencies,
) => FetchEventListener;

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
