/**
 * Job Handler Registry
 *
 * Maps job types to execution handlers.
 */

import { JobHandler } from './types';

class HandlerRegistry {
  private handlers = new Map<string, JobHandler>();

  public register(type: string, handler: JobHandler): void {
    if (this.handlers.has(type)) {
      console.warn(`[JobRegistry] Overwriting existing handler for type '${type}'`);
    }
    this.handlers.set(type, handler);
  }

  public get(type: string): JobHandler | undefined {
    return this.handlers.get(type);
  }

  public has(type: string): boolean {
    return this.handlers.has(type);
  }

  public listRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  public clear(): void {
    this.handlers.clear();
  }
}

export const jobRegistry = new HandlerRegistry();
