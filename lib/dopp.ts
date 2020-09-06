import { yargs, path, Yargs } from './deps.ts'
import { DoppBedRock } from "./bedrock.ts";

import appCmd from './commands/app.ts'

let root: string = ''

{
  const DOPP_ROOT = Deno.env.get('DOPP_ROOT')
  if (DOPP_ROOT) {
    root = path.resolve(Deno.cwd(), DOPP_ROOT)
  } else {
    const HOME = Deno.env.get('HOME')
    if (HOME) {
      root = path.join(HOME, '.dopp')
    }
  }
}

if (!root) {
  console.log('Cannot get home of dopp')
  Deno.exit(1)
}


const bedrock = new DoppBedRock(root)

const yargsInstance = yargs()
  .scriptName('dopp')
  .alias('h', 'help')
  .demandCommand()
  .command(appCmd(bedrock))
  .command('info', 'Print infomation of dopp', () => {}, () => {
    console.log(JSON.stringify(bedrock, null, 2))
  })

await bedrock.prepare()

yargsInstance.parse(Deno.args)
