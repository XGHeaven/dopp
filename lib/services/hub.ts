import { Service, ServiceContext } from "./service.ts";
import { DoppBedRock } from "../bedrock.ts";
import { Yargs, yargs } from "../deps.ts";

import * as TraefikService from "./traefik/index.ts";
import * as MysqlService from "./mysql/index.ts";
import * as MongodbService from "./mongo/index.ts";
import * as EnvService from './env/index.ts'

export const BUILTIN_SERVICES: Record<string, any> = {
  traefik: TraefikService,
  mysql: MysqlService,
  mongodb: MongodbService,
  env: EnvService
};

async function loadCtr(url: string) {
  if (BUILTIN_SERVICES[url]) {
    return BUILTIN_SERVICES[url];
  }

  const mod = await import(url);
  if (mod.default) {
    return mod.default;
  }

  return mod;
}

function createServiceLoader(
  ServiceCtr: any,
  context: ServiceContext<any>,
): ServiceLoader {
  const loader = async (bedrock: DoppBedRock) => {
    if (ServiceCtr.create) {
      // 类创建函数
      return Promise.resolve(ServiceCtr.create(context));
    }
    return Promise.resolve(new ServiceCtr(context));
  };
  loader.Service = ServiceCtr;
  return loader;
}

interface ServiceLoader {
  (bedrock: DoppBedRock): Promise<Service<any>>;
  Service: any;
}

export class ServiceHub {
  static async create(bedrock: DoppBedRock) {
    // env 是默认启动的
    const services = ['env'].concat(bedrock.services);
    const serviceLoaders: Record<string, ServiceLoader> = {};

    const results = await Promise.all(
      services.map(async (url): Promise<[string, any]> => {
        const ctr = await loadCtr(url);
        const name = BUILTIN_SERVICES[url]
          ? url
          : ctr.service ?? ctr.name ?? "unknown-service";
        return [name, ctr];
      }),
    );

    for (const [name, ctr] of results) {
      const ctx = new ServiceContext(bedrock, name);
      serviceLoaders[name] = createServiceLoader(ctr, ctx);
    }

    return new ServiceHub(bedrock, serviceLoaders);
  }

  private loadedService: Record<string, Service<any>> = {};

  constructor(
    private bedrock: DoppBedRock,
    private services: Record<string, ServiceLoader>,
  ) {
  }

  async get<O>(name: string): Promise<Service<O>> {
    if (!this.loadedService[name]) {
      if (!this.services[name]) {
        throw new Error(
          `Cannot found ${name} service, please make sure you loaded it`,
        );
      }
      this.loadedService[name] = await this.services[name](this.bedrock);
    }
    return this.loadedService[name];
  }

  async loadAll(): Promise<Service<any>[]> {
    return await Promise.all(
      Object.keys(this.services).map((name) => this.get(name)),
    );
  }

  async getAllCommands(): Promise<any[]> {
    return (await Promise.all(
      Object.entries(this.services).map(async ([name, { Service }]) => {
        if (Service.command) {
          const service = await this.get(name);
          if (service.command) {
            return {
              command: Service.command,
              description: Service.description,
              builder: (yargs: Yargs.YargsType) => service.command!(yargs),
            };
          }
        }
      }),
    )).filter(Boolean);
  }
}
