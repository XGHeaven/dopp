import { App } from "./app.ts";
import { DoppBedRock } from "./bedrock.ts";
import { path } from "./deps.ts";
import { asserts } from "./test-utils.ts";

function createBedrock() {
  const root = path.join(
    Deno.cwd(),
    ".test",
    (~~(Math.random() * 255)).toString(16),
  );
  return new DoppBedRock(root);
}

Deno.test({
  name: "support _compose and _compose_service",
  fn: async () => {
    const bedrock = createBedrock();
    const app = new App(
      bedrock,
      "test",
      {
        _compose: { foo: "foo" },
        _compose_service: { bar: "bar" },
      },
      [],
      [],
      [],
    );

    asserts.assertEquals(app.toComposeJSON(), {
      foo: "foo",
      version: "3",
      networks: {
        dopp: {
          external: true,
        },
      },
      services: {
        default: {
          bar: "bar",
          env_file: [],
          environment: {},
          hostname: "test",
          image: "",
          labels: [],
          networks: {
            dopp: {
              aliases: ["test"],
            },
          },
          ports: [],
          volumes: [],
        },
      },
    });
  },
});
