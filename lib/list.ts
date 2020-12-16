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
