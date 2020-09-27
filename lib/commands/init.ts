import { DoppBedRock } from "../bedrock.ts";
import { Yargs } from "../deps.ts";

export default function (bedrock: DoppBedRock) {
  return {
    command: "init",
    description: "Init dopp",
    builder: (yargs: Yargs.YargsType) => yargs,
    handler: async () => {
      // TODO: 网络、文件夹
      console.log("Need to implement");
    },
  };
}
