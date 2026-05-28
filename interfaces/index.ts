export interface ErrorDocument {
  message: string;
  stack?: string;
  source?: string;
  context?: Record<string, unknown>;
  createdAt: number;
}
