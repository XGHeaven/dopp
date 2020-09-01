import { flags } from './deps.ts'
import { DoppBedRock } from "./dopp-bedrock.ts";
import { AppHub } from "./app.ts";

const args = flags.parse(Deno.args)

const root = Deno.env.get('DOPP_ROOT') ?? Deno.env.get('HOME')

if (!root) {
  console.log('Cannot get home of dopp')
  Deno.exit(1)
}

const bedrock = new DoppBedRock(root)

switch (args._[0]) {
  case 'new':
    break
  case 'start':
    break
  case 'stop':
    break
  case 'build': {
    const id = args._[1] as string
    const appHub = new AppHub(bedrock)
    const app = await appHub.getApp(id)
    await app?.writeComposeFile()
    break
  }
}
