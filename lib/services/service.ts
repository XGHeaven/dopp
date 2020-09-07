import { App } from "../app.ts";
import { Yargs } from "../deps.ts";
import { DoppBedRock } from "../bedrock.ts";

export abstract class Service<O, C = any> {
  constructor(public bedrock: DoppBedRock, public config?: C) {
  }

  abstract process(app: App, options: O): void | Promise<void>;

  validate?(options: O): boolean;

  command?(yargs: Yargs.YargsType): Yargs.YargsType;
}
