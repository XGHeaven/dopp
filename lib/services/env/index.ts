import { Yargs } from '../../deps.ts'
import { Service, ServiceContext } from "../service.ts"

interface EnvServiceConfig {
  envs: Record<string, Record<string, string>>
}

interface EnvServiceOptions {
  name?: string | string[]
  inline?: boolean
}

export const command = 'env'
export const description = 'Manage environment'
export function create(ctx: ServiceContext<EnvServiceConfig>): Service<EnvServiceOptions> {
  const { bedrock } = ctx

  async function update(name: string, pairs: Record<string, string>, removes: string[]) {
    const envs = await ctx.getConfig('envs', {})
    const env = Object.assign({}, envs[name], pairs)

    for (const key of removes) {
      delete env[key]
    }

    envs[name] = env
    await ctx.setConfig('envs', envs)
  }

  async function remove(name: string) {
    const envs = await ctx.getConfig('envs', {})

    if (envs[name]) {
      delete envs[name]
      await ctx.setConfig('envs', envs)
    }
  }

  async function list(name?: string) {
    const envs = await ctx.getConfig('envs', {})
    if (name) {
      const env = envs[name]
      if (!env) {
        console.log(`Canot found ${name} env`)
        return
      }

      console.table(env)
    } else {
      for (const [key, value] of Object.entries(envs)) {
        console.log(`${key}(${Object.keys(value).length})`)
      }
    }
  }

  function parseEnvExpr(exprs: string[]): [Record<string, string>, string[]] {
    const pairs: Record<string, string> = {}
    const removes: string[] = []

    for (const expr of exprs) {
      if (expr.includes('=')) {
        const [key, value] = expr.split('=')
        pairs[key.trim()] = value.trim()
      } else if (expr.startsWith('!')) {
        removes.push(expr.slice(1))
      }
    }

    return [pairs, removes]
  }

  return {
    async process(app, options) {
      if (!options.name) {
        return;
      }
      const names = typeof options.name === 'string' ? [options.name] : options.name
      const envs = await ctx.getConfig('envs', {})
      const inline = options.inline ?? true

      for (const name of names) {
        const env = envs[name]
        if (!env) {
          continue
        }

        if (inline) {
          for (const [key, value] of Object.entries(env)) {
            app.appendEnv(`${key}=${value}`)
          }
        } else {
          app.createEnv(`env-service-${name}`, env)
          app.appendEnv(`@env-service-${name}`)
        }
      }
    },
    command(yargs: Yargs.YargsType) {
      return yargs.demandCommand().command('set <name> <pairs..>', 'Create or update a env', () => {}, async (args: any) => {
        const [added, removes] = parseEnvExpr(args.pairs)
        await update(args.name, added, removes)
      }).command('remove <name>', 'Remove a env', () => {}, ({name}: any) => remove(name)).command('list [name]', 'List infomation of env', () => {}, ({name}: any) => list(name))
    }
  }

}
