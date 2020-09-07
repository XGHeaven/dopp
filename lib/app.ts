import { DoppBedRock } from "./bedrock.ts";
import { Ajv, fs, path, YAML } from './deps.ts'
import { AppConfig, AppEnv, AppEnvType, AppNetwork, AppVolume } from "./schema/app-config.ts";
import { Schema } from './schema/app-config-schema.ts'

export enum AppVolumeType {
  Volume = 'volume',
  Bind = 'bind',
  Private = 'private'
}

export class AppHub {
  #ajv = new Ajv()
  #validate = this.#ajv.compile(Schema)
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

    return await App.create(this.bedrock, appid, appConfig)
  }

  async hasApp(appid: string): Promise<boolean> {
    return await fs.exists(path.join(this.bedrock.appsDir, appid))
  }

  async newApp(appid: string, appConfig: AppConfig = {}): Promise<App> {
    const appDir = path.join(this.bedrock.appsDir, appid)
    if (await fs.exists(appDir)) {
      return (await this.getApp(appid))!
    }

    await Deno.mkdir(appDir, {recursive: true})
    await Deno.writeFile(path.join(appDir, 'app.yml'), new TextEncoder().encode(YAML.stringify(appConfig as any, {skipInvalid: true})))
    return await App.create(this.bedrock, appid, appConfig)
  }
}

export class App {
  static async create(bedrock: DoppBedRock, id: string, rawConfig: AppConfig): Promise<App> {
    const env = (rawConfig.env ?? []).map<AppEnv>(env => {
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

    const networks = (rawConfig.networks ?? []).map<AppNetwork>(net => {
      if (typeof net === 'string') {
        if (net === '@') {
          return {
            type: 'bridge',
            name: bedrock.defaultNetwork
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

    const volumes = (rawConfig.volumes ?? []).map<AppVolume>(volume => {
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

    let app = new App(bedrock, id, rawConfig, env, networks, volumes)

    for (const {use, ...options} of rawConfig.services??[]) {
      const service = await bedrock.serviceHub.get<any>(use)
      if (!service) {
        continue
      }
      if (service.validate && !service.validate(options)) {
        // TODO: print
        continue
      }
      app = (await service.process(app, options)) ?? app
    }

    return app
  }

  readonly name: string;
  readonly appDir: string
  readonly volumeDir: string
  readonly envFolder: string
  readonly labels: string[]
  readonly image: string

  get ports() {
    return this.rawConfig.ports ?? []
  }

  constructor(
    private bedrock: DoppBedRock,
    public readonly id: string,
    public readonly rawConfig: AppConfig,
    public readonly env: AppEnv[],
    public readonly networks: AppNetwork[],
    public readonly volumes: AppVolume[],
  ) {
    this.name = rawConfig.name ?? 'unknown'
    this.appDir = path.join(bedrock.appsDir, id)
    this.volumeDir = path.join(this.appDir, 'volumes')
    this.envFolder = path.join(this.appDir, 'env')
    this.labels = rawConfig.labels ?? []
    this.image = rawConfig.image ?? ''
  }

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
          hostname: this.id,
          container_name: this.id,
          ports: this.ports,
          volumes: this.volumes.map(vol => {
            if (vol.type === AppVolumeType.Private) {
              return `./volumes/${vol.source}:${vol.target}`
            }
            if (vol.type === AppVolumeType.Bind) {
              return `${vol.source}:${vol.target}`
            }
            return vol
          }),
          networks: this.networks.length === 0 ? [this.bedrock.defaultNetwork] : this.networks.map(net => net.name),
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

  getVolumeDir(name: string = 'default') {
    return path.join(this.volumeDir, name)
  }

  async build() {
    for(const volume of this.volumes) {
      if (volume.type === AppVolumeType.Private) {
        await fs.ensureDir(path.join(this.volumeDir, volume.source))
      }
    }
    await Deno.writeFile(path.join(this.bedrock.appsDir, this.id, 'docker-compose.yml'), new TextEncoder().encode(YAML.stringify(this.toComposeJSON())))
  }
}
