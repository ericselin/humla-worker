/// <reference path="../domain.d.ts" />
/// <reference path="./cf-runtime.d.ts" />

declare const self: ServiceWorkerGlobalScope;

import { getMainEventListener } from "../lib/sw.ts";
import { getAssetFromKV } from "./kv-sites/mod.ts";
import { getUserIdGetter, UserIdGetter } from "./auth.ts";
import { ifEquals } from "./fn.ts";
import {
  AuthOptions,
  redirectToGooleAuth,
  redirectToRootWithTokenCookie,
} from "./auth-login.ts";

const jwks = [
  {
    "kty": "RSA",
    "kid": "03b2d22c2fecf873ed19e5b8cf704afb7e2ed4be",
    "use": "sig",
    "e": "AQAB",
    "alg": "RS256",
    "n":
      "rKZ-1zdz_CoLekSynOtyWv6cPSSkV28Kb9kZZHyYL-yhkKnH_bHl8OpWiGxQiKP0ulLRIaq1IhSMetkZ8FfXH-iptIDu4lPb8gt0HQYkjcy3HoaKRXBw2F8fJQO4jQ-ufR4l-E0HRqwLywzdtAImNWmju3A4kx8s0iSGHGSHyE4EUdh5WKt-NMtfUPfB5v9_2bC-w6wH7zAEsI5nscMXnvz1u8w7g2_agyhKSK0D9OkJ02w3I4xLMlrtKEv2naoBGerWckKcQ1kBYUh6WASPdvTqX4pcAJi7Tg6jwQXIP1aEq0JU8C0zE3d33kaMoCN3SenIxpRczRzUHpbZ-gk5PQ",
  },
  {
    "alg": "RS256",
    "use": "sig",
    "e": "AQAB",
    "kty": "RSA",
    "n":
      "3g46w4uRYBx8CXFauWh6c5yO4ax_VDu5y8ml_Jd4Gx711155PTdtLeRuwZOhJ6nRy8YvLFPXc_aXtHifnQsi9YuI_vo7LGG2v3CCxh6ndZBjIeFkxErMDg4ELt2DQ0PgJUQUAKCkl2_gkVV9vh3oxahv_BpIgv1kuYlyQQi5JWeF7zAIm0FaZ-LJT27NbsCugcZIDQg9sztTN18L3-P_kYwvAkKY2bGYNU19qLFM1gZkzccFEDZv3LzAz7qbdWkwCoK00TUUH8TNjqmK67bytYzgEgkfF9q9szEQ5TrRL0uFg9LxT3kSTLYqYOVaUIX3uaChwaa-bQvHuNmryu7i9w",
    "kid": "fd285ed4febcb1aeafe780462bc569d238c506d9",
  },
  {
    "e": "AQAB",
    "kty": "RSA",
    "alg": "RS256",
    "use": "sig",
    "kid": "eea1b1f42807a8cc136a03a3c16d29db8296daf0",
    "n":
      "0zNdxOgV5VIpoeAfj8TMEGRBFg-gaZWz94ePR1yxTKzScHakH4F4wcMEyL0vNE-yW_u4pOl9E-hAalPa2tFv4fCVNMMkmKwcf0gm9wNFWXGakVQ8wER4iUg33MyUGOWj2RGX1zlZxCdFoZRtshLx8xcpL3F5Hlh6m8MqIAowWtusTf5TtYMXFlPaWLQgRXvoOlLZ-muzEuutsZRu-agdOptnUiAZ74e8BgaKN8KNEZ2SqP6vE4w16mgGHQjEPUKz9exxcsnbLru6hZdTDvXbX9IduabyvHy8vQRZsqlE9lTiOOOC9jwh27TXsD05HAXmNYiR6voekzEvfS88vnot2Q",
  },
];

declare const GOOGLE_CLIENT_SECRET: string;

const authOptions: AuthOptions = {
  clientId:
    "804405641493-mcs851cmajqo8edi72ndiaophfg78bgb.apps.googleusercontent.com",
  redirectUri: "https://humla.ericselin.workers.dev/oauth2",
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  clientSecret: GOOGLE_CLIENT_SECRET,
};

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

declare const ACTIONS: KVNamespace;

const userActionsGetter: UserActionsGetter = async (userId) => {
  const actions = await ACTIONS.get(userId, "json");
  if (!actions) return [];
  return actions as Promise<Action[]>;
};

const userActionsSaver: UserActionsSaver = (actions) =>
  async (userId) => {
    await ACTIONS.put(userId, JSON.stringify(actions));
  };

const userIdGetter = getUserIdGetter(jwks, authOptions.clientId);

const listActions = getServerActionLister(
  userIdGetter,
  userActionsGetter,
);

const saveActions = getServerActionSaver(
  userIdGetter,
  userActionsSaver,
);

const handleAssetRequest: RequestHandler = getAssetFromKV;

const mainEventListener = getMainEventListener({
  listActions,
  saveActions,
  handleAssetRequest,
});

type ServerOnlyRoutes = {
  [methodAndPath: string]: (event: FetchEvent) => Promise<Response>;
};

const errorResponse = (error: Error): Response =>
  new Response(
    JSON.stringify(error, undefined, 2),
    { status: 500 },
  );

const serverRoutes: ServerOnlyRoutes = {
  "POST:/api/actions.json": (event) =>
    Promise.resolve(event.request)
      .then((req) => req.json() as Promise<Action[]>)
      .then((actions) => saveActions(actions, event))
      .then(() => new Response(undefined, { status: 204 }))
      .catch(errorResponse),

  "GET:/api/actions.json": (event) =>
    Promise.resolve(event.request)
      .then(listActions)
      .then((actions) =>
        new Response(JSON.stringify(actions), {
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .catch(errorResponse),
  "GET:/login": redirectToGooleAuth(authOptions),
  "GET:/oauth2": redirectToRootWithTokenCookie(authOptions),
};

const getMethodAndPath = (event: FetchEvent) =>
  `${event.request.method}:${new URL(event.request.url).pathname}`;

// add server-only routes
self.addEventListener("fetch", (event) => {
  const methodAndPath = getMethodAndPath(event);
  if (methodAndPath in serverRoutes) {
    event.respondWith(serverRoutes[methodAndPath](event));
  }
});

self.addEventListener("fetch", mainEventListener);
