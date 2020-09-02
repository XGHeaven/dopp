import { Service } from "./service.ts";
import { App } from "../app.ts";
import { Yargs } from "../deps.ts";
import { DoppBedRock } from "../bedrock.ts";

interface TraefikServiceOptions {
  entrypoints?: string[]
  hostname?: string
  port?: number
  custom?: string[]
  type?: 'http' | 'tcp' | 'udp'
  tls?: boolean;
  healthcheck?: {

  }
}

export class TraefikService implements Service<TraefikServiceOptions> {
  constructor(public bedrock: DoppBedRock){}

  process(app: App, options: TraefikServiceOptions): App | undefined {
    const labels: string[] = ['traefik.enable=true']
    const id = app.id

    // TODO: 根据配置自动获取网络信息
    labels.push(`traefik.docker.network=dopp`)

    if (options.hostname) {
      if (options.type === 'tcp') {
        labels.push(`traefik.http.routers."${id}".rule=Host(\`${options.hostname}\`)`)
      } else if (options.type !== 'udp') {
        labels.push(`traefik.tcp.routers."${id}".rule=HostSNI(\`${options.hostname}\`)`)
      }
      // TODO: udp
    }
    if (options.port) {
      labels.push(`traefik.http.services."${id}".loadbalancer.server.port=${options.port}`)
    }

    if (options.tls) {
      if (options.type === 'tcp') {
        labels.push(`traefik.tcp.routers."${id}".tls=true`)
      } else if (options.type !== 'udp') {
        labels.push(`traefik.http.routers."${id}".tls=true`)
      }
    }

    app.labels.push(...labels)
    return app
  }

  command(yargs: Yargs.YargsType): Yargs.YargsType {
    return yargs;
  }
}
