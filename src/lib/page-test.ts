import { renderPage } from "./page.ts";

const getFileResponse = async (url: string) => {
  let file = "";
  try {
    file = await Deno.readTextFile(`../client${url}`);
  } catch {
    console.log(url, "not found");
  }
  return new Response(file);
};

async function handle(conn: Deno.Conn) {
  const httpConn = Deno.serveHttp(conn);
  for await (const requestEvent of httpConn) {
    const { url } = requestEvent.request;
    console.log("Requested", url);
    if (url.includes(".")) {
      requestEvent.respondWith(getFileResponse(url));
    } else {
      const page = renderPage({
        list: { heading: "Test", children: [
          { title: 'Do this thing now', id: '', tags: ['#tag'], body: 'Do this thing now\n#tag here' }
        ] },
        tags: [],
        contexts: [],
      });
      requestEvent.respondWith(new Response(page));
    }
  }
}

const server = Deno.listen({ port: 8080 });

console.log("Listening on http://localhost:8080");

for await (const conn of server) {
  handle(conn);
}
