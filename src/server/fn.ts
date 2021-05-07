type PromiseOrValue<T> = Promise<T> | PromiseLike<T> | T;

type MapCallback<T = any> = (
  value: T,
  index?: number,
  array?: T[],
) => PromiseOrValue<any>;

type FirstArgType<T> = T extends (arg: infer A, ...rest: any[]) => any ? A
  : never;

type Then<T> = T extends PromiseLike<infer U> ? U : T;
type Await<T extends (...args: any) => any> = Then<ReturnType<T>>;

export const map = <T extends MapCallback>(fn: T) =>
  (arr: FirstArgType<T>[]): Promise<Await<T>[]> => Promise.all(arr.map(fn));

export const log = (description: string, logValue: boolean = true) =>
  <T extends any>(input: T) => {
    console.log(description);
    if (logValue) console.log(input);
    return input;
  };

export const ifEquals = (
  condition: unknown,
  ifValueOrFn: unknown,
  elseValueOrFn: unknown,
) =>
  (input: unknown) => {
    if (input === condition) {
      return typeof ifValueOrFn === "function"
        ? ifValueOrFn(input)
        : ifValueOrFn;
    } else {
      return typeof elseValueOrFn === "function"
        ? elseValueOrFn(input)
        : elseValueOrFn;
    }
  };
