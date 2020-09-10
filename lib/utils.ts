import { App } from "./app.ts";

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
