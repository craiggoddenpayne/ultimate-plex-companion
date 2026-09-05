export interface PlexConfig {
  plexUrl: string;
  token: string;
  optimization?: {
    plexPathRoot?: string;
    mediaPathRoot?: string;
    crf?: number;
    preset?: 'fast' | 'medium' | 'slow';
  };
}

export interface PlexRequestOptions extends Omit<RequestInit, 'signal'> {
  timeout?: number;
}

export interface PlexMediaContainer<T = Record<string, unknown>> {
  MediaContainer?: T & {
    Metadata?: Array<Record<string, any>>;
    Directory?: Array<Record<string, any>>;
    Hub?: Array<Record<string, any>>;
    size?: number;
    totalSize?: number;
  };
}

export type PlexFetch = <T = PlexMediaContainer>(config: PlexConfig, path: string) => Promise<T>;

export interface PlexClient {
  fetchJson: PlexFetch;
  command(config: PlexConfig, path: string, method?: string): Promise<void>;
  deleteMedia(config: PlexConfig, path: string): Promise<void>;
  artwork(config: PlexConfig, ratingKey: string | number): Promise<Response>;
}
