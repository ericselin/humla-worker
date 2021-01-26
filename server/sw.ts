/// <reference path="../domain.d.ts" />
/// <reference path="./cf-runtime.d.ts" />

declare const self: ServiceWorkerGlobalScope;

import { getActionSaver } from "../lib/save.ts";
import { getMainHandler, getPageHandler, getSaveHandler } from "../lib/sw.ts";
import { getAssetFromKV } from "./kv-sites/mod.ts";
import { getUserIdGetter, UserIdGetter } from "./auth.ts";
import { ifEquals } from "./fn.ts";

type UserActionsGetter = (userId: string) => Promise<Action[]>;
type UserActionsSaver = (
  actions: Action[],
) => (userId: string) => Promise<void>;

const getServerActionLister = (
  getUserId: UserIdGetter,
  getUserActions: UserActionsGetter,
): ActionLister =>
  (request) =>
    Promise.resolve(request)
      // get user id from response
      .then(getUserId)
      .then(ifEquals(
        // return empty array if no user logged in
        undefined,
        [],
        // otherwise return user todos from 'humla-actions' kv namespace
        getUserActions,
      ));

const getServerActionSaver = (
  getUserId: UserIdGetter,
  saveUserActions: UserActionsSaver,
): ActionPersister =>
  (actions, { request }) => {
    // get user id from response
    return Promise.resolve(request)
      .then(getUserId)
      .then(ifEquals(
        undefined,
        () => {
          throw new Error(`User not logged in`);
        },
        saveUserActions(actions),
      ));
  };

const jwks = [
  {
    "alg": "RS256",
    "kty": "RSA",
    "use": "sig",
    "e": "AQAB",
    "n":
      "8Yb9hQAJroV6VKCsZZ6ylhVJqo0gsFa0Ca8ytzanKKWsCjo6RaqLjej7QKniTKwhUheCvbfLUqY9Mc6iMbA3gI-6_2lLQbbxExt6WUpf-CAEv1oUcnH_jA6X5Bdu4TdUX29s3D8J95d0eR8z8J1pe-7CjTBClx7lZd5xSRcoDXHDhzkwvc-EehYV46FsJyZCthLpAXvj81gpfycveavNFBMj-nlHKopZvhMcwbsK5JZ37wn2SxFigpfmIojheFVShJsNmLErHVC9HoHTC0iMibsKdyo7mk5QNM_rdBK-KjJhlQr8l7CktAqUJIQzkW8qC7tV7Hl0xicp6ylWZ-pj-Q",
    "kid": "783ec031c59e11f257d0ec15714ef607ce6a2a6f",
  },
  {
    "alg": "RS256",
    "kid": "eea1b1f42807a8cc136a03a3c16d29db8296daf0",
    "e": "AQAB",
    "n":
      "0zNdxOgV5VIpoeAfj8TMEGRBFg-gaZWz94ePR1yxTKzScHakH4F4wcMEyL0vNE-yW_u4pOl9E-hAalPa2tFv4fCVNMMkmKwcf0gm9wNFWXGakVQ8wER4iUg33MyUGOWj2RGX1zlZxCdFoZRtshLx8xcpL3F5Hlh6m8MqIAowWtusTf5TtYMXFlPaWLQgRXvoOlLZ-muzEuutsZRu-agdOptnUiAZ74e8BgaKN8KNEZ2SqP6vE4w16mgGHQjEPUKz9exxcsnbLru6hZdTDvXbX9IduabyvHy8vQRZsqlE9lTiOOOC9jwh27TXsD05HAXmNYiR6voekzEvfS88vnot2Q",
    "use": "sig",
    "kty": "RSA",
  },
];
const clientId = "407408718192.apps.googleusercontent.com";

declare const ACTIONS: KVNamespace;

const userActionsGetter: UserActionsGetter = async (userId) => {
  return ACTIONS.get(userId, "json") as Promise<Action[]>;
};

const userActionsSaver: UserActionsSaver = (actions) =>
  async (userId) => {
    await ACTIONS.put(userId, JSON.stringify(actions));
  };

const userIdGetter = getUserIdGetter(jwks, clientId);

const listActions = getServerActionLister(
  userIdGetter,
  userActionsGetter,
);

const saveActions = getServerActionSaver(
  userIdGetter,
  userActionsSaver,
);

const handleAssetRequest: RequestHandler = getAssetFromKV;

const handleRequest = getMainHandler({
  listActions,
  saveActions,
  handleAssetRequest,
});

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});
