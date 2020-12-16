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

type ResponseHandler = (
  request: Request,
) => Promise<Response> | Response;

type PageHandler = (getActions: ActionLister) => ResponseHandler;
type SaveHandler = (saveAction: ActionSaver) => ResponseHandler;
type AssetHandler = (cache: Cache) => ResponseHandler;

type MainHandlerDependencies = {
  handlePage: ResponseHandler;
  handleSave: ResponseHandler;
  handleAsset: ResponseHandler;
};

type MainHandler = (
  dependencies: MainHandlerDependencies,
) => ResponseHandler;

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
