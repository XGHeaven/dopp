import { DoppBedRock } from "../bedrock.ts";
import { Yargs } from "../deps.ts";

export default function (bedrock: DoppBedRock) {
  return {
    command: "service",
    description: "Manage service",
    builder: (yargs: Yargs.YargsType): any =>
      yargs.demandCommand().command(
        "add <url>",
        "Add service of url or name",
        () => {},
        async () => {
        },
      ),
    handler: () => {},
  };
}
