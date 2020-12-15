// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

// This is a specialised implementation of a System module loader.

"use strict";

// @ts-nocheck
/* eslint-disable */
let System, __instantiate;
(() => {
  const r = new Map();

  System = {
    register(id, d, f) {
      r.set(id, { d, f, exp: {} });
    },
  };
  async function dI(mid, src) {
    let id = mid.replace(/\.\w+$/i, "");
    if (id.includes("./")) {
      const [o, ...ia] = id.split("/").reverse(),
        [, ...sa] = src.split("/").reverse(),
        oa = [o];
      let s = 0,
        i;
      while ((i = ia.shift())) {
        if (i === "..") s++;
        else if (i === ".") break;
        else oa.push(i);
      }
      if (s < sa.length) oa.push(...sa.slice(s));
      id = oa.reverse().join("/");
    }
    return r.has(id) ? gExpA(id) : import(mid);
  }

  function gC(id, main) {
    return {
      id,
      import: (m) => dI(m, id),
      meta: { url: id, main },
    };
  }

  function gE(exp) {
    return (id, v) => {
      const e = typeof id === "string" ? { [id]: v } : id;
      for (const [id, value] of Object.entries(e)) {
        Object.defineProperty(exp, id, {
          value,
          writable: true,
          enumerable: true,
        });
      }
      return v;
    };
  }

  function rF(main) {
    for (const [id, m] of r.entries()) {
      const { f, exp } = m;
      const { execute: e, setters: s } = f(gE(exp), gC(id, id === main));
      delete m.f;
      m.e = e;
      m.s = s;
    }
  }

  async function gExpA(id) {
    if (!r.has(id)) return;
    const m = r.get(id);
    if (m.s) {
      const { d, e, s } = m;
      delete m.s;
      delete m.e;
      for (let i = 0; i < s.length; i++) s[i](await gExpA(d[i]));
      const r = e();
      if (r) await r;
    }
    return m.exp;
  }

  function gExp(id) {
    if (!r.has(id)) return;
    const m = r.get(id);
    if (m.s) {
      const { d, e, s } = m;
      delete m.s;
      delete m.e;
      for (let i = 0; i < s.length; i++) s[i](gExp(d[i]));
      e();
    }
    return m.exp;
  }
  __instantiate = (m, a) => {
    System = __instantiate = undefined;
    rF(m);
    return a ? gExpA(m) : gExp(m);
  };
})();

