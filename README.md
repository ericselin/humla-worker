# Humla

Todo-app proof-of-concept utilizing workers and other performance optimizations. You might call this - as artists do - a "study" in (service- and edge-) workers, progressive enhancement, and developer experience.

## Objectives

- Unreal performance
  - Near-instant first load and other server rendering => Cloudflare workers
  - Instantaneous subsequent page loads => service workers
  - Installable with offline capability => PWA
  - Persistence to the cloud with minimal latency => Cloudflare KV-store
- Usable with any device
  - Works without JS => business logic both on the edge and in service worker
  - Works without CSS => HTML-first with ideal HTML structure
- Awesome developer experience
  - Clear code structure => TypeScript and Domain Driven Design
  - Code runs everywhere => no globals and sound dependency injection
  - Small and testable functions => one file, one domain; one function, one responsibility; functional where appropriate
  - Minimal tooling required => Deno for bundling and formatting

## Development

The only requirement for developing and building the project is the awesome Deno runtime (one batteries-included executable).

### Routes

Page rendering and form submission routes are shared between client and server. This is what is called the "main handler", and it lives in `lib/sw.ts`. The other files in that folder are built for that handler. This means that the same (service worker) code can be used both on the client and on the Cloudflare worker.

Shared, handled in "main handler" in `lib/sw.ts`.

- GET /x
  Main page routes that render html
  Needs action lister
- GET /x.x
  Asset routes
- POST /upsert
  Saving (or creating) a single action from form data
  Needs action lister (in order to get all actions array) and persister (in order to save array)

Server only, handled in separate fetch event listener on server

- GET /api/actions.json
  Getting all actions json
- POST /api/actions.json
  Saving all actions json
- Login routes
  - GET /login
  - GET /oauth2

### Login flow

The main `/login` route uses the flow [as documented by Google](https://developers.google.com/identity/protocols/oauth2/openid-connect#server-flow). This route should show the account chooser just in case.

If the token has expired (which happens after an hour), the user should be redirected to the `/re-login` page. In this case the [`login_hint`](https://developers.google.com/identity/protocols/oauth2/openid-connect#authenticationuriparameters) needs to be set in order to avoid the account chooser. This of course only if we know the user from before.

For the `/api` routes, we should do the same redirect flow (without account chooser) as in the previous section. This works especially well for the `GET` route. For the `POST` route, we don't want to carry over the whole action array in state. In this case the client needs to re-authenticate (via the redirect flow) and then send the `POST` again.

### Local preview

In one terminal, run `deno bundle --unstable --watch ./server/sw.ts ./server/wrangler/sw.js`.

In another, run `wrangler preview --watch` in the `server/wrangler` directory.

### Deployment

Deploy the client side assets with the `./publish-client.sh` bash script.

Deploy the Worker with `deno bundle ./server/sw.ts ./server/wrangler/sw.js`.

