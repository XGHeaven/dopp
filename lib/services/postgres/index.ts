import { App } from "../../app.ts";
import { DoppBedRock } from "../../bedrock.ts";
import { Yargs } from "../../deps.ts";
import { generatePassword, runComposeCommand } from "../../utils.ts";
import { ConnectionManage, ConnInfo } from "../common/connection-manage.ts";
import { Service, ServiceContext } from "../service.ts";

export const command = "postgres";
export const description = "Manage postgres";

interface PostgresServiceConfig {
  root: ConnInfo;
  conns: Record<string, ConnInfo>;
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
  const connection = new ConnectionManage(ctx, appid, {
    onCreate: async ({ username, password, database }, root) => {
      const app = await getApp();
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
    },
    onRemove: async () => {
      // TODO
    },
    onREPL: async ({ username, password, database }, isRoot) => {
      const app = await getApp();
      if (isRoot) {
        await runComposeCommand(app, [
          "exec",
          "default",
          "psql",
          "-U",
          username,
        ]);
      } else {
        await runComposeCommand(app, [
          "exec",
          "default",
          "psql",
          "-U",
          username,
          "-W",
          password,
          database,
        ]);
      }
    },
  });

  async function newOrGetRootInfo() {
    const info = await ctx.getConfig("root");

    if (info) {
      return info;
    }

    const newInfo: ConnInfo = {
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
      envs: ["@root"],
    });

    app.createEnv("root", {
      POSTGRES_USER: root.username,
      POSTGRES_PASSWORD: root.password,
      POSTGRES_DB: root.database,
    });

    await app.build();
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
            typeof options.useURL === "string" ? options.useURL : "DATABASE_URL"
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
          ...Object.entries(variable).map(
            ([key, value]) => `${prefix}_${key}=${value}`,
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
        yargs
          .demandCommand()
          .command(
            "init",
            "Init postgres instance",
            () => {},
            () => init(),
          )
          .command(
            connection.buildCreateCommand(),
          )
          .command(connection.buildRemoveCommand())
          .command(connection.buildREPLCommand())
          .command(connection.buildListCommand()),
        appid,
      );
    },
  };
}
