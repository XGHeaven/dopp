export * as YAML from "https://deno.land/std@0.67.0/encoding/yaml.ts";
export * as path from "https://deno.land/std@0.67.0/path/mod.ts";
export * as fs from "https://deno.land/std@0.67.0/fs/mod.ts";
export * as flags from "https://deno.land/std@0.67.0/flags/mod.ts";

// @deno-types="./typings/ajv.d.ts"
import Ajv from "https://cdn.skypack.dev/ajv@6.12.2";
export { Ajv };

import yargs from "https://deno.land/x/yargs@v16.0.3-deno/deno.ts";
import * as Yargs from "https://deno.land/x/yargs@v16.0.3-deno/types.ts";
export { yargs, Yargs };
