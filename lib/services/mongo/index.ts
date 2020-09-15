import { ServiceCreator } from "../service.ts";

export const command = 'mongodb'
export const description = 'Manage mongodb service'

export const create: ServiceCreator<{}, {}> = (ctx) => {
  const { bedrock } = ctx
  const appid = 'mongodb'
  return {
    process(app, option) {

    }
  }
}
