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

### Todo for RC

- [x] make shared sw routes explicit and return undefined / 404 if not found
- [x] add fallback on client to server routes (for e.g. /login)
- [x] refresh actions from server at some point
- [ ] make action cache strategy
- [ ] handle expired tokens
- [ ] create login status and link in html
- [ ] make it clear that checking an item requires save
- [ ] style page
- [ ] create mechanism for refreshing discovery document
- [ ] create logout
- [ ] fix firefox class error (ditch uuid module)

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

### Deployment

On Windows, just run `publish.ps1`.