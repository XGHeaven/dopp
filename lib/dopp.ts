import { flags, yargs, path } from './deps.ts'
import { DoppBedRock } from "./bedrock.ts";

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

const yargsInstance = yargs()
  .scriptName('dopp')
  .command('build-compose <appid>', 'Build app to docker compose', () => {}, async ({appid}: any) => {
    const app = await bedrock.appHub.getApp(appid)
    if (app) {
      await app.writeComposeFile()
    } else {
      console.error(`Cannot found app of ${appid}`)
    }
  })
  .command('info', 'Print infomation of dopp', () => {}, () => {
    console.log(JSON.stringify(bedrock, null, 2))
  })
  .alias('h', 'help')
  .demandCommand()

const bedrock = new DoppBedRock(root)
await bedrock.prepare()

yargsInstance.parse(Deno.args)
