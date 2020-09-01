import { path, fs } from './deps.ts'

interface DoppConfig {
  defaultNetwork?: string
  dockerEndpoint?: string
  services?: string[]
}

export class DoppBedRock {
  readonly defaultNetwork: string = 'dopp'
  readonly dockerEndpoint: string = 'unix:///var/run/docker.sock'
  readonly services: string[] = []
  readonly appsDir: string
  readonly configPath: string

  constructor(public readonly root: string) {
    this.appsDir = path.join(this.root, 'apps')
    this.configPath = path.join(this.root, 'config.json')
    const config = fs.existsSync(this.configPath) ? fs.readJsonSync(this.configPath) : {}

    Object.assign(this, config)
  }

  getAppDir(appid: string) {
    return path.join(this.appsDir, appid)
  }
}
