/// <reference path="../domain.d.ts" />

export const groupBy = <K extends keyof Action>(field: K) =>
  (actions: Action[]): ActionGroup[] => {
    if (field !== "context") throw new Error("Not implemented");
    const groupMap = actions.reduce((map, action) => {
      const context = action.done
        ? "Completed"
        : action.context || "No context";
      if (!map[context]) {
        map[context] = {
          heading: context,
          children: [],
        };
      }
      map[context].children.push(action);
      return map;
    }, {} as { [context: string]: ActionGroup });
    return Object.values(groupMap);
  };

export const linkList = <K extends keyof Pick<Action, "context" | "tags">>(
  field: K,
) =>
  (actions: Action[]): Link[] =>
    actions
      .filter((a) => !a.done)
      .flatMap((a) => a[field] as string | string[])
      .filter((elem, idx, arr) => elem && arr.indexOf(elem) === idx)
      .map((elem) => ({
        url: `/${field}${field.endsWith("s") ? "" : "s"}/${elem?.substring(1)}`,
        text: elem,
      }));
