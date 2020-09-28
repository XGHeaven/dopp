import { ConfigController } from "./config.ts";
import { fs, path } from "./deps.ts";
import { asserts } from "./test-utils.ts";

const testDir = path.join(Deno.cwd(), ".test", "config");

function randomFolder() {
  return path.join(testDir, Math.floor(Math.random() * 239 + 16).toString(16));
}

async function initConfigFile(file: string, content: string) {
  await fs.ensureDir(path.dirname(file));
  await Deno.writeTextFile(file, content);
}

await fs.emptyDir(testDir);

Deno.test({
  name: "should return empty object when no config file found",
  fn: async () => {
    const folder = randomFolder();
    const config = new ConfigController(folder, "config");

    asserts.assertEquals(await config.getConfig("foo"), undefined);
  },
});

Deno.test({
  name: "should get defaultValue if provide",
  fn: async () => {
    const folder = randomFolder();
    await initConfigFile(
      path.join(folder, "config.json"),
      JSON.stringify({ foo: 1 }),
    );
    const config = new ConfigController(folder, "config");

    asserts.assertEquals(await config.getConfig("foo"), 1);
    asserts.assertEquals(await config.getConfig("foo", 2), 1);
    asserts.assertEquals(await config.getConfig("bar"), undefined);
    asserts.assertEquals(await config.getConfig("bar", 1), 1);
  },
});

Deno.test({
  name: "should save success",
  fn: async () => {
    const folder = randomFolder();
    const configPath = path.join(folder, "config.json");
    await initConfigFile(configPath, JSON.stringify({ foo: 0 }));
    const config = new ConfigController(folder, "config");

    asserts.assertEquals(await config.getConfig("foo"), 0);
    await config.setConfig("foo", 1);
    asserts.assertEquals(await config.getConfig("foo"), 1);
    asserts.assertEquals(
      JSON.parse(await Deno.readTextFile(configPath)).foo,
      1,
    );
  },
});
