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
<form method="post" action="/upsert">
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
  <style>
    :root {
      --nord0: #2e3440;
      --nord1: #3b4252;
      --nord2: #434c5e;
      --nord3: #4c566a;
      --nord4: #d8dee9;
      --nord5: #e5e9f0;
      --nord6: #eceff4;
      --nord7: #8fbcbb;
      --nord8: #88c0d0;
      --nord9: #81a1c1;
      --nord10: #5e81ac;
      --nord11: #bf616a;
      --nord12: #d08770;
      --nord13: #ebcb8b;
      --nord14: #a3be8c;
      --nord15: #b48ead;

      --margin: 1rem;
      --max-width: min(600px, 100% - 4 * var(--margin));

      --color-bg: var(--nord0);
      --color-fg: var(--nord6);
      --color-body: var(--nord1);
      --color-indent: var(--nord3);
      --color-muted: var(--nord4);
      --color-accent: var(--nord8);

      --font-text: 'Inter', sans-serif;
      --font-heading: 'Source Code Pro', monospace;
      --font-mono: 'Source Code Pro', monospace;
    }

    @media (min-width: 500px) {
      :root {
        --margin: 1.5rem;
      }
    }

    @media (min-width: 768px) {
      :root {
        --margin: 2rem;
      }
    }

    body {
      padding: 0;
      margin: 0;
      font-family: var(--font-text);
      background: var(--color-body);
      color: var(--color-fg);
    }

    body > header {
      margin: var(--margin);
      color: var(--color-muted);
      font-family: var(--font-heading);
    }

    body > header > a {
      text-decoration: none;
      font-weight: 900;
      font-size: 2rem;
      background: var(--color-accent);
      width: 2rem;
      height: 2rem;
      line-height: 1.5rem;
      text-align: center;
      border-radius: 25%;
      color: var(--color-body);
    }

    body > header > a:hover {
      color: var(--color-bg);
    }

    body > header ul {
      display: flex;
      list-style: none;
      justify-content: center;
      padding: 0;
      margin: 0;
    }

    body > header li + li {
      margin-left: 1rem;
    }

    body > h1 {
      margin: var(--margin);
      color: var(--color-muted);
      font-family: var(--font-heading);
      font-size: 1rem;
      text-align: center;
    }

    main {
      max-width: var(--max-width);
      margin: var(--margin) auto;
      padding: 0 var(--margin);
      background: var(--color-bg);
      border-radius: 1rem;
      line-height: 1.25;
    }

    main::before,
    main::after {
      content: ' ';
      display: block;
      contain: layout;
      margin: var(--margin) 0;
    }

    aside {
      display: none;
    }

    h1 a,
    h2 a,
    h3 a,
    h4 a,
    h5 a,
    h6 a {
      text-decoration: none;
    }

    a {
      color: inherit;
      transition: color ease-in 200ms;
    }

    a:hover {
      color: var(--color-accent);
    }

    code {
      font-family: var(--font-mono);
      line-height: initial;
    }

    .button-link {
      border: 1px solid var(--color-accent);
      border-radius: 0.5rem;
      padding: 0.5rem 1rem;
      display: inline-block;
      text-decoration: none;
    }

    body > footer {
      margin: var(--margin);
      text-align: center;
      color: var(--color-muted);
      font-family: var(--font-heading);
    }
  </style>
</head>

<body>
  <h1>Humla App</h1>
  <header>
    <nav>
      <ul>
        <li><a href="/unprocessed">Unprocessed</a></li>
        <li><a href="/">Today</a></li>
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
    <form method="post" action="/upsert">
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
