/// <reference path="../domain.d.ts" />

import { DateParser, parseDate, today } from "./dates.ts";
import { uuid } from "./deps.ts";

export const getTags = (body: string): string[] => {
  const regex = /(?:^|\s)(#\w+)/g;
  const matches = body.matchAll(regex);
  const tags: string[] = [];
  for (const match of matches) {
    tags.push(match[1]);
  }
  return tags;
};

export const getContext = (body: string): string => {
  const regex = /(?:^|\s)(@\w+)/;
  const [, context] = body.match(regex) || [];
  return context;
};

export const getDate = (dateParser: DateParser) =>
  (body: string) => {
    const regex = /\B!(\w+\.?\w*)\b/;
    const [, date] = body.match(regex) || [];
    return date ? dateParser(date) : undefined;
  };

export const getTitle = (body: string): string => {
  return body.split("\n")[0];
};

export const processActionInput = (input: ActionInput): Action => {
  const action: Action = {
    id: input.id || uuid.v4.generate(),
    body: input.body,
    context: getContext(input.body),
    title: getTitle(input.body),
    date: getDate(parseDate)(input.body),
    tags: getTags(input.body),
  };
  if (input.done) action.done = today();
  return action;
};

export const getActionSaver: ActionSaverGetter = (getActions, saveActions) =>
  async (input, request) => {
    const action = processActionInput(input);
    const actions = await getActions(request);
    const index = actions.findIndex((a) => a.id === action.id);
    if (~index) {
      actions[index] = action;
    } else {
      actions.push(action);
    }
    console.log("saving", action, actions);
    return saveActions(actions, request);
  };
