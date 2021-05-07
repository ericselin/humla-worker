import { assertEquals } from "https://deno.land/std@0.81.0/testing/asserts.ts";
import { linkList } from "./list.ts";

const emptyAction: Action = {
  id: "",
  body: "",
  tags: [],
  title: "",
};

Deno.test("link list doesn't include completed actions", () => {
  assertEquals(
    linkList("context")([
      { ...emptyAction, context: "@context" },
      { ...emptyAction, context: "@othercontext", done: "true" },
    ]),
    [{ url: "/contexts/context", text: "@context" }] as Link[],
  );
});
