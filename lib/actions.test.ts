import { assertEquals } from "https://deno.land/std@0.81.0/testing/asserts.ts";
import { getContext, getDate, getTags, getTitle } from "./actions.ts";

Deno.test("gets context", () => {
  assertEquals(getContext("this-a time it's @personal"), "@personal");
});

Deno.test("email is not context", () => {
  assertEquals(getContext("email me@gmail.com @personal"), "@personal");
});

Deno.test("context is undefined if not found", () => {
  assertEquals(getContext("this is just a string"), undefined);
});

Deno.test("context works if in beginning", () => {
  assertEquals(getContext("@this is not just a string"), "@this");
});

Deno.test("gets tags", () => {
  assertEquals(getTags("this has some #tags #here"), ["#tags", "#here"]);
});

Deno.test("tags are empty array if not found", () => {
  assertEquals(getTags("this is just a string"), []);
});

Deno.test("tags work if in the beginning", () => {
  assertEquals(getTags("#this is not just a string"), ["#this"]);
});

Deno.test("dates parsed", () => {
  const dateParser = (str: string) => str;
  assertEquals(getDate(dateParser)("this has a !date"), "date");
});

Deno.test("dates parsed from beginning", () => {
  const dateParser = (str: string) => str;
  assertEquals(getDate(dateParser)("!this has a date"), "this");
});

Deno.test("dates parsed from new line", () => {
  const dateParser = (str: string) => str;
  assertEquals(getDate(dateParser)("this has a date\non a !new line"), "new");
});

Deno.test("date undefined if not set", () => {
  const dateParser = () => {
    throw new Error("should not be called");
  };
  assertEquals(getDate(dateParser)("this has no date"), undefined);
});

Deno.test("gets first line for title", () => {
  assertEquals(getTitle("this is one line"), "this is one line");
  assertEquals(
    getTitle("this is the first\nof two lines"),
    "this is the first",
  );
});
