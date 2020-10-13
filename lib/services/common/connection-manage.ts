import { Yargs } from "../../deps.ts";
import { generatePassword, runComposeCommand } from "../../utils.ts";
import { ServiceContext } from "../service.ts";

export interface ConnInfo {
  username: string;
  password: string;
  database: string;
}

export interface ConnectionManageConfig {
  conns: Record<string, ConnInfo>;
  root: ConnInfo;
}

const noEffectOptionDict = {
  ["no-effect"]: {
    type: "boolean",
    description: `Do not modify database`,
  },
};

const twiceConfirmOptionDict = {
  "yes": {
    type: "boolean",
    description: "Twice confirm action",
    alias: ["y"],
  },
};

const connInfoOptionDict = {
  username: {
    type: "string",
    alias: ["u"],
    description: "Connection username, defaults to `conn`",
  },
  password: {
    type: "string",
    alias: ["p"],
    description: "Connection password, defaults to random generated",
  },
  database: {
    type: "string",
    alias: ["d"],
    description: "Connection database, defaults to `conn`",
  },
};

const connPositional = {
  type: "string" as const,
  description: "Connection name",
};

export class ConnectionManage {
  constructor(
    public ctx: ServiceContext<ConnectionManageConfig>,
    public appid: string,
    public options: {
      onCreate: (info: ConnInfo, root: ConnInfo) => void;
      onRemove: (info: ConnInfo, root: ConnInfo) => void;
      onREPL: (info: ConnInfo, isRoot: boolean) => void;
    },
  ) {}

  async create(
    conn: string,
    options: Partial<ConnInfo> & { noEffect?: boolean; force?: boolean },
  ) {
    const root = await this.ctx.getConfig("root");
    const conns = await this.ctx.getConfig("conns", {});

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

    const info: ConnInfo = { username, password, database };

    if (!options.noEffect) {
      await this.options.onCreate(info, root);
    }

    conns[conn] = info;

    await this.ctx.setConfig("conns", conns);
  }

  async remove(conn: string, options: { noSideEffect?: boolean }) {
    const conns = await this.ctx.getConfig("conns", {});
    const root = await this.getRoot();

    const info = conns[conn];

    if (!info) {
      throw new Error(`Cannot found ${conn} connection`);
    }

    if (!options.noSideEffect) {
      await this.options.onRemove(info, root);
    }

    const newConns = { ...conns };
    delete newConns[conn];
    await this.ctx.setConfig("conns", newConns);
  }

  async repl(conn?: string) {
    if (!conn) {
      await this.options.onREPL(await this.getRoot(), true);
    } else {
      const conns = await this.ctx.getConfig("conns", {});
      const info = conns[conn];
      if (!info) {
        throw new Error(`Cannot found connection of ${conn}`);
      }
      await this.options.onREPL(info, false);
    }
  }

  async list() {
    const conns = await this.ctx.getConfig("conns", {});

    console.table(conns);
  }

  buildCreateCommand(
    builder?: (yargs: Yargs.YargsType) => Yargs.YargsType,
    handler?: (args: any) => void,
  ) {
    return {
      command: "create <conn>",
      description: "Create a connection",
      builder: (yargs: Yargs.YargsType) =>
        (builder ?? ((v: any) => v))(
          yargs
            .positional("conn", connPositional)
            .options({ ...noEffectOptionDict, ...connInfoOptionDict }),
        ),
      handler: async (args: any) => {
        await this.create(args.conn, {
          username: args.username,
          password: args.password,
          database: args.database,
          noEffect: args.noEffect,
        });
        if (handler) {
          await handler(args);
        }
      },
    };
  }

  buildRemoveCommand(
    builder?: (yargs: Yargs.YargsType) => Yargs.YargsType,
    handler?: (args: any) => void,
  ) {
    return {
      command: "remove <conn>",
      description: "Remove connection",
      builder: (yargs: Yargs.YargsType) =>
        (builder ?? ((v: any) => v))(
          yargs.positional("conn", connPositional).options(
            { ...noEffectOptionDict, ...twiceConfirmOptionDict },
          ),
        ),
      handler: async (args: any) => {
        if (!args.yes) {
          console.log(`Remove action need -y/--yes options to confirm`);
          return;
        }
        await this.remove(args.conn, { noSideEffect: args.noEffect });
        if (handler) {
          await handler(args);
        }
      },
    };
  }

  buildREPLCommand(
    builder?: (yargs: Yargs.YargsType) => Yargs.YargsType,
    handler?: (args: any) => void,
  ) {
    return {
      command: "repl [conn]",
      description: "Enter repl with `conn`",
      builder: (yargs: Yargs.YargsType) =>
        (builder ?? ((v: any) => v))(yargs.positional("conn", connPositional)),
      handler: async (args: any) => {
        await this.repl(args.conn);
        if (handler) {
          await handler(args);
        }
      },
    };
  }

  buildListCommand() {
    return {
      command: "list",
      description: "List all connections",
      handler: () => this.list(),
    };
  }

  private async getApp() {
    const app = await this.ctx.bedrock.appHub.getApp(this.appid);
    if (!app) {
      throw new Error(`Please init service first`);
    }
    return app;
  }

  private async getRoot() {
    const root = await this.ctx.getConfig("root");
    if (!root) {
      throw new Error("Cannot found service root infomation");
    }
    return root;
  }
}
