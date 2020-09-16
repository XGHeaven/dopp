import { ServiceContext, ServiceCreator } from "../service.ts";
import { App } from "../../app.ts";
import { Yargs, path } from "../../deps.ts";
import { Templates } from "./template.ts";
import { createAppSSSCommand } from "../../commands/app.ts";

interface TraefikServiceOptions {
  entrypoints?: string[];
  hostname?: string;
  port?: number;
  custom?: string[];
  type?: "http" | "tcp" | "udp";
  tls?: boolean;
  healthcheck?: {};
}

interface TraefikServiceConfig {
}

export const command = "traefik";
export const description = "Manage traefik service";

export const create: ServiceCreator<
  TraefikServiceConfig,
  TraefikServiceOptions
> = (ctx) => {
  const { bedrock } = ctx;

  async function init() {
    if (await bedrock.appHub.hasApp("traefik")) {
      console.log("Traefik app has been inited");
      return;
    }

    const app = await bedrock.appHub.newApp("traefik", {
      name: "traefik",
      image: "traefik",
      volumes: ["@:/etc/traefik", "/var/run/docker.sock:/var/run/docker.sock"],
      ports: ["80:80", "443:443"],
    });

    await app.build();

    for (const [file, content] of Object.entries(Templates)) {
      await Deno.writeFile(
        path.join(app.getVolumeDir("default"), file),
        content,
      );
    }
  }

  return {
    process(app: App, options: TraefikServiceOptions): void {
      const labels: string[] = ["traefik.enable=true"];
      const id = app.id;
      const esc = id.replaceAll(".", "_");

      // TODO: 根据配置自动获取网络信息
      labels.push(`traefik.docker.network=dopp`);

      if (options.hostname) {
        if (options.type === "tcp") {
          labels.push(
            `traefik.tcp.routers.${esc}.rule=HostSNI(\`${options.hostname}\`)`,
          );
        } else if (options.type !== "udp") {
          labels.push(
            `traefik.http.routers.${esc}.rule=Host(\`${options.hostname}\`)`,
          );
        }
        // TODO: udp
      }
      if (options.port) {
        labels.push(
          `traefik.http.services.${esc}.loadbalancer.server.port=${options.port}`,
        );
      }

      if (options.tls) {
        if (options.type === "tcp") {
          labels.push(`traefik.tcp.routers.${esc}.tls=true`);
        } else if (options.type !== "udp") {
          labels.push(`traefik.http.routers.${esc}.tls=true`);
        }
      }

      app.labels.push(...labels);
    },

    command(yargs: Yargs.YargsType): Yargs.YargsType {
      return ctx.registeProcessCommand(
        yargs.demandCommand().command(
          "init",
          "Init traefik service",
          () => {},
          () => init(),
        ),
        "traefik",
      );
    },
  };
};
