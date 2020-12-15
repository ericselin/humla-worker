import { assertEquals } from "https://deno.land/std@0.81.0/testing/asserts.ts";
import { FakeTime } from "https://deno.land/x/mock@v0.9.2/time.ts";

import { parseDate, sunday, thisMonday, today } from "./dates.ts";

Deno.test("returns today", () => {
  const time = new FakeTime("2019-03-20");
  assertEquals(today(), "2019-03-20");
  time.restore();
});

Deno.test("returns correct this monday", () => {
  const time = new FakeTime("2019-03-29");
  assertEquals(thisMonday(), "2019-03-25");
  time.restore();
});

Deno.test("returns correct this monday", () => {
  const time = new FakeTime("2019-03-18");
  assertEquals(thisMonday(), "2019-03-18");
  time.restore();
});

Deno.test("returns correct this monday across month", () => {
  const time = new FakeTime("2019-08-26");
  assertEquals(thisMonday(), "2019-08-26");
  time.restore();
});

Deno.test("returns correct next week across month", () => {
  const time = new FakeTime("2019-08-29");
  assertEquals(parseDate("nw"), "2019-09-08");
  time.restore();
});

const sundayMacro = (input: string, expected: string) =>
  () => {
    const time = new FakeTime(input);
    assertEquals(sunday(), expected);
    time.restore();
  };

Deno.test("sunday correct today", sundayMacro("2019-03-20", "2019-03-24"));
Deno.test("sunday today on sunday", sundayMacro("2019-03-24", "2019-03-24"));
Deno.test("sunday correct on monday", sundayMacro("2019-03-25", "2019-03-31"));
Deno.test(
  "sunday correct across month",
  sundayMacro("2019-02-28", "2019-03-03"),
);

const date = (input: string, expected: string) =>
  () => {
    const time = new FakeTime("2019-03-20");
    assertEquals(parseDate(input), expected);
    time.restore();
  };

Deno.test("parses t", date("t", "2019-03-20"));
Deno.test("parses today", date("today", "2019-03-20"));
Deno.test("parses tm", date("tm", "2019-03-21"));
Deno.test("parses tomorrow", date("tomorrow", "2019-03-21"));
Deno.test("parses tw", date("tw", "2019-03-24"));
Deno.test("parses nw", date("nw", "2019-03-31"));
Deno.test("parses l", date("l", "later"));
Deno.test("parses s", date("s", "someday"));
Deno.test("parses 1.5", date("1.5", "2019-05-01"));

Deno.test("returns string if not parsable", date("something", "something"));
