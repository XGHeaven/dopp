import { DoppBedRock } from "./dopp-bedrock.ts";
import { fs, path, YAML, Ajv } from './deps.ts'

export interface AppCommon {
  name: string
  image: string
  env: (string | AppEnv)[]
  volumes: (string | AppVolume)[]
  networks: (string | AppNetwork)[]
  labels: string[]
}

export enum AppVolumeType {
  Volume = 'volume',
  Bind = 'bind',
  Private = 'private'
}

export interface AppVolume {
  source: string
  target: string
  type: string
}

// 配置定义
export interface AppConfig extends Partial<AppCommon> {
  extends?: string | string[]
  services?: AppService[]
}

export enum AppEnvType {
  File = 'file',
  Pair = 'pair'
}

export interface AppEnvFile {
  type: AppEnvType.File,
  file: string
}

export interface AppEnvPair {
  type: AppEnvType.Pair,
  key: string,
  value: string
}

export interface AppNetwork {
  type: string
  name: string
}

export type AppEnv = AppEnvFile | AppEnvPair

export interface AppService {
  use: string
  [key: string]: any
}

const {$schema:_$schema, ...schema} = await fs.readJson('./app-schema.json') as any

export class AppHub {
  #ajv = new Ajv()
  #validate = this.#ajv.compile(schema)
  constructor(private bedrock: DoppBedRock) {
  }

  async getApp(appid: string): Promise<App | null> {
    const appDir = path.join(this.bedrock.appsDir, appid)
    if (!await fs.exists(appDir)) {
      return null
    }

    const appConfigPath = path.join(appDir, 'app.yml')
    if (!await fs.exists(appConfigPath)) {
      return null
    }

    const appConfig: AppConfig = YAML.parse(new TextDecoder().decode(await Deno.readFile(appConfigPath))) as any

    const valid = this.#validate(appConfig)
    console.log(appConfig)
    if (!valid) {
      const [err] = this.#validate.errors!
      throw new Error(`${err.dataPath} ${err.message}`)
    }

    const app = new App(this.bedrock, appid, appConfig)
    return app
  }

  async hasApp(appid: string) {

  }

  async newApp(appid: string, appConfig: AppConfig = {}): Promise<App> {
    const appDir = path.join(this.bedrock.appsDir, appid)
    if (await fs.exists(appDir)) {
      return (await this.getApp(appid))!
    }

    await Deno.mkdir(appDir, {recursive: true})
    await Deno.writeFile(path.join(appDir, 'app.yml'), new TextEncoder().encode(YAML.stringify(appConfig as any)))
    return new App(this.bedrock, appid, appConfig)
  }
}

export class App {
  #bedrock: DoppBedRock
  appDir: string
  volumeDir: string
  envFolder: string
  constructor(bedrock: DoppBedRock, public readonly id: string, public readonly rawConfig: AppConfig) {
    this.#bedrock = bedrock
    this.name = rawConfig.name ?? 'unknown'
    this.appDir = path.join(bedrock.appsDir, id)
    this.volumeDir = path.join(this.appDir, 'volumes')
    this.envFolder = path.join(this.appDir, 'env')

    this.env = (rawConfig.env ?? []).map<AppEnv>(env => {
      if (typeof env === 'string') {
        if (env.startsWith('@')) {
          return {
            type: AppEnvType.File,
            file: env.slice(1)
          }
        } else {
          const [key, value] = env.split('=')
          return {
            type: AppEnvType.Pair,
            key, value
          }
        }
      } else {
        return env
      }
    })

    this.image = rawConfig.image ?? ''
    this.labels = rawConfig.labels ?? []
    this.networks = (rawConfig.networks ?? []).map<AppNetwork>(net => {
      if (typeof net === 'string') {
        if (net === '@') {
          return {
            type: 'bridge',
            name: this.#bedrock.defaultNetwork
          }
        } else {
          return {
            type: 'bridge',
            name: net
          }
        }
      } else {
        return net
      }
    })

    this.volumes = (rawConfig.volumes ?? []).map<AppVolume>(volume => {
      if (typeof volume === 'string') {
        const [source, target] = volume.split(':')
        if (!source || source.startsWith('@')) {
          const name = source.slice(1)
          return {
            type: AppVolumeType.Private,
            source: name || 'default',
            target
          }
        } else if (source.startsWith('.') || source.startsWith('/')) {
          return {
            type: AppVolumeType.Bind,
            source,
            target
          }
        } else {
          return {
            type: AppVolumeType.Volume,
            source, target
          }
        }
      } else {
        return volume
      }
    })
  }

  async prepare() {
    // 创建相关的文件夹
  }

  env: AppEnv[];
  image: string;
  labels: string[];
  name: string;
  networks: AppNetwork[];
  volumes: AppVolume[];

  toComposeJSON(): any {
    let envMap: any = {}
    let envFiles: string[] = []

    for (const env of this.env) {
      switch (env.type) {
        case AppEnvType.File:
          envFiles.push(env.file)
          break
        case AppEnvType.Pair:
          envMap[env.key] = env.value
          break
      }
    }

    return {
      version: '3',
      services: {
        default: {
          image: this.image,
          volumes: this.volumes.map(vol => {
            if (vol.type === AppVolumeType.Private) {
              return {
                type: 'bind',
                source: `./volumes/${vol.source}`,
                target: vol.target
              }
            }
            return vol
          }),
          networks: this.networks.length === 0 ? [this.#bedrock.defaultNetwork] : this.networks.map(net => net.name),
          environment: envMap,
          env_file: envFiles,
          labels: this.labels
        }
      },
      networks: this.networks.length === 0 ? {dopp: {external: true}} : this.networks.reduce<Record<string, any>>((nets, net) => {
        nets[net.name] = {
          external: true
        }
        return nets
      }, {})
    }
  }

  async writeComposeFile() {
    await Deno.writeFile(path.join(this.#bedrock.appsDir, this.id, 'docker-compose.yml'), new TextEncoder().encode(YAML.stringify(this.toComposeJSON())))
  }
}
