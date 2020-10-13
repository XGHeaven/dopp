import { App } from "./app.ts";
import { DoppBedRock } from "./bedrock.ts";

export function parseEnv(env: string) {
  return env.trim().split("\n").map((line) =>
    line.split("=").map((item) => item.trim())
  ).reduce<Record<string, string>>((env, [k, v]) => {
    env[k] = v;
    return env;
  }, {});
}

export function stringifyEnv(env: Record<string, string>) {
  return Object.entries(env).map((line) => line.join("=")).join("\n");
}

export async function runComposeCommand(
  app: App,
  cmds: string[],
  quiet: boolean = false,
) {
  const ret = await Deno.run({
    cmd: ["docker-compose", ...cmds],
    cwd: app.appDir,
    stdin: quiet ? "null" : "inherit",
    stderr: quiet ? "null" : "inherit",
    stdout: quiet ? "null" : "inherit",
  }).status();

  if (!ret.success) {
    Deno.exit(ret.code);
  }
}

export async function runDockerCommand(
  bedrock: DoppBedRock,
  cmds: string[],
  quiet: boolean = false,
) {
  const ret = await Deno.run({
    cmd: ["docker", ...cmds],
    cwd: bedrock.root,
    stdin: quiet ? "null" : "inherit",
    stderr: quiet ? "null" : "inherit",
    stdout: quiet ? "null" : "inherit",
  }).status();

  return ret;
}

export function generatePassword(length = 32) {
  return new Array(length).fill(0).map(() =>
    Math.floor((Math.random() * 36)).toString(36)
  ).join("");
}

export function mapValues<T extends Record<string, V>, V, R>(
  object: T,
  mapper: (value: V, key: string) => R,
): Record<string, R> {
  return Object.entries(object).reduce<Record<string, any>>(
    (newObject, [key, value]) => {
      newObject[key] = mapper(value, key);
      return newObject;
    },
    {},
  );
}

export function renderEnvTemplate(template: string, value: any) {
  return new Function(
    `{${Object.keys(value).join(",")}}`,
    `return \`${template}\``,
  )(value);
}
