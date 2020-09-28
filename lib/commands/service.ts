import { DoppBedRock } from "../bedrock.ts";
import { Yargs } from "../deps.ts";
import {
  BUILTIN_SERVICES,
  BUILTIN_SERVICE_FORCE_ENABLED,
} from "../services/hub.ts";

export default function (bedrock: DoppBedRock) {
  return {
    command: "service",
    description: "Manage service",
    builder: (yargs: Yargs.YargsType): any =>
      yargs.demandCommand().command(
        "add <url>",
        "Add service of url or name",
        () => {},
        async ({ url }: any) => {
          const services = await bedrock.getConfig("services");
          if (services.includes(url)) {
            console.log(`${url} has been added`);
            return;
          }

          if (BUILTIN_SERVICES[url]) {
            if (BUILTIN_SERVICE_FORCE_ENABLED.includes(url)) {
              console.log(
                `Service ${url} enable by default. Don't add it again.`,
              );
              return;
            }
            await bedrock.setConfig("services", [...services, url]);
            console.log(`Success add a built in service: ${url}`);
          } else {
            await import(url);
            await bedrock.setConfig("services", [...services, url]);
            console.log(`Success add a remote service: ${url}`);
          }
        },
      ).command(
        "remove <url>",
        "Remove service of url of name",
        () => {},
        async ({ url }: any) => {
          const services = await bedrock.getConfig("services");

          if (services.includes(url)) {
            services.splice(services.indexOf(url), 1);
            await bedrock.setConfig("services", services);
            console.log(`Remove ${url} success`);
          } else {
            console.log(`Cannot found ${url} service`);
          }
        },
      ).command("list", "List all installed service", () => {}, async () => {
        const services = await bedrock.getConfig("services");
        console.log(services);
      }).command("builtin", "List all built-in service", () => {}, async () => {
        const services = await bedrock.getConfig("services");
        console.table(
          Object.entries(BUILTIN_SERVICES).map(([name, Service]) => ({
            name,
            description: Service.description ?? "",
            enabled: BUILTIN_SERVICE_FORCE_ENABLED.includes(name)
              ? "builtin"
              : services.includes(name)
              ? "enabled"
              : "disabled",
          })),
        );
      }),
    handler: () => {},
  };
}
