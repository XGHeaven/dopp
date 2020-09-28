export interface DoppConfig {
  defaultNetwork?: string;
  dockerEndpoint?: string;
  services?: string[];
  bindHostTimezone?: boolean;
}

export type Schema = DoppConfig;
