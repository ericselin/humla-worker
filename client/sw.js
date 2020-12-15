const processActionInput = (input)=>{
    const action = {
        id: input.id ? Number.parseInt(input.id) : 999,
        body: input.body,
        context: "[n/a]",
        title: "[n/a]",
        date: "[n/a]",
        tags: [
            "[n/a]"
        ]
    };
    if (input.done) action.done = true;
    return action;
};
const getActionSaver = (getActions, saveActions)=>async (input)=>{
        const action = processActionInput(input);
        const actions = await getActions();
        const index = actions.findIndex((a)=>a.id === action.id
        );
        if (~index) {
            actions[index] = action;
        } else {
            actions.push(action);
        }
        console.log("saving", action, actions);
        return saveActions(actions);
    }
;
const renderPage = ({ list ,  })=>`\n<!DOCTYPE html>\n<html lang="en">\n\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Humla App - Simple but powerful todo manager</title>\n  <script src="/app.js"></script>\n</head>\n\n<body>\n  <h1>Humla App</h1>\n  <header>\n    <nav>\n      <h2>Dates</h2>\n      <ul>\n        <li><a href="/unprocessed">Unprocessed</a></li>\n        <li><a href="/today">Today</a></li>\n        <li><a href="/week">This Week</a></li>\n        <li><a href="/later">Later</a></li>\n        <li><a href="/someday">Someday</a></li>\n      </ul>\n    </nav>\n  </header>\n  <main>\n    <h2>Todays actions</h2>\n    <ul>${list.map((group, ig)=>`\n      <li>\n        <h3>${group.heading}</h3>\n        <ul>${group.children.map((action, ia)=>`\n          <li>\n            <form method="post" action="/actions.json">\n              <input type="hidden" name="id" value="${action.id}">\n              <details>\n                  <summary>\n                    <input type="checkbox" name="done"${action.done ? " checked" : ""}>\n                    ${action.title}\n                    ${action.tags.map((tag)=>`<i>${tag}</i>`
            ).join(" ")} \n                    <strong><time>${action.date}</time></strong>\n                  </summary>\n                  <textarea name="body" cols="50" rows="5">${action.body}</textarea>\n                  <input type="submit" value="Save"/>\n              </details>\n            </form>\n          </li>`
        ).join("")}\n        </ul>\n      </li>`
    ).join("")}\n    </ul>\n  </main>\n  <aside>\n    <form method="post" action="/actions.json">\n      <h2>Add new action</h2>\n      <p>\n        Add a new action here. Use <code>#tag</code> to add tags and <code>@context</code> to add a context to your\n        actions.\n      </p>\n      <p>\n        New actions will go under <i>Unprocessed</i> unless you set a date for them.\n        Use e.g. <code>!today</code> or <code>!15.12</code> to add dates from here.\n      </p>\n      <textarea name="body" cols="50" rows="5"></textarea>\n      <input type="submit" value="Create"/>\n    </form>\n  </aside>\n  <footer>\n    <nav>\n      <h2>Contexts</h2>\n      <ul>\n        <li><a href="/contexts/brf">@brf</a></li>\n        <li><a href="/contexts/personal">@personal</a></li>\n        <li><a href="/contexts/work">@work</a></li>\n      </ul>\n      <h2>Tags</h2>\n      <ul>\n        <li><a href="/tags/home">#home</a></li>\n        <li><a href="/tags/errands">#errands</a></li>\n        <li><a href="/tags/knackis">#knackis</a></li>\n        <li><a href="/tags/bank">#bank</a></li>\n        <li><a href="/tags/mini">#mini</a></li>\n      </ul>\n    </nav>\n  </footer>\n</body>\n\n</html>\n`
;
const groupBy = (field)=>(actions)=>{
        if (field !== "context") throw new Error("Not implemented");
        const groupMap = actions.reduce((map, action)=>{
            if (!map[action.context]) {
                map[action.context] = {
                    heading: action.context,
                    children: []
                };
            }
            map[action.context].children.push(action);
            return map;
        }, {
        });
        return Object.values(groupMap);
    }
;
const getPageHandler = (getActions)=>async (request)=>{
        const list = await Promise.resolve().then(getActions).then(groupBy("context"));
        return new Response(renderPage({
            list
        }), {
            headers: {
                "Content-Type": "text/html"
            }
        });
    }
;
const getSaveHandler = (saveAction)=>async (request)=>{
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
        await saveAction({
            id,
            done,
            body
        });
        return new Response(`Redirecting to ${request.referrer}`, {
            status: 302,
            headers: {
                "Location": request.referrer
            }
        });
    }
;
const getMainHandler = ({ handleAsset , handlePage , handleSave  })=>async (request)=>{
        const url = new URL(request.url);
        if (request.method === "GET" && !url.pathname.includes(".")) {
            return handlePage(request);
        } else if (request.method === "POST") {
            return handleSave(request);
        }
        return handleAsset(request);
    }
;
const listActions = async ()=>{
    const cache = await caches.open("v1");
    const response = await cache.match("/actions.json");
    return response?.json();
};
const saveActions = async (actions)=>{
    const cache = await caches.open("v1");
    return cache.put("/actions.json", new Response(JSON.stringify(actions)));
};
const handleAssetRequest = async (request)=>{
    return await caches.match(request) || fetch(request);
};
const handleRequest = getMainHandler({
    handlePage: getPageHandler(listActions),
    handleSave: getSaveHandler(getActionSaver(listActions, saveActions)),
    handleAsset: handleAssetRequest
});
self.addEventListener("fetch", (event)=>{
    event.respondWith(handleRequest(event.request));
});
const populateCache = async ()=>{
    const cache = await caches.open("v1");
    return cache.addAll([
        "/app.js",
        "actions.json", 
    ]);
};
self.addEventListener("install", (event)=>{
    event.waitUntil(populateCache());
});
