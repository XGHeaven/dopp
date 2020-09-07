import { Yargs } from "../deps.ts";
import { DoppBedRock } from "../bedrock.ts";

export default function (bedrock: DoppBedRock) {
  return {
    command: "app",
    description: "manage app",
    builder: (yargs: Yargs.YargsType): any =>
      yargs
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
        ),
    handler: () => {},
  };
}
