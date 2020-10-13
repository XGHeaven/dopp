import { App } from "../../app.ts";
import { renderEnvTemplate } from "../../utils.ts";

export interface NormalizeEnvOptions {
  useURL?: boolean | string;
  custom?: Record<string, string>;
  prefix?: string;
}

export function normalizeEnvList(
  variable: Record<string, string>,
  urlString: string,
  defaultPrefix: string,
  options: NormalizeEnvOptions,
): string[] {
  const rets: string[] = [];
  if (options.useURL) {
    rets.push(
      `${
        typeof options.useURL === "string" ? options.useURL : "DATABASE_URL"
      }=${urlString}`,
    );
  } else if (options.custom) {
    rets.push(
      ...Object.entries(options.custom).map(([key, value]) =>
        [
          key,
          renderEnvTemplate(value, variable),
        ].join("=")
      ),
    );
  } else {
    const prefix = options.prefix ?? defaultPrefix;
    rets.push(
      ...Object.entries(variable).map(
        ([key, value]) => `${prefix}_${key}=${value}`,
      ),
    );
  }

  return rets;
}

export function processInlineEnv(
  name: string,
  app: App,
  inline: boolean,
  envs: string[],
) {
  if (inline) {
    for (const env of envs) {
      app.appendEnv(env);
    }
  } else {
    app.createEnv(name, envs);
    app.appendEnv(`@${name}`);
  }
}
