/// <reference path="../domain.d.ts" />

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
    "alg": "RS256",
    "use": "sig",
    "kid": "77209104ccd890a5aedd6733e0252f54e882f13c",
    "n": "x7--mXPc9umyDBi1pOK4kKHonfa7-mNmKo10W1iAyHVjAfdM8NDPDRbwazZLLQhBvyAe2DotMbgVFYSWQMhT883w9Kn-2dzoTHlYB1qyd82Coc7jKeHcde54Zjay-8Pzjioa7-Dj7vuNyIHojtJcqDqslWCDfi-Tm-g67cqxaoZ34gDSlhTKFlzoLYufUaVG4lSxNWxV6YiwZshabmngwKFcYJGL4zWhA48oB8cVf9fFT-gtnk1hUJ95VD41jpzWCXPupIQvPRDmiY_mKcmc6GE2YAqABAx30oCflV-UznmlymLGqsUTnJ26OiiIe5zpbivW0Qi7bLwHs-vm-5dS3Q",
    "kty": "RSA",
    "e": "AQAB"
  },
  {
    "e": "AQAB",
    "alg": "RS256",
    "n": "vFRvKlxctMszRPK6iZ9TGW3lLLIvun157Lgb_M3LDBZpNcmnMDgswiIjEODSdclMv_gj6UWpoX7qWFHA-PNi_KQtyZMaDSrpNL3eA5zjbPA3CV6fGaWCBzallSjHo9Z7E9-Kqtn0IMmIcNxADo2RUSoYxb3n8ivjA38m8cnJ_yFEm99LXqBy5ZPhFiPOxNcxGwkkVsjiTUbCcaIb4mk2owD1XjPGmV4EJdICXbyG7e4Lp4jX7MegzEJrDQKoq4mMqVt6fHLuma_GSG7W1gV_Zs71SZ6RufB2LJQMPChg2qyfWeetwsIqAJoxtTxEipjlCT-8-QHV_QQw56MmiK_Txw",
    "use": "sig",
    "kty": "RSA",
    "kid": "69ed57f424491282a18020fd585954b70bb45ae0"
  }
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

// TODO: THIS GETS MOVED BEFORE THE ONES ABOVE, FOR SOME REASON!
// self.addEventListener("fetch", (event) => {
//   event.respondWith(new Response("Not found", { status: 404 }));
// });
