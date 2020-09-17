import { Yargs } from "../deps.ts";
import { DoppBedRock } from "../bedrock.ts";
import { runComposeCommand } from "../utils.ts";

export default function (bedrock: DoppBedRock) {
  return {
    command: "app",
    description: "manage app",
    builder: (yargs: Yargs.YargsType): any =>
      createAppSSSCommand(bedrock, yargs)
        .demandCommand()
        .command(
          "new <appid>",
          "Create new app",
          (yargs: Yargs.YargsType) =>
            yargs
              .option("name", {
                type: "string",
                description: "App name",
                alias: "n",
              })
              .option("image", {
                type: "string",
                description: "App image",
                alias: "i",
              }),
          async ({ appid, name, image }: any) => {
            await bedrock.appHub.newApp(appid, {
              name,
              image,
            });
          },
        )
        .command(
          "build <appid>",
          "Build app to docker compose",
          () => {},
          async ({ appid }: any) => {
            const app = await bedrock.appHub.getApp(appid);
            if (app) {
              await app.build();
            } else {
              console.error(`Cannot found app of ${appid}`);
            }
          },
        )
        .command(
          "inspect <appid>",
          "Inspect app",
          () => {},
          async ({ appid }: any) => {
            const app = await bedrock.appHub.getApp(appid);
            if (!app) {
              console.log("Cannot found app");
            } else {
              console.log(app, null, 2);
            }
          },
        )
        .command(
          "rm <appid>",
          "Remove app",
          () => {},
          async ({ appid }: any) => {
            const app = await bedrock.appHub.getApp(appid);
            if (!app) return;
            await runComposeCommand(app, ["rm"]);
          },
        ),
    handler: () => {},
  };
}

export function createAppSSSCommand(
  bedrock: DoppBedRock,
  yargs: Yargs.YargsType,
  appid?: string,
) {
  function getCommand(command: string) {
    return command + (appid ? "" : " <appid>");
  }

  function getAppid(args: any) {
    if (appid) {
      return appid;
    }
    return args.appid;
  }

  function addAppidPositional(yargs: Yargs.YargsType) {
    return appid
      ? yargs
      : yargs.positional(
        "appid",
        { type: "string", description: "App id you want to do" },
      );
  }

  async function getApp(appid: string) {
    const app = await bedrock.appHub.getApp(appid)
    if (!app) {
      console.error(`Cannot found ${appid} app`)
      Deno.exit(1)
    }
    return app
  }

  return yargs.command(
    getCommand("start"),
    "Start app",
    (_yargs: Yargs.YargsType) =>
      addAppidPositional(_yargs).option(
        "build",
        {
          type: "boolean",
          default: false,
          alias: ["b"],
          description: "Build app",
        },
      ).option('pull', {
        type: 'boolean',
        default: false,
        alias: ['p'],
        description: "Pull the latest image before started"
      }),
    async (args: any) => {
      const appid = getAppid(args);
      const app = await getApp(appid);
      if (args.build) {
        await app.build();
      }
      if (args.pull) {
        await runComposeCommand(app, ['pull'])
      }
      await runComposeCommand(app, ["up", "-d"]);
    },
  )
    .command(
      getCommand("stop"),
      "Stop app",
      addAppidPositional,
      async (args: any) => {
        const appid = getAppid(args);
        const app = await bedrock.appHub.getApp(appid);
        if (!app) return;
        await runComposeCommand(app, ["down"]);
      },
    )
    .command(
      getCommand("status"),
      "Get status app",
      addAppidPositional,
      async (args: any) => {
        const appid = getAppid(args);
        const app = await bedrock.appHub.getApp(appid);
        if (!app) return;
        await runComposeCommand(app, ["ps"]);
      },
    );
}
