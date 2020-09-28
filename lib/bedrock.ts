import { fs, path, Ajv } from "./deps.ts";
import { Schema } from "./schema/app-config.schema.ts";
import { DoppConfig } from "./schema/dopp-config.type.ts";
import { ServiceHub } from "./services/hub.ts";
import { AppHub } from "./app.ts";
import { ConfigController } from "./config.ts";

const defaultConfig: Required<DoppConfig> = {
  defaultNetwork: "dopp",
  dockerEndpoint: "unix:///var/run/docker.sock",
  services: [],
  bindHostTimezone: true,
};

// Dopp 基岩
export class DoppBedRock {
  #serviceHub!: ServiceHub;
  #appHub!: AppHub;

  readonly appsDir: string = path.join(this.root, "apps");
  readonly serviceDir: string = path.join(this.root, "services");
  readonly configPath: string = path.join(this.root, "config.json");

  #config = new ConfigController<DoppConfig>(this.root, "config", Schema);

  get serviceHub() {
    return this.#serviceHub;
  }

  get appHub() {
    return this.#appHub;
  }

  constructor(public readonly root: string) {
    const config = fs.existsSync(this.configPath)
      ? fs.readJsonSync(this.configPath)
      : {};

    Object.assign(this, config);
  }

  async getConfig<K extends keyof DoppConfig>(
    key: K,
  ): Promise<Required<DoppConfig>[K]> {
    return this.#config.get(key, defaultConfig[key]) as any;
  }

  setConfig = this.#config.set.bind(this.#config);
  delConfig = this.#config.del.bind(this.#config);

  async prepare() {
    this.#serviceHub = await ServiceHub.create(this);
    this.#appHub = new AppHub(this);
  }

  getAppDir(appid: string) {
    return path.join(this.appsDir, appid);
  }
}
