import { App } from "../app.ts";
import { Yargs, path, fs } from "../deps.ts";
import { DoppBedRock } from "../bedrock.ts";
import { createAppSSSCommand } from "../commands/app.ts";

export type ServiceCreator<C, O> = (context: ServiceContext<C>) => Service<O>;

export interface Service<O> {
  process(app: App, options: O): void | Promise<void>;

  validate?(options: O): boolean;

  command?(yargs: Yargs.YargsType): Yargs.YargsType;
}

export class ServiceContext<C extends Record<any, any>> {
  // service storage directory
  storeDir: string;
  #config!: C;
  #configPath: string;

  constructor(public readonly bedrock: DoppBedRock, private name: string) {
    this.storeDir = path.join(this.bedrock.serviceDir, name);
    this.#configPath = path.join(this.storeDir, "config.json");
    fs.ensureDirSync(this.storeDir);
  }

  getConfig<K extends keyof C>(key: K, defaultValue: C[K]): Promise<C[K]>;
  getConfig<K extends keyof C>(key: K): Promise<C[K] | undefined>;
  async getConfig<K extends keyof C>(
    key: K,
    defaultValue?: C[K],
  ): Promise<C[K] | undefined> {
    if (!this.#config) {
      this.#config = await fs.exists(this.#configPath)
        ? await fs.readJson(this.#configPath) as C
        : {} as C;
    }
    return this.#config[key] ?? defaultValue;
  }

  async setConfig<K extends keyof C>(key: K, value: C[K]): Promise<void> {
    this.#config[key] = value;
    await fs.writeJson(this.#configPath, this.#config);
  }

  registeProcessCommand(yargs: Yargs.YargsType, appid: string) {
    return createAppSSSCommand(this.bedrock, yargs, appid);
  }
}
