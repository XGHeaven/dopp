import { DoppBedRock } from "./bedrock.ts";
import { Ajv, fs, path, YAML } from "./deps.ts";
import {
  AppConfig,
  AppEnv,
  AppEnvType,
  AppNetwork,
  AppVolume,
} from "./schema/app-config.type.ts";
import { Schema } from "./schema/app-config.schema.ts";
import { parseEnv, stringifyEnv } from "./utils.ts";

const DIR_NAME_VOLUME = "volumes";
const DIR_NAME_ENV = "envs";

export enum AppVolumeType {
  Volume = "volume",
  Bind = "bind",
  Private = "private",
}

export class AppHub {
  #ajv = new Ajv();
  #validate = this.#ajv.compile(Schema);
  constructor(private bedrock: DoppBedRock) {
  }

  async getApp(appid: string): Promise<App | null> {
    const appDir = path.join(this.bedrock.appsDir, appid);
    if (!await fs.exists(appDir)) {
      return null;
    }

    const appConfigPath = path.join(appDir, "app.yml");
    if (!await fs.exists(appConfigPath)) {
      return null;
    }

    const appConfig: AppConfig = YAML.parse(
      new TextDecoder().decode(await Deno.readFile(appConfigPath)),
    ) as any;

    const valid = this.#validate(appConfig);

    if (!valid) {
      const [err] = this.#validate.errors!;
      throw new Error(`${err.dataPath} ${err.message}`);
    }

    return await App.create(this.bedrock, appid, appConfig);
  }

  async hasApp(appid: string): Promise<boolean> {
    return await fs.exists(path.join(this.bedrock.appsDir, appid));
  }

  async newApp(
    appid: string,
    appConfig: AppConfig = {},
    force: boolean = false,
  ): Promise<App> {
    const appDir = path.join(this.bedrock.appsDir, appid);
    if (await fs.exists(appDir) && !force) {
      return (await this.getApp(appid))!;
    }

    await Deno.mkdir(appDir, { recursive: true });
    await Deno.writeFile(
      path.join(appDir, "app.yml"),
      new TextEncoder().encode(
        YAML.stringify(appConfig as any, { skipInvalid: true }),
      ),
    );
    return await App.create(this.bedrock, appid, appConfig);
  }

  async updateApp(
    appid: string,
    appConfig: AppConfig = {},
  ): Promise<App | null> {
    const app = await this.getApp(appid);

    if (!app) {
      return null;
    }

    return app.cloneAndUpdate(appConfig);
  }
}

export class App {
  static parseEnv(env: string | AppEnv): AppEnv {
    if (typeof env === "string") {
      if (env.startsWith("@")) {
        return {
          type: AppEnvType.Private,
          name: env.slice(1),
        };
      } else if (env.startsWith(".") || env.startsWith("/")) {
        return {
          type: AppEnvType.File,
          file: env,
        };
      } else {
        const [key, value] = env.split("=");
        return {
          type: AppEnvType.Pair,
          key,
          value,
        };
      }
    } else {
      return env;
    }
  }

  static async create(
    bedrock: DoppBedRock,
    id: string,
    rawConfig: AppConfig,
  ): Promise<App> {
    const env = (rawConfig.env ?? []).map<AppEnv>(App.parseEnv);

    const networks = (rawConfig.networks ?? []).map<AppNetwork>((net) => {
      if (typeof net === "string") {
        if (net === "@") {
          return {
            type: "bridge",
            name: bedrock.defaultNetwork,
            aliases: [id],
          };
        } else {
          return {
            type: "bridge",
            name: net,
            aliases: [],
          };
        }
      } else {
        return net;
      }
    });

    const volumes = (rawConfig.volumes ?? []).map<AppVolume>((volume) => {
      if (typeof volume === "string") {
        const [source, target] = volume.split(":");
        if (!source || source.startsWith("@")) {
          const name = source.slice(1);
          return {
            type: AppVolumeType.Private,
            source: name || "default",
            target,
          };
        } else if (source.startsWith(".") || source.startsWith("/")) {
          return {
            type: AppVolumeType.Bind,
            source,
            target,
          };
        } else {
          return {
            type: AppVolumeType.Volume,
            source,
            target,
          };
        }
      } else {
        return volume;
      }
    });

    let app = new App(bedrock, id, rawConfig, env, networks, volumes);

    await app.loadEnvMap();

    for (const { use, ...options } of rawConfig.services ?? []) {
      const service = await bedrock.serviceHub.get<any>(use);
      if (!service) {
        continue;
      }
      if (service.validate && !service.validate(options)) {
        // TODO: print
        continue;
      }
      await service.process(app, options);
    }

    return app;
  }

  readonly name: string;
  readonly appDir: string;
  readonly volumeDir: string;
  readonly envDir: string;
  readonly labels: string[];
  readonly image: string;
  readonly command?: string | string[];
  readonly entrypoint?: string | string[];

