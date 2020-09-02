import { App } from "../app.ts";
import { Yargs } from "../deps.ts";

export interface Service<O> {
  process(app: App, options: O): App | undefined;
  validate?(options: O): boolean;
  command?(yargs: Yargs.YargsType): Yargs.YargsType;
}
