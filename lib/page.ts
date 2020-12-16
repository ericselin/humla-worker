/// <reference path="../domain.d.ts" />

type PageRenderer = (options: PageRendererOptions) => string;

export const renderPage: PageRenderer = ({
  list,
  autofocus,
  contexts,
  tags,
}) =>
  `
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
        <li><a href="/all">All</a></li>
      </ul>
    </nav>
  </header>
  <main>
    <h2>Todays actions</h2>
    <ul>${
    list.map((group, ig) =>
      `
      <li>
        <h3>${group.heading}</h3>
        <ul>${
        group.children.map((action, ia) =>
          `
          <li>
            <form method="post" action="/actions.json">
              <input type="hidden" name="id" value="${action.id}">
              <details>
                  <summary>
                    <input type="checkbox" name="done"${
            action.done ? " checked" : ""
          }>
                    ${action.title}
                    ${action.tags.map((tag) => `<i>${tag}</i>`).join(" ")} 
                    ${
            action.date ? `<strong><time>${action.date}</time></strong>` : ""
          }
                  </summary>
                  <textarea name="body" cols="50" rows="5">${action.body}</textarea>
                  <input type="submit" value="Save"/>
              </details>
            </form>
          </li>`
        ).join("")
      }
        </ul>
      </li>`
    ).join("")
  }
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
      <textarea name="body" cols="50" rows="5"${
    autofocus === "add" ? " autofocus" : ""
  }></textarea>
      <input type="submit" value="Create"/>
    </form>
  </aside>
  <footer>
    <nav>
      <h2>Contexts</h2>
      <ul>${contexts.map(link => `
        <li><a href="${link.url}">${link.text}</a></li>`).join('')}
      </ul>
      <h2>Tags</h2>
      <ul>${tags.map(link => `
        <li><a href="${link.url}">${link.text}</a></li>`).join('')}
      </ul>
    </nav>
  </footer>
</body>

</html>
`;
