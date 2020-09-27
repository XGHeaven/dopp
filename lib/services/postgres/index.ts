import { App } from "../../app.ts";
import { DoppBedRock } from "../../bedrock.ts";
import { Yargs } from "../../deps.ts";
import { generatePassword, runComposeCommand } from "../../utils.ts";
import { Service, ServiceContext } from "../service.ts";

export const command = "postgres";
export const description = "Manage postgres";

interface RootInfo {
  username: string;
  password: string;
  database: string;
}

interface Connection {
  username: string;
  password: string;
  database: string;
}

interface PostgresServiceConfig {
  root: RootInfo;
  conns: Record<string, Connection>;
}

interface PostgresServiceOptions {
  conn: string;
  inline?: boolean;
  useURL?: boolean | string;
  custom?: Record<string, string>;
  prefix?: string;
}

export function create(
  ctx: ServiceContext<PostgresServiceConfig>,
): Service<PostgresServiceOptions> {
  const { bedrock } = ctx;
  const appid = "postgres";

  async function newOrGetRootInfo() {
    const info = await ctx.getConfig("root");

    if (info) {
      return info;
    }

    const newInfo: RootInfo = {
      username: "postgres",
      password: generatePassword(),
      database: "postgres",
    };

    await ctx.setConfig("root", newInfo);
    return newInfo;
  }

  async function getApp(): Promise<App> {
    const app = await bedrock.appHub.getApp(appid);
    if (!app) {
      console.log("Please init postgres app first");
      Deno.exit(1);
    }

    return app;
  }

  async function init() {
    if (await bedrock.appHub.hasApp(appid)) {
      console.log("Postgres app has been created");
      return;
    }

    const root = await newOrGetRootInfo();
    const app = await bedrock.appHub.newApp(appid, {
      name: "Postgres",
      image: "postgres:13",
      ports: ["5432:5432"],
      volumes: ["@:/var/lib/postgresql/data"],
      env: ["@root"],
    });

    app.createEnv("root", {
      POSTGRES_USER: root.username,
      POSTGRES_PASSWORD: root.password,
      POSTGRES_DB: root.database,
    });

    await app.build();
  }

  async function repl(conn?: string) {
    const app = await getApp();
    const root = await ctx.getConfig("root");

    if (!root) {
      console.log("Please init first");
      Deno.exit(1);
    }

    if (!conn) {
      await runComposeCommand(
        app,
        ["exec", "default", "psql", "-U", root.username],
      );
    } else {
      const conns = await ctx.getConfig("conns", {});
      const info = conns[conn];
      if (!info) {
        console.log(`Cannot get ${conn} connection`);
        Deno.exit(0);
      }

      await runComposeCommand(
        app,
        [
          "exec",
          "default",
          "psql",
          "-U",
          info.username,
          "-W",
          info.password,
          info.database,
        ],
      );
    }

    runComposeCommand(app, ["exec"], false);
  }

  async function create(
    conn: string,
    options: Partial<Connection> & { noCreate?: boolean },
  ) {
    const app = await getApp();
    const root = await ctx.getConfig("root");
    const conns = await ctx.getConfig("conns", {});

    if (!root) {
      console.log("Root is undefined");
      Deno.exit(1);
    }

    if (conns[conn]) {
      console.log(
        `${conn} has been added, if you want to overwrite it, please special --force`,
      );
      Deno.exit(1);
    }

    const username = options.username ?? conn;
    const password = options.password ?? generatePassword();
    const database = options.database ?? conn;

    if (!options.noCreate) {
      const CREATE_DATABASE_SQL = `
CREATE DATABASE ${database};
      `.trim();

      await runComposeCommand(
        app,
        [
          "exec",
          "default",
          "psql",
          "-U",
          root.username,
          "-c",
          CREATE_DATABASE_SQL,
        ],
        false,
      );

      const SQL = `
CREATE USER "${username}" WITH PASSWORD '${password}';
GRANT ALL PRIVILEGES ON DATABASE ${database} TO ${username};
      `.trim();
      await runComposeCommand(
        app,
        ["exec", "default", "psql", "-U", root.username, "-c", SQL],
        false,
      );
    }

    conns[conn] = {
      username,
      password,
      database,
    };

    await ctx.setConfig("conns", conns);
  }

  return {
    async process(app, options) {
      const conn = options.conn;

      if (!conn) {
        return;
      }

      const conns = await ctx.getConfig("conns", {});
      const info = conns[conn];

      if (!info) {
        return;
      }

      const envs: string[] = [];

      const variable = {
        HOST: appid,
        PORT: "5432",
        USERNAME: info.username,
        PASSWORD: info.password,
        DATABASE: info.database,
      };

      if (options.useURL) {
        envs.push(
          `${
            typeof options.useURL === "string"
              ? options.useURL
              : "DATABASE_URL"
          }=postgresql://${info.username}:${info.password}@${appid}:5432/${info.database}`,
        );
      } else if (options.custom) {
        envs.push(
          ...Object.entries(options.custom).map(([key, value]) =>
            [
              key,
              new Function(
                "{HOST, PORT, USERNAME, PASSWORD, DATABASE}",
                `return \`${value}\``,
              )(variable),
            ].join("=")
          ),
        );
      } else {
        const prefix = options.prefix ?? "POSTGRES";
        envs.push(
          ...Object.entries(variable).map(([key, value]) =>
            `${prefix}_${key}=${value}`
          ),
        );
      }

      if (options.inline) {
        for (const env of envs) {
          app.appendEnv(env);
        }
      } else {
        app.createEnv(`postgres-service-${conn}`, envs);
        app.appendEnv(`@postgres-service-${conn}`);
      }
    },
    command(yargs: Yargs.YargsType) {
      return ctx.registeProcessCommand(
        yargs.demandCommand().command(
          "init",
          "Init postgres instance",
          () => {},
          () => init(),
        ).command(
          "create <conn>",
          "Create a connection",
          (_yargs: Yargs.YargsType) =>
            _yargs.option("no-create", {
              description: `Do not create user/database`,
              type: "boolean",
            }).option("username", {
              type: "string",
              alias: ["u"],
              description: "Connection username, defaults to <conn>",
            }).option("password", {
              type: "string",
              alias: ["p"],
              description: "Connection password, defaults to random generated",
            }).option("database", {
              type: "string",
              alias: ["d"],
              description: "Connection database, defaults to <conn>",
            }),
          ({ conn, noCreate }: any) => {
            create(conn, { noCreate });
          },
        ).command("repl [conn]", "REPL cli", ({ conn }: any) => repl(conn)),
        appid,
      );
    },
  };
}
