/// <reference path="../domain.d.ts" />

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

export const getActionSaver: ActionSaverGetter = (getActions, saveActions) =>
  async (input) => {
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
