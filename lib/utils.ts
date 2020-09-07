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
