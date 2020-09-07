import { TraefikService } from "./traefik/index.ts";
import { Service } from "./service.ts";
import { DoppBedRock } from "../bedrock.ts";
import { Yargs, yargs } from "../deps.ts";

export const BUILTIN_SERVICES: Record<string, any> = {
  traefik: TraefikService,
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

function createServiceLoader(ServiceCtr: any, options?: any): ServiceLoader {
  const loader = async (bedrock: DoppBedRock) => {
    if (ServiceCtr.create) {
      return Promise.resolve(ServiceCtr.create(bedrock, options));
    }
    return Promise.resolve(new ServiceCtr(bedrock, options));
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
    const services = bedrock.services;
    const serviceLoaders: Record<string, ServiceLoader> = {};

    const results = await Promise.all(
      services.map(async (config): Promise<[string, any, any?]> => {
        const url = typeof config === "string" ? config : config[0];
        const options = typeof config === "string" ? undefined : config[1];
        const ctr = await loadCtr(url);
        const name = BUILTIN_SERVICES[url]
          ? url
          : ctr.service ?? ctr.name ?? "unknown-service";
        return [name, ctr, options];
      }),
    );

    for (const [name, ctr, config] of results) {
      serviceLoaders[name] = createServiceLoader(ctr, config);
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
