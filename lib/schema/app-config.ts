export interface AppVolume {
  source: string
  target: string
  type: string
}

// 配置定义
export interface AppConfig {
  name?: string
  image?: string
  env?: (string | AppEnv)[]
  volumes?: (string | AppVolume)[]
  networks?: (string | AppNetwork)[]
  labels?: string[]
  extends?: string | string[]
  services?: AppService[]
}

export enum AppEnvType {
  File = 'file',
  Pair = 'pair'
}

export interface AppEnvFile {
  type: AppEnvType.File,
  file: string
}

export interface AppEnvPair {
  type: AppEnvType.Pair,
  key: string,
  value: string
}

export interface AppNetwork {
  type: string
  name: string
}

export type AppEnv = AppEnvFile | AppEnvPair

export interface AppService {
  use: string

  [key: string]: any
}

export type Schema = AppConfig
