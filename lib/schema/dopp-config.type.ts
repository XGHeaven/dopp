export interface DoppConfig {
  defaultNetwork?: string;
  dockerEndpoint?: string;
  services?: string[];
}

export type Schema = DoppConfig;
