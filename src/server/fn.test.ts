import { assertEquals } from "https://deno.land/std@0.81.0/testing/asserts.ts";
import { ifEquals } from "./fn.ts";

Deno.test("if equals with values", async () => {
  let actual;

  actual = await Promise.resolve(1)
    .then(ifEquals(1, 2, 3));
  assertEquals(actual, 2);

  actual = await Promise.resolve(0)
    .then(ifEquals(1, 2, 3));
  assertEquals(actual, 3);
});

Deno.test("if equals with functions", async () => {
  let actual;
  const addOne = (input: number) => input + 1;

  actual = await Promise.resolve(1)
    .then(ifEquals(1, addOne, 3));
  assertEquals(actual, 2);

  actual = await Promise.resolve(5)
    .then(ifEquals(1, 2, addOne));
  assertEquals(actual, 6);
});

Deno.test("if equals continue pipe with type", async () => {
  const addOne = (input: number) => input + 1;

  const actual = await Promise.resolve(1)
    .then(ifEquals(1, 5, 0))
    .then(addOne);
  assertEquals(actual, 6);
});
