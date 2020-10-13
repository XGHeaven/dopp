import { ServiceCreator } from "../service.ts";
import { Yargs } from "../../deps.ts";
import { generatePassword, runComposeCommand } from "../../utils.ts";
import { App } from "../../app.ts";
import { ConnectionManage, ConnInfo } from "../common/connection-manage.ts";

export const command = "mongodb";
export const description = "Manage mongodb service";

export interface MongoServiceConfig {
  root: ConnInfo;
  exports: boolean | number;
  version: string;
  conns: Record<string, ConnInfo>;
}

export interface MongoServiceOptions {
  conn: string;
}

export const create: ServiceCreator<MongoServiceConfig, MongoServiceOptions> = (
  ctx,
) => {
  const { bedrock } = ctx;
  const appid = "mongodb";
  const connection = new ConnectionManage(ctx, appid, {
    onCreate: async ({ username, password, database }) => {
      await evalRootService(
        `db.getSiblingDB('${database}').createUser(${
          JSON.stringify({
            user: username,
            pwd: password,
            roles: [{ role: "dbAdmin", db: database }],
            comment: "Created by Dopp Mongo",
          })
        })`,
      );
    },
    onRemove: async ({ username, database }) => {
      await evalRootService(
        `db.getSiblingDB('${database}').dropUser('${username}')`,
      );
    },
    onREPL: async ({ username, password, database }) => {
      const app = await getServiceApp();
      await runComposeCommand(
        app,
        ["exec", "default", "mongo", "-u", username, "-p", password, database],
        false,
      );
    },
  });

  async function getServiceApp(): Promise<App> {
    const app = await bedrock.appHub.getApp(appid);
    if (!app) {
      console.log(`Please init service`);
      Deno.exit(1);
    }
    return app;
  }

  async function newOrGetRoot() {
    const root = await ctx.getConfig("root");
    if (!root) {
      const newRoot: ConnInfo = {
        username: "root",
        password: generatePassword(),
        database: "",
      };

      await ctx.setConfig("root", newRoot);

      return newRoot;
    }

    return root;
  }

  async function init() {
    const version = await ctx.getConfig("version", "latest");
    const exports = await ctx.getConfig("exports", true);
    const root = await newOrGetRoot();

    if (await bedrock.appHub.hasApp(appid)) {
      console.error("App has been created");
      return;
    }

    const app = await bedrock.appHub.newApp(appid, {
      image: `mongo:${version}`,
      ports: exports === false
        ? []
        : exports === true
        ? [`27017:27017`]
        : [`${exports}:27017`],
      volumes: ["@:/data/db"],
      envs: ["@root"],
    });

    await app.createEnv("root", {
      MONGO_INITDB_ROOT_USERNAME: root.username,
      MONGO_INITDB_ROOT_PASSWORD: root.password,
    });

    await app.build();
  }

  async function evalRootService(evalString: string) {
    const root = await newOrGetRoot();

    if (!root) {
      throw new Error("Please init first");
    }

    await runComposeCommand(
      await getServiceApp(),
      [
        "exec",
        "default",
        "mongo",
        "-u",
        root.username,
        "-p",
        root.password,
        "--eval",
        evalString,
      ],
      false,
    );
  }

  return {
    async process(app, option) {
      const { conn } = option;
      if (!conn) {
        throw new Error("conn is required");
      }
      const conns = await ctx.getConfig("conns", {});
      const config = conns[conn];

      if (!conn) {
        throw new Error(`${conn} is not exist`);
      }

      app.appendEnv(`@mongodb-${conn}`);

      app.createEnv(`mongodb-${conn}`, {
        MONGO_HOST: appid,
        MONGO_PORT: "27017",
        MONGO_USERNAME: config.username,
        MONGO_PASSWORD: config.password,
        MONGO_DATABASE: config.database,
      });
    },
    command(yargs: Yargs.YargsType) {
      return ctx.registeProcessCommand(
        yargs
          .demandCommand()
          .command("init", "Init mongodb", () => {}, init)
          .command(connection.buildCreateCommand())
          .command(connection.buildRemoveCommand())
          .command(connection.buildREPLCommand())
          .command(connection.buildListCommand()),
        appid,
      );
    },
  };
};