  private envMap: Map<string, Record<string, string>> = new Map();

  get ports() {
    return this.rawConfig.ports ?? [];
  }

  constructor(
    private bedrock: DoppBedRock,
    public readonly id: string,
    public readonly rawConfig: AppConfig,
    public readonly env: AppEnv[],
    public readonly networks: AppNetwork[],
    public readonly volumes: AppVolume[],
  ) {
    this.name = rawConfig.name ?? "unknown";
    this.appDir = path.join(bedrock.appsDir, id);
    this.volumeDir = path.join(this.appDir, DIR_NAME_VOLUME);
    this.envDir = path.join(this.appDir, DIR_NAME_ENV);
    this.labels = rawConfig.labels ?? [];
    this.image = rawConfig.image ?? "";
    this.command = rawConfig.command;
    this.entrypoint = rawConfig.entrypoint;
  }

  toComposeJSON(): any {
    let envMap: any = {};
    let envFiles: string[] = [];

    for (const env of this.env) {
      switch (env.type) {
        case AppEnvType.File:
          envFiles.push(env.file);
          break;
        case AppEnvType.Private:
          envFiles.push(`./${DIR_NAME_ENV}/${env.name}.env`);
          break;
        case AppEnvType.Pair:
          envMap[env.key] = env.value;
          break;
      }
    }

    return {
      ...this.rawConfig._compose,
      version: "3",
      services: {
        default: {
          ...this.rawConfig._compose_service,
          image: this.image,
          hostname: this.id,
          ports: this.ports,
          volumes: this.volumes.map((vol) => {
            if (vol.type === AppVolumeType.Private) {
              return `./volumes/${vol.source}:${vol.target}`;
            }
            if (vol.type === AppVolumeType.Bind) {
              return `${vol.source}:${vol.target}`;
            }
            return vol;
          }),
          networks: this.networks.length === 0
            ? { [this.bedrock.defaultNetwork]: { aliases: [this.id] } }
            : this.networks.reduce<Record<string, any>>((nets, net) => {
              nets[net.name] = {
                aliases: net.aliases,
              };
              return nets;
            }, {}),
          environment: envMap,
          env_file: envFiles,
          labels: this.labels,
          restart: 'unless-stopped',
          ...(this.command ? { command: this.command } : {}),
          ...(this.entrypoint ? { entrypoint: this.entrypoint } : {}),
        },
      },
      networks: this.networks.length === 0
        ? { dopp: { external: true } }
        : this.networks.reduce<Record<string, any>>((nets, net) => {
          nets[net.name] = {
            external: true,
          };
          return nets;
        }, {}),
    };
  }

  getVolumeDir(name: string = "default") {
    return path.join(this.volumeDir, name);
  }

  createEnv(name: string, pairs: Record<string, string>) {
    this.envMap.set(name, pairs);
  }

  appendEnv(env: string | AppEnv) {
    this.env.push(App.parseEnv(env));
  }

  getEnv(name: string) {
    return this.envMap.get(name);
  }

  deleteEnv(name: string) {
    this.envMap.delete(name);
  }

  async loadEnvMap() {
    await fs.ensureDir(this.envDir);
    for await (const envfile of Deno.readDir(this.envDir)) {
      const name = path.basename(envfile.name, ".env");
      const env = new TextDecoder().decode(
        await Deno.readFile(path.join(this.envDir, envfile.name)),
      );
      this.envMap.set(name, parseEnv(env));
    }
  }

  async build() {
    for (const volume of this.volumes) {
      if (volume.type === AppVolumeType.Private) {
        await fs.ensureDir(path.join(this.volumeDir, volume.source));
      }
    }

    await fs.ensureDir(this.envDir);
    for await (const envfile of Deno.readDir(this.envDir)) {
      const name = path.basename(envfile.name, ".env");
      const filepath = path.join(this.envDir, envfile.name);
      if (!this.envMap.has(name)) {
        await Deno.remove(filepath);
      }
    }

    for (const [name, env] of this.envMap.entries()) {
      await Deno.writeFile(
        path.join(this.envDir, `${name}.env`),
        new TextEncoder().encode(stringifyEnv(env)),
      );
    }

    await Deno.writeFile(
      path.join(this.bedrock.appsDir, this.id, "docker-compose.yml"),
      new TextEncoder().encode(YAML.stringify(this.toComposeJSON())),
    );
  }

  /**
   * 克隆之后，原有 app 对象就会失效，需要使用更新之后的对象，否则就会产生混乱
   * @param config
   */
  async cloneAndUpdate(config: AppConfig): Promise<App> {
    const newConfig = {
      ...this.rawConfig,
      ...config,
    };

    await Deno.writeTextFile(
      path.join(this.appDir, "app.yml"),
      YAML.stringify(newConfig),
    );

    return await App.create(this.bedrock, this.id, newConfig);
  }
}
