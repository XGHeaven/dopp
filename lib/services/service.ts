import { App } from "../app.ts";
import { Yargs, path, fs } from "../deps.ts";
import { DoppBedRock } from "../bedrock.ts";
import { createAppSSSCommand } from "../commands/app.ts";
import { mapValues } from "../utils.ts";
import { ConfigController } from "../config.ts";

export type ServiceCreator<C, O> = (context: ServiceContext<C>) => Service<O>;

export interface Service<O> {
  process?(app: App, options: O): void | Promise<void>;

  validate?(options: O): boolean;

  command?(yargs: Yargs.YargsType): Yargs.YargsType;
}

interface ConfigSchema {
  delegate?: string;
  description: string;
  type?: string;
  onGet?(): any;
  onSet?(value: any): void;
  onDel?(): void;
}

export class ServiceContext<C extends Record<any, any>> {
  // service storage directory
  storeDir: string = path.join(this.bedrock.serviceDir, this.name);

  #controller: ConfigController<C> = new ConfigController(
    this.storeDir,
    "config",
  );

  constructor(public readonly bedrock: DoppBedRock, private name: string) {
  }

  getConfig = this.#controller.get.bind(this.#controller);
  setConfig = this.#controller.set.bind(this.#controller);
  delConfig = this.#controller.del.bind(this.#controller);

  registeProcessCommand(yargs: Yargs.YargsType, appid: string) {
    return createAppSSSCommand(this.bedrock, yargs, appid);
  }

  getConfigCommand<T extends Record<string, ConfigSchema>>(
    configSchemas: T,
  ) {
    const normalBuilder = mapValues<T, ConfigSchema, any>(
      configSchemas,
      (schema) =>
        Object.assign({ type: "string", group: "Configs:" }, { ...schema }),
    );
    const booleanBuilder = mapValues<T, ConfigSchema, any>(
      configSchemas,
      (
        schema,
      ) => (Object.assign(
        { group: "Configs:" },
        { ...schema, type: "boolean" },
      )),
    );
    booleanBuilder["all"] = {
      type: "boolean",
      description: "Display all configs",
      alias: ["a"],
    };
    return {
      command: "config",
      description: "Config management",
      builder: (yargs: Yargs.YargsType) =>
        yargs
          .demandCommand()
          .command(
            "set",
            "Set config",
            normalBuilder,
            async (config: any) => {
              for (const key of Object.keys(configSchemas)) {
                if (key in config) {
                  // 命中更新
                  const value = config[key];
                  const schema = configSchemas[key];
                  if (schema.delegate) {
                    // TODO: 性能优化，避免多次写入配置文件
                    await this.setConfig(schema.delegate, value);
                  }

                  if (schema.onSet) {
                    await schema.onSet(value);
                  }
                }
              }
            },
          )
          .command("get", "Get config", booleanBuilder, async (config: any) => {
            const ret: Record<string, any> = {};
            for (const key of Object.keys(configSchemas)) {
              if ((config[key]) || config["all"]) {
                const schema = configSchemas[key];
                if (schema.delegate) {
                  ret[key] = await this.getConfig(schema.delegate);
                } else if (schema.onGet) {
                  ret[key] = await schema.onGet();
                } else {
                  ret[key] = new Error("Cannot get value of " + key);
                }
              }
            }

            console.table(ret);
          })
          .command(
            "del",
            "Delete config",
            booleanBuilder,
            async (config: any) => {
              for (const key of Object.keys(configSchemas)) {
                if (key in config && config[key]) {
                  const schema = configSchemas[key];
                  if (schema.delegate) {
                    await this.delConfig(schema.delegate);
                  } else if (schema.onDel) {
                    await schema.onDel();
                  } else {
                    console.error("Cannot delete value of " + key);
                  }
                }
              }
            },
          ),
    };
  }
}
