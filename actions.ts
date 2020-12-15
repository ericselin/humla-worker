type ID = number;

export type Action = {
  id: ID;
  title: string;
  date: string;
  tags: string[];
  context: string;
  body: string;
  done?: boolean;
};

export type ActionGroup = {
  heading: string;
  children: Action[];
};

export type ActionInput = {
  id?: string | null;
  body: string;
  done?: string | null;
};

type ActionGetter = () => Promise<Action[]>;

export const getActions: ActionGetter = async () => {
  const cache = await caches.open("v1");
  const response = await cache.match("/actions.json");
  return response?.json();
};

const saveActions = async (actions: Action[]): Promise<void> => {
  const cache = await caches.open("v1");
  return cache.put("/actions.json", new Response(JSON.stringify(actions)));
};

export const processActionInput = (input: ActionInput): Action => {
  const action: Action = {
    id: input.id ? Number.parseInt(input.id) : 999,
    body: input.body,
    context: "[n/a]",
    title: "[n/a]",
    date: "[n/a]",
    tags: ["[n/a]"],
  };
  if (input.done) action.done = true;
  return action;
};

export const saveAction = async (input: ActionInput): Promise<void> => {
  const action = processActionInput(input);
  const actions = await getActions();
  const index = actions.findIndex((a) => a.id === action.id);
  if (~index) {
    actions[index] = action;
  } else {
    actions.push(action);
  }
  console.log("saving", action, actions);
  return saveActions(actions);
};
