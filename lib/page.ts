/// <reference path="../domain.d.ts" />

type PageRenderer = (options: PageRendererOptions) => string;

const renderGroup = (group: ActionGroup, headingLevel: number) =>
  `
<h${headingLevel}>${group.heading}</h${headingLevel}>${
    group.children.length
      ? `
  <ul>${
        group.children.map(
          (item) =>
            `
    <li>${renderItem(item, headingLevel + 1)}
    </li>`,
        ).join("")
      }
  </ul>`
      : `
  🥳
  <p>No actions here, yay!</p>`
  }`;

const renderAction = (action: Action) =>
  `
<form method="post" action="/actions.json">
  <input type="hidden" name="id" value="${action.id}">
  <details>
      <summary>
        <input type="checkbox" name="done"${action.done ? " checked" : ""}>
        ${action.title}
        ${action.tags.map((tag) => `<i>${tag}</i>`).join(" ")} 
        ${action.date ? `<strong><time>${action.date}</time></strong>` : ""}
      </summary>
      <textarea name="body" cols="50" rows="5">${action.body}</textarea>
      <input type="submit" value="Save"/>
  </details>
</form>
`;

const renderItem = (item: ActionGroup | Action, headingLevel: number): string =>
  "heading" in item ? renderGroup(item, headingLevel) : renderAction(item);

const renderLinkList = (links: Link[], placeholder = "\n") =>
  links.length
    ? `
<ul>${
      links.map((link) =>
        `
  <li><a href="${link.url}">${link.text}</a></li>`
      ).join("")
    }
</ul>`
    : placeholder;

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
    ${renderItem(list, 2)}
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
      <h2>Contexts</h2>${
    renderLinkList(
      contexts,
      `
      <p>
        No contexts found<br>
        Contexts start with an at-sign: <code>@context</code>
      </p>`,
    )
  }
      <h2>Tags</h2>${
    renderLinkList(
      tags,
      `
      <p>
        No tags found<br>
        Tags have the familiar hashtag format: <code>#tag</code>
      </p>`,
    )
  }
    </nav>
  </footer>
</body>

</html>
`;
