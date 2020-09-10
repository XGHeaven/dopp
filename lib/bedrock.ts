import { fs, path, Ajv } from "./deps.ts";
import { Schema } from "./schema/app-config-schema.ts";
import { DoppConfig } from "./schema/dopp-config.ts";
import { ServiceHub } from "./services/hub.ts";
import { AppHub } from "./app.ts";

// Dopp 基岩
export class DoppBedRock implements Required<DoppConfig> {
  #serviceHub!: ServiceHub;
  #appHub!: AppHub;

  readonly appsDir: string;
  readonly serviceDir: string;

  readonly defaultNetwork: string = "dopp";
  readonly dockerEndpoint: string = "unix:///var/run/docker.sock";
  readonly services: string[] = [];
  readonly configPath: string;

  get serviceHub() {
    return this.#serviceHub;
  }

  get appHub() {
    return this.#appHub;
  }

  constructor(public readonly root: string) {
    this.appsDir = path.join(this.root, "apps");
    this.serviceDir = path.join(this.root, "services");
    this.configPath = path.join(this.root, "config.json");

    const config = fs.existsSync(this.configPath)
      ? fs.readJsonSync(this.configPath)
      : {};

    new Ajv().validate(Schema, config);

    Object.assign(this, config);
  }

  async prepare() {
    this.#serviceHub = await ServiceHub.create(this);
    this.#appHub = new AppHub(this);
  }

  getAppDir(appid: string) {
    return path.join(this.appsDir, appid);
  }
}
