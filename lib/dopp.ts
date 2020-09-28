import { yargs, path, Yargs } from "./deps.ts";
import { DoppBedRock } from "./bedrock.ts";

import appCmd from "./commands/app.ts";
import initCmd from "./commands/init.ts";
import serviceCmd from "./commands/service.ts";

let root: string = "";

{
  const DOPP_ROOT = Deno.env.get("DOPP_ROOT");
  if (DOPP_ROOT) {
    root = path.resolve(Deno.cwd(), DOPP_ROOT);
  } else {
    const HOME = Deno.env.get("HOME");
    if (HOME) {
      root = path.join(HOME, ".dopp");
    }
  }
}

if (!root) {
  console.log("Cannot get home of dopp");
  Deno.exit(1);
}

const bedrock = new DoppBedRock(root);

let yargsInstance = yargs()
  .scriptName("dopp")
  .alias("h", "help")
  .demandCommand()
  .command(initCmd(bedrock))
  .command(appCmd(bedrock))
  .command(serviceCmd(bedrock))
  .command("info", "Print infomation of dopp", () => {}, () => {
    console.log(JSON.stringify(bedrock, null, 2));
  });

await bedrock.prepare();

const serviceCommands = await bedrock.serviceHub.getAllCommands();

for (const command of serviceCommands) {
  yargsInstance = yargsInstance.command(command);
}

yargsInstance.parse(Deno.args);
