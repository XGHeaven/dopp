import { fs, path, YAML, Ajv } from "./deps.ts";

type ExtType = "yaml" | "yml" | "json";

const stringify: Record<ExtType, (v: any) => string> = {
  yaml: (v) => YAML.stringify(v),
  yml: (v) => YAML.stringify(v),
  json: (v) => JSON.stringify(v, null, 2),
};

const parse: Record<ExtType, (v: string) => any> = {
  yaml: (v) => YAML.parse(v),
  yml: (v) => YAML.parse(v),
  json: (v) => JSON.parse(v),
};

export class ConfigController<C extends Record<string, any>> {
  #config: any;
  #ext!: ExtType;
  #configPath!: string;

  constructor(
    public folder: string,
    public name: string,
    private schema?: any,
  ) {
  }

  get<K extends keyof C>(key: K, defaultValue: C[K]): Promise<C[K]>;
  get<K extends keyof C>(key: K): Promise<C[K] | undefined>;
  async get<K extends keyof C>(
    key: K,
    defaultValue?: C[K],
  ): Promise<C[K] | undefined> {
    if (!this.#config) {
      await this.init();
    }
    return this.#config[key] ?? defaultValue;
  }

  async set<K extends keyof C>(key: K, value: C[K]): Promise<void> {
    if (!this.#config) {
      await this.init();
    }
    this.#config[key] = value;
    await this.save();
  }

  async del<K extends keyof C>(key: K): Promise<void> {
    if (!this.#config) {
      await this.init();
    }
    delete this.#config[key];
    await this.save();
  }

  private async init() {
    if (!this.#configPath) {
      await this.initConfigPath();
    }

    this.#config = (await fs.exists(this.#configPath))
      ? ((parse[this.#ext](await Deno.readTextFile(this.#configPath))))
      : ({} as C);

    if (this.schema) {
      new Ajv().validate(this.schema, this.#config);
    }
  }

  private async initConfigPath() {
    const exts: ExtType[] = ["yml", "yaml", "json"];

    for (const ext of exts) {
      const configPath = path.join(this.folder, `${this.name}.${ext}`);
      if (await fs.exists(configPath)) {
        this.#configPath = configPath;
        this.#ext = ext;
        return;
      }
    }

    this.#configPath = path.join(this.folder, `${this.name}.yml`);
    this.#ext = "yml";
  }

  private async save() {
    // 保存的时候也需要验证一次，避免写入不合法的数据
    if (this.schema) {
      new Ajv().validate(this.schema, this.#config);
    }
    await fs.ensureDir(this.folder);
    await Deno.writeTextFile(
      this.#configPath,
      stringify[this.#ext](this.#config),
    );
  }
}
