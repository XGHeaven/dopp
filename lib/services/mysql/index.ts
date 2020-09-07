import { Service } from "../service.ts";
import { App } from "../../app.ts";
import { Yargs } from "../../deps.ts";
import { AppEnvType } from "../../schema/app-config.ts";

export interface MysqlServiceOptions {
  db: string;
  prefix?: string;
  remap?: Record<string, string>;
}

export interface MysqlServiceConfig {
  type?: "mysql" | "mariadb";
  export?: number | boolean;
}

export class MysqlService
  extends Service<MysqlServiceOptions, MysqlServiceConfig> {
  static command = "mysql";
  static description = "Manage mysql db service";

  async process(app: App, options: MysqlServiceOptions): Promise<void> {
    const mysqlApp = await this.bedrock.appHub.getApp("mysql");

    if (!mysqlApp) {
      return;
    }

    const env = mysqlApp.getEnv(`service-${options.db}`);

    if (!options.prefix || !options.remap) {
      app.env.push(
        {
          type: AppEnvType.File,
          file: `../mysql/envs/service-${options.db}.env`,
        },
      );
    }

    if (options.remap) {
      // TODO: 将配置重新映射，并且不再插入原先的配置
    }

    if (options.prefix) {
      // TODO: 将 MYSQL 的前缀修改掉
    }
  }

  command(yargs: Yargs.YargsType): Yargs.YargsType {
    return yargs.demandCommand().command(
      "init",
      "Init mysql app",
      () => {},
      () => this.init(),
    ).command(
      "create <db>",
      "Create new database",
      () => {},
      (args: any) => this.create(args),
    );
  }

  private async init() {
    if (await this.bedrock.appHub.hasApp("mysql")) {
      console.log("Mysql app has been inited");
      return;
    }

    const app = await this.bedrock.appHub.newApp("mysql", {
      image: this.config?.type ?? "mariadb",
      ports: typeof this.config?.export === "number"
        ? [`${this.config?.export}:3306`]
        : this.config?.export
        ? ["3306:3306"]
        : [],
      volumes: ["@:/var/lib/mysql"],
      env: ["@root-password"],
    });

    app.createEnv("root-password", {
      MYSQL_ROOT_PASSWORD: new Array(36).fill(0).map(() =>
        Math.floor((Math.random() * 36)).toString(36)
      ).join(""),
    });

    await app.build();
  }

  private async create({ db }: any) {
    const app = await this.bedrock.appHub.getApp("mysql");

    if (!app) {
      console.log("Please init mysql");
      return;
    }

    // TODO: make sure mysql service is running
    // TODO: connect to service for create account & database

    app.createEnv(`service-${db}`, {
      MYSQL_HOST: "mysql",
      MYSQL_PORT: "3306",
      MYSQL_USER: db,
      MYSQL_PASSWORD: "",
      MYSQL_DATABASE: db,
    });

    await app.build();
  }
}
