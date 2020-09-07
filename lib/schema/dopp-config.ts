export interface DoppConfig {
  defaultNetwork?: string;
  dockerEndpoint?: string;
  services?: (string | [string, any?])[];
}

export type Schema = DoppConfig;
