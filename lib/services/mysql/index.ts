import { ServiceContext } from "../service.ts";
import { App } from "../../app.ts";
import { Yargs } from "../../deps.ts";
import { runComposeCommand } from "../../utils.ts";

export interface MysqlServiceOptions {
  db: string;
  prefix?: string;
  remap?: Record<string, string>;
}

export interface MysqlServiceConfig {
  type: "mysql" | "mariadb";
  export: number | boolean;
  rootPassword: string;
  dbs: Record<string, {
    password: string;
  }>;
}

function newPassword() {
  return new Array(36).fill(0).map(() =>
    Math.floor((Math.random() * 36)).toString(36)
  ).join("");
}

export const command = "mysql";
export const description = "Manage mysql db service";

export function create(
  ctx: ServiceContext<MysqlServiceConfig>,
) {
  const { bedrock } = ctx

  async function newOrGetRootPassword() {
    const password = await ctx.getConfig("rootPassword");
    if (password) {
      return password;
    }

    const npwd = newPassword();
    await ctx.setConfig("rootPassword", npwd);
    return npwd;
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
      env: ["@root-password"],
    }, update);

    app.createEnv("root-password", {
      MYSQL_ROOT_PASSWORD: await newOrGetRootPassword(),
    });

    await app.build();
  }

  async function create(db: string) {
    // TODO: make sure mysql service is running

    const app = await bedrock.appHub.getApp("mysql");
    const dbs = await ctx.getConfig("dbs", {});
    const rootPassword = await ctx.getConfig("rootPassword", "");

    if (!app) {
      throw new Error("Please init mysql service first");
    }

    if (dbs[db]) {
      throw new Error(`${db} database has been created`);
    }

    const password = newPassword();

    const SQL = `
CREATE USER '${db}' IDENTIFIED BY '${password}';
CREATE DATABASE ${db};
GRANT ALL ON ${db}.* TO '${db}';
    `.trim();

    await runComposeCommand(
      app,
      ["exec", "default", "mysql", "-p" + rootPassword, "-e", SQL],
      true,
    );

    dbs[db] = {
      password,
    };

    await ctx.setConfig("dbs", dbs);
  }

  async function remove(db: string) {
    const app = await bedrock.appHub.getApp("mysql");
    const dbs = await ctx.getConfig("dbs", {});
    const rootPassword = await ctx.getConfig("rootPassword", "");
    const copys = { ...dbs };
    delete copys[db];

    const SQL = `
DROP DATABASE IF EXISTS ${db};
DROP USER IF EXISTS '${db}';
    `;

    await runComposeCommand(
      app!,
      ["exec", "default", "mysql", "-p" + rootPassword, "-e", SQL],
    );

    await ctx.setConfig("dbs", copys);
  }

  async function repl(db: string) {
    const app = await bedrock.appHub.getApp("mysql");
    let ret: Deno.ProcessStatus;
    if (db === "root") {
      const rootPassword = await ctx.getConfig("rootPassword", "");
      ret = await Deno.run({
        cmd: [
          "docker-compose",
          "exec",
          "default",
          "mysql",
          "-u",
          "root",
          "-p" + rootPassword,
        ],
        cwd: app?.appDir,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      }).status();
    } else {
      const dbs = await ctx.getConfig("dbs", {});
      ret = await Deno.run({
        cmd: [
          "docker-compose",
          "exec",
          "default",
          "mysql",
          db,
          "-u",
          db,
          "-p" + dbs[db].password,
        ],
        cwd: app?.appDir,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      }).status();
    }

    if (!ret.success) {
      Deno.exit(ret.code);
    }
  }

  async function list() {
    const dbs = await ctx.getConfig("dbs", {});

    Object.keys(dbs).forEach((db) => console.log(db));
  }

  return {
    async process(app: App, options: MysqlServiceOptions) {
      const dbs = await ctx.getConfig("dbs", {});
      const db = options.db;

      if (!db || !dbs[db]) {
        throw new Error("Must be choose db");
      }

      const dbConfig = dbs[db];
      const envName = `service-mysql-${db}`;
      let env: Record<string, string>;

      if (options.remap) {
        env = {};
      } else {
        const prefix = options.prefix ?? "MYSQL";
        env = {
          [`${prefix}_HOST`]: "mysql",
          [`${prefix}_PORT`]: "3306",
          [`${prefix}_USER`]: db,
          [`${prefix}_PASSWORD`]: dbConfig.password,
          [`${prefix}_DATABASE`]: db,
        };
      }

      app.createEnv(envName, env);

      app.appendEnv(`@${envName}`);
    },

    command(yargs: Yargs.YargsType): Yargs.YargsType {
      return ctx.registeProcessCommand(yargs.demandCommand().command(
        "init",
        "Init mysql app",
        (_yargs: Yargs.YargsType) =>
          _yargs.option("update", { type: "boolean", alias: ["u"] }),
        ({ update }: any) => init(!!update),
      ).command(
        "create <db>",
        "Create new database",
        () => {},
        ({ db }: any) => create(db),
      )
        .command(
          "remove <db>",
          "Remove database",
          (_yargs: Yargs.YargsType) =>
            _yargs.option("yes", { alias: "y", type: "boolean" }),
          ({ db, yes }: any) => {
            console.log(yes);
            if (!yes) {
              console.log(
                "Delete is a dangerous action, please pass --yes or -y",
              );
              return;
            }
            remove(db);
          },
        )
        .command(
          "repl <db>",
          "Run a mysql REPL",
          () => {},
          ({ db }: any) => repl(db),
        )
        .command("list", "List all added db", () => {}, () => {
          list();
        }), 'mysql');
    },
  };
}
