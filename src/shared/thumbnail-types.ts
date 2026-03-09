export interface ThumbnailRequest {
  id: string;
  filePath: string;
  size: number;
}

export interface ThumbnailResponse {
  id: string;
  filePath: string;
  dataUrl: string | null;
  error?: string;
}

export type WorkerMessage = 
  | { type: 'process', requests: ThumbnailRequest[] }
  | { type: 'cancel' };
