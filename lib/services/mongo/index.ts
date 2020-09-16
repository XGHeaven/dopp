import { ServiceCreator } from "../service.ts";
import { Yargs } from "../../deps.ts";
import { generatePassword, runComposeCommand } from "../../utils.ts";
import { App } from "../../app.ts";

export const command = "mongodb";
export const description = "Manage mongodb service";

interface MongoServiceConnConfig {
  username: string;
  password: string;
  database: string;
}

export interface MongoServiceConfig {
  rootPassword: string;
  exports: boolean | number;
  version: string;
  conns: Record<string, MongoServiceConnConfig>;
}

export interface MongoServiceOptions {
  conn: string;
}

export const create: ServiceCreator<MongoServiceConfig, MongoServiceOptions> = (
  ctx,
) => {
  const { bedrock } = ctx;
  const appid = "mongodb";

  async function getServiceApp(): Promise<App> {
    const app = await bedrock.appHub.getApp(appid);
    if (!app) {
      console.log(`Please init service`);
      Deno.exit(1);
    }
    return app;
  }

  async function newOrGetRootPassword() {
    const rpwd = await ctx.getConfig("rootPassword");
    if (!rpwd) {
      const npwd = generatePassword();
      await ctx.setConfig("rootPassword", npwd);
      return npwd;
    }
    return rpwd;
  }

  async function init() {
    const version = await ctx.getConfig("version", "latest");
    const exports = await ctx.getConfig("exports", true);

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
      env: ["@root"],
    });

    await app.createEnv("root", {
      MONGO_INITDB_ROOT_USERNAME: "root",
      MONGO_INITDB_ROOT_PASSWORD: await newOrGetRootPassword(),
    });

    await app.build();
  }

  async function evalRootService(evalString: string) {
    await runComposeCommand(
      await getServiceApp(),
      [
        "exec",
        "default",
        "mongo",
        "-u",
        "root",
        "-p",
        await ctx.getConfig("rootPassword", ""),
        "--eval",
        evalString,
      ],
      false,
    );
  }

  async function createConnn(
    conn: string,
    options: Partial<MongoServiceConnConfig>,
  ) {
    const conns = await ctx.getConfig("conns", {});

    if (conns[conn]) {
      console.log(`Connection of ${conn} has been created`);
      return;
    }

    const username = options.username ?? conn;
    const password = options.password ?? generatePassword();
    const database = options.database ?? conn;

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

    await ctx.setConfig(
      "conns",
      { ...conns, [conn]: { username, password, database } },
    );
  }

  async function removeConn(conn: string) {
    const conns = await ctx.getConfig("conns", {});

    const config = conns[conn];
    if (!config) {
      console.log(`${conn} is not exist`);
      Deno.exit(0);
    }

    const { database, username } = config;
    await evalRootService(
      `db.getSiblingDB('${database}').dropUser('${username}')`,
    );
    const newConns = { ...conns };
    delete newConns[conn];
    await ctx.setConfig("conns", newConns);
  }

  async function enterREPL(conn?: string) {
    const app = await getServiceApp();

    const conns = await ctx.getConfig("conns", {});

    let username: string, password: string, database: string;

    if (!conn) {
      username = "root";
      password = await ctx.getConfig("rootPassword", "");
      database = "";
    } else {
      const config = conns[conn];

      if (!config) {
        console.log(`Cannot found ${conn} connection`);
        Deno.exit(1);
      }

      ({ username, password, database } = config);
    }

    await runComposeCommand(
      app,
      ["exec", "default", "mongo", "-u", username, "-p", password, database],
      false,
    );
  }

  async function list() {
    const conns = await ctx.getConfig("conns", {});

    console.table(conns);
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

      app.createEnv(`mongo-${conn}`, {
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
          .command(
            "create <conn>",
            "Create connection",
            (_yargs: Yargs.YargsType) =>
              _yargs.option("username", {
                type: "string",
                alias: ["u"],
                description: "Connection username, defaults to <conn>",
              }).option("password", {
                type: "string",
                alias: ["p"],
                description:
                  "Connection password, defaults to random generated",
              }).option("database", {
                type: "string",
                alias: ["d"],
                description: "Connection database, default to <conn>",
              }),
            ({ conn, username, password, database }: any) =>
              createConnn(conn, { username, password, database }),
          )
          .command(
            "remove <conn>",
            "Remove connection",
            () => {},
            ({ conn }: any) => removeConn(conn),
          )
          .command(
            "repl [db]",
            "Enter repl of db",
            () => {},
            ({ db }: any) => enterREPL(db),
          )
          .command("list", "List all connections", () => {}, () => list()),
        appid,
      );
    },
  };
};