System.register("actions", [], function (exports_1, context_1) {
    "use strict";
    var getActions, saveActions, processActionInput, saveAction;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [],
        execute: function () {
            exports_1("getActions", getActions = async () => {
                const cache = await caches.open("v1");
                const response = await cache.match("/actions.json");
                return response?.json();
            });
            saveActions = async (actions) => {
                const cache = await caches.open("v1");
                return cache.put("/actions.json", new Response(JSON.stringify(actions)));
            };
            exports_1("processActionInput", processActionInput = (input) => {
                const action = {
                    id: input.id ? Number.parseInt(input.id) : 999,
                    body: input.body,
                    context: "[n/a]",
                    title: "[n/a]",
                    date: "[n/a]",
                    tags: ["[n/a]"],
                };
                if (input.done)
                    action.done = true;
                return action;
            });
            exports_1("saveAction", saveAction = async (input) => {
                const action = processActionInput(input);
                const actions = await getActions();
                const index = actions.findIndex((a) => a.id === action.id);
                if (~index) {
                    actions[index] = action;
                }
                else {
                    actions.push(action);
                }
                console.log("saving", action, actions);
                return saveActions(actions);
            });
        }
    };
});
System.register("page", [], function (exports_2, context_2) {
    "use strict";
    var renderPage;
    var __moduleName = context_2 && context_2.id;
    return {
        setters: [],
        execute: function () {
            exports_2("renderPage", renderPage = ({ list, }) => `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Humla App - Simple but powerful todo manager</title>
  <script src="/app.js"></script>
</head>

<body>
  <h1>Humla App</h1>
  <header>
    <nav>
      <h2>Dates</h2>
      <ul>
        <li><a href="/unprocessed">Unprocessed</a></li>
        <li><a href="/today">Today</a></li>
        <li><a href="/week">This Week</a></li>
        <li><a href="/later">Later</a></li>
        <li><a href="/someday">Someday</a></li>
      </ul>
    </nav>
  </header>
  <main>
    <h2>Todays actions</h2>
    <ul>${list.map((group, ig) => `
      <li>
        <h3>${group.heading}</h3>
        <ul>${group.children.map((action, ia) => `
          <li>
            <form method="post" action="/actions.json">
              <input type="hidden" name="id" value="${action.id}">
              <details>
                  <summary>
                    <input type="checkbox" name="done"${action.done ? " checked" : ""}>
                    ${action.title}
                    ${action.tags.map((tag) => `<i>${tag}</i>`).join(" ")} 
                    <strong><time>${action.date}</time></strong>
                  </summary>
                  <textarea name="body" cols="50" rows="5">${action.body}</textarea>
                  <input type="submit" value="Save"/>
              </details>
            </form>
          </li>`).join("")}
        </ul>
      </li>`).join("")}
    </ul>
  </main>
  <aside>
    <form method="post" action="/actions.json">
      <h2>Add new action</h2>
      <p>
        Add a new action here. Use <code>#tag</code> to add tags and <code>@context</code> to add a context to your
        actions.
      </p>
      <p>
        New actions will go under <i>Unprocessed</i> unless you set a date for them.
        Use e.g. <code>!today</code> or <code>!15.12</code> to add dates from here.
      </p>
      <textarea name="body" cols="50" rows="5"></textarea>
      <input type="submit" value="Create"/>
    </form>
  </aside>
  <footer>
    <nav>
      <h2>Contexts</h2>
      <ul>
        <li><a href="/contexts/brf">@brf</a></li>
        <li><a href="/contexts/personal">@personal</a></li>
        <li><a href="/contexts/work">@work</a></li>
      </ul>
      <h2>Tags</h2>
      <ul>
        <li><a href="/tags/home">#home</a></li>
        <li><a href="/tags/errands">#errands</a></li>
        <li><a href="/tags/knackis">#knackis</a></li>
        <li><a href="/tags/bank">#bank</a></li>
        <li><a href="/tags/mini">#mini</a></li>
      </ul>
    </nav>
  </footer>
</body>

</html>
`);
        }
    };
});
System.register("sw", ["page", "actions"], function (exports_3, context_3) {
    "use strict";
    var page_ts_1, actions_ts_1, groupBy, handleAssetRequest, handlePageRequest, handleFormRequest, handleRequest, populateCache;
    var __moduleName = context_3 && context_3.id;
    return {
        setters: [
            function (page_ts_1_1) {
                page_ts_1 = page_ts_1_1;
            },
            function (actions_ts_1_1) {
                actions_ts_1 = actions_ts_1_1;
            }
        ],
        execute: function () {
            groupBy = (field) => (actions) => {
                if (field !== "context")
                    throw new Error("Not implemented");
                const groupMap = actions.reduce((map, action) => {
                    if (!map[action.context]) {
                        map[action.context] = {
                            heading: action.context,
                            children: [],
                        };
                    }
                    map[action.context].children.push(action);
                    return map;
                }, {});
                return Object.values(groupMap);
            };
            handleAssetRequest = async (request) => {
                return await caches.match(request) || fetch(request);
            };
            handlePageRequest = async (request) => {
                const list = await Promise
                    .resolve()
                    .then(actions_ts_1.getActions)
                    .then(groupBy("context"));
                return new Response(page_ts_1.renderPage({ list }), {
                    headers: {
                        "Content-Type": "text/html",
                    },
                });
            };
            handleFormRequest = async (request) => {
                const form = await request.formData();
                const id = form.get("id");
                const done = form.get("done");
                const body = form.get("body");
                if (id && typeof id !== "string") {
                    throw new Error("Wrong id");
                }
                if (typeof body !== "string" || !body) {
                    throw new Error("Wrong body");
                }
                if (done && typeof done !== "string") {
                    throw new Error("Wrong body");
                }
                await actions_ts_1.saveAction({
                    id,
                    done,
                    body,
                });
                return new Response(`Redirecting to ${request.referrer}`, { status: 302, headers: { "Location": request.referrer } });
                throw new Error("Not implemented");
            };
            handleRequest = async (request) => {
                const url = new URL(request.url);
                if (request.method === "GET" && !url.pathname.includes(".")) {
                    return handlePageRequest(request);
                }
                else if (request.method === "POST") {
                    return handleFormRequest(request);
                }
                return handleAssetRequest(request);
            };
            self.addEventListener("fetch", (event) => {
                event.respondWith(handleRequest(event.request));
            });
            populateCache = async () => {
                const cache = await caches.open("v1");
                return cache.addAll([
                    "/app.js",
                    "actions.json",
                ]);
            };
            self.addEventListener("install", (event) => {
                event.waitUntil(populateCache());
            });
        }
    };
});

__instantiate("sw", false);
