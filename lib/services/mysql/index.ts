import { ServiceContext } from "../service.ts";
import { App } from "../../app.ts";
import { Yargs } from "../../deps.ts";
import { runComposeCommand, generatePassword } from "../../utils.ts";
import { ConnectionManage, ConnInfo } from "../common/connection-manage.ts";

export interface MysqlServiceOptions {
  conn: string;
  prefix?: string;
  remap?: Record<string, string>;
}

type ImageType = "mysql" | "mariadb";

export interface MysqlServiceConfig {
  type: ImageType;
  version: string;
  export: number | boolean;
  conns: Record<string, ConnInfo>;
  root: ConnInfo;
}

export const command = "mysql";
export const description = "Manage mysql db service";

export function create(
  ctx: ServiceContext<MysqlServiceConfig>,
) {
  const { bedrock } = ctx;
  const appid = "mysql";
  const connection = new ConnectionManage(ctx, appid, {
    async onCreate(info, root) {
      const app = await getApp();
      const { database, username, password } = info;
      // TODO: 添加 NOT EXIST
      const SQL = `
      CREATE USER '${username}' IDENTIFIED BY '${password}';
      CREATE DATABASE ${database};
      GRANT ALL ON ${database}.* TO '${username}';
      `.trim();

      await runComposeCommand(
        app,
        [
          "exec",
          "default",
          "mysql",
          "-u",
          root.username,
          "-p" + root.password,
          "-e",
          SQL,
        ],
      );
    },
    async onRemove({ database, username }, root) {
      const app = await getApp();

      const SQL = `
DROP DATABASE IF EXISTS ${database};
DROP USER IF EXISTS '${username}';
    `;

      await runComposeCommand(
        app!,
        ["exec", "default", "mysql", "-p" + root.password, "-e", SQL],
      );
    },
    async onREPL(info, isRoot) {
      const app = await getApp();
      const { database, password, username } = info;
      await runComposeCommand(app, [
        "exec",
        "default",
        "mysql",
        database,
        "-u",
        username,
        "-p" + password,
      ], false);
    },
  });

  async function newOrGetRoot() {
    const root = await ctx.getConfig("root");
    if (root) {
      return root;
    }

    const nRoot: ConnInfo = {
      username: "root",
      password: generatePassword(),
      database: "",
    };

    await ctx.setConfig("root", nRoot);
    return nRoot;
  }

  async function getApp() {
    const app = await bedrock.appHub.getApp(appid);
    if (!app) {
      console.error(`Please init mysql service`);
      Deno.exit(1);
    }

    return app;
  }

  async function init(update = false) {
    const type = await ctx.getConfig("type", "mariadb");
    const exports = await ctx.getConfig("export", true);

    if (!update && await bedrock.appHub.hasApp("mysql")) {
      console.log("Mysql app has been inited");
      return;
    }

    const app = await bedrock.appHub.newApp("mysql", {
      image: type ?? "mariadb",
      ports: typeof exports === "number"
        ? [`${exports}:3306`]
        : exports
        ? ["3306:3306"]
        : [],
      volumes: ["@:/var/lib/mysql"],
      envs: ["@root"],
    }, update);

    const root = await newOrGetRoot();

    app.createEnv("root", {
      MYSQL_ROOT_PASSWORD: root.password,
    });

    await app.build();
  }

  async function changeType(newType: ImageType) {
    const app = await getApp();
    const oldType = await ctx.getConfig("type", "mariadb");
    if (oldType === newType) {
      console.log(`Current type already is ${newType}`);
    } else {
      (await app.cloneAndUpdate({
        image: newType,
      })).build();

      await ctx.setConfig("type", newType);

      console.log(`Change type to ${newType}, Please restart or start service`);
    }
  }

  return {
    async process(app: App, options: MysqlServiceOptions) {
      const conns = await ctx.getConfig("conns", {});
      const conn = options.conn;

      if (!conn || !conns[conn]) {
        throw new Error("Must be choose db");
      }

      const dbConfig = conns[conn];
      const envName = `service-mysql-${conn}`;
      let env: Record<string, string>;

      if (options.remap) {
        env = {};
      } else {
        const prefix = options.prefix ?? "MYSQL";
        env = {
          [`${prefix}_HOST`]: "mysql",
          [`${prefix}_PORT`]: "3306",
          [`${prefix}_USER`]: conn,
          [`${prefix}_PASSWORD`]: dbConfig.password,
          [`${prefix}_DATABASE`]: conn,
        };
      }

      app.createEnv(envName, env);

      app.appendEnv(`@${envName}`);
    },

    command(yargs: Yargs.YargsType): Yargs.YargsType {
      return ctx.registeProcessCommand(
        yargs.demandCommand().command(
          "init",
          "Init mysql app",
          (_yargs: Yargs.YargsType) =>
            _yargs.option("update", { type: "boolean", alias: ["u"] }),
          ({ update }: any) => init(!!update),
        ).command(connection.buildCreateCommand())
          .command(connection.buildRemoveCommand())
          .command(connection.buildREPLCommand())
          .command(connection.buildListCommand())
          .command(
            "change-type <type>",
            "Change service type",
            (_yargs: Yargs.YargsType) =>
              _yargs.positional("type", {
                type: "string",
                choices: ["mysql", "mariadb"],
              }),
            ({ type }: any) => changeType(type),
          ),
        appid,
      );
    },
  };
}
