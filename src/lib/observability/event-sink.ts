import type { EventSink } from '../../types/observability';

export class NoopEventSink implements EventSink {}

export class ConsoleEventSink implements EventSink {
  private write(event: string, payload: unknown): void {
    try {
      // Use console.debug to avoid noisy stdout in production logs.
      console.debug(`[event] ${event}`, payload);
    } catch {
      // swallow
    }
  }

  rpcReceived(payload: { id: string | number | null; method: string }): void {
    this.write('rpc.received', payload);
  }
  rpcSucceeded(payload: { id: string | number | null; method: string }): void {
    this.write('rpc.succeeded', payload);
  }
  rpcFailed(payload: { id: string | number | null; method: string; code: number; message?: string }): void {
    this.write('rpc.failed', payload);
  }

  toolCallStart(payload: { id: string | number | null; name: string }): void {
    this.write('tool.call.start', payload);
  }
  toolCallSuccess(payload: { id: string | number | null; name: string }): void {
    this.write('tool.call.success', payload);
  }
  toolCallFail(payload: { id: string | number | null; name: string; code?: number; message?: string }): void {
    this.write('tool.call.fail', payload);
  }

  resourceReadStart(payload: { id: string | number | null; uri?: string }): void {
    this.write('resource.read.start', payload);
  }
  resourceReadSuccess(payload: { id: string | number | null; uri?: string }): void {
    this.write('resource.read.success', payload);
  }
  resourceReadFail(payload: { id: string | number | null; uri?: string; code?: number; message?: string }): void {
    this.write('resource.read.fail', payload);
  }

  promptsGetStart(payload: { id: string | number | null; name?: string }): void {
    this.write('prompts.get.start', payload);
  }
  promptsGetSuccess(payload: { id: string | number | null; name?: string }): void {
    this.write('prompts.get.success', payload);
  }
  promptsGetFail(payload: { id: string | number | null; name?: string; code?: number; message?: string }): void {
    this.write('prompts.get.fail', payload);
  }

  toolsListStart(payload: { id: string | number | null }): void {
    this.write('tools.list.start', payload);
  }
  toolsListSuccess(payload: { id: string | number | null; count?: number }): void {
    this.write('tools.list.success', payload);
  }
  toolsListFail(payload: { id: string | number | null; code?: number; message?: string }): void {
    this.write('tools.list.fail', payload);
  }

  promptsListStart(payload: { id: string | number | null }): void {
    this.write('prompts.list.start', payload);
  }
  promptsListSuccess(payload: { id: string | number | null; count?: number }): void {
    this.write('prompts.list.success', payload);
  }
  promptsListFail(payload: { id: string | number | null; code?: number; message?: string }): void {
    this.write('prompts.list.fail', payload);
  }

  resourcesListStart(payload: { id: string | number | null }): void {
    this.write('resources.list.start', payload);
  }
  resourcesListSuccess(payload: { id: string | number | null; count?: number }): void {
    this.write('resources.list.success', payload);
  }
  resourcesListFail(payload: { id: string | number | null; code?: number; message?: string }): void {
    this.write('resources.list.fail', payload);
  }

  resourcesTemplatesListStart(payload: { id: string | number | null }): void {
    this.write('resources.templates.list.start', payload);
  }
  resourcesTemplatesListSuccess(payload: { id: string | number | null; count?: number }): void {
    this.write('resources.templates.list.success', payload);
  }
  resourcesTemplatesListFail(payload: { id: string | number | null; code?: number; message?: string }): void {
    this.write('resources.templates.list.fail', payload);
  }

  toolkitAuthStart(payload: { toolkit?: string }): void {
    this.write('toolkit.auth.start', payload);
  }
  toolkitAuthSuccess(payload: { toolkit?: string }): void {
    this.write('toolkit.auth.success', payload);
  }
  toolkitAuthFail(payload: { toolkit?: string; reason?: string }): void {
    this.write('toolkit.auth.fail', payload);
  }
}

export class InMemoryEventSink implements EventSink {
  public events: Array<{ event: string; payload: unknown; timestamp: number }> = [];

  private record(event: string, payload: unknown): void {
    this.events.push({ event, payload, timestamp: Date.now() });
  }

  clear(): void {
    this.events = [];
  }

  getEvents(eventType?: string): Array<{ event: string; payload: unknown; timestamp: number }> {
    return eventType ? this.events.filter(e => e.event === eventType) : this.events;
  }

  rpcReceived(payload: { id: string | number | null; method: string }): void {
    this.record('rpc.received', payload);
  }
  rpcSucceeded(payload: { id: string | number | null; method: string }): void {
    this.record('rpc.succeeded', payload);
  }
  rpcFailed(payload: { id: string | number | null; method: string; code: number; message?: string }): void {
    this.record('rpc.failed', payload);
  }

  toolCallStart(payload: { id: string | number | null; name: string }): void {
    this.record('tool.call.start', payload);
  }
  toolCallSuccess(payload: { id: string | number | null; name: string }): void {
    this.record('tool.call.success', payload);
  }
  toolCallFail(payload: { id: string | number | null; name: string; code?: number; message?: string }): void {
    this.record('tool.call.fail', payload);
  }

  resourceReadStart(payload: { id: string | number | null; uri?: string }): void {
    this.record('resource.read.start', payload);
  }
  resourceReadSuccess(payload: { id: string | number | null; uri?: string }): void {
    this.record('resource.read.success', payload);
  }
  resourceReadFail(payload: { id: string | number | null; uri?: string; code?: number; message?: string }): void {
    this.record('resource.read.fail', payload);
  }

  promptsGetStart(payload: { id: string | number | null; name?: string }): void {
    this.record('prompts.get.start', payload);
  }
  promptsGetSuccess(payload: { id: string | number | null; name?: string }): void {
    this.record('prompts.get.success', payload);
  }
  promptsGetFail(payload: { id: string | number | null; name?: string; code?: number; message?: string }): void {
    this.record('prompts.get.fail', payload);
  }

  toolsListStart(payload: { id: string | number | null }): void {
    this.record('tools.list.start', payload);
  }
  toolsListSuccess(payload: { id: string | number | null; count?: number }): void {
    this.record('tools.list.success', payload);
  }
  toolsListFail(payload: { id: string | number | null; code?: number; message?: string }): void {
    this.record('tools.list.fail', payload);
  }

  promptsListStart(payload: { id: string | number | null }): void {
    this.record('prompts.list.start', payload);
  }
  promptsListSuccess(payload: { id: string | number | null; count?: number }): void {
    this.record('prompts.list.success', payload);
  }
  promptsListFail(payload: { id: string | number | null; code?: number; message?: string }): void {
    this.record('prompts.list.fail', payload);
  }

  resourcesListStart(payload: { id: string | number | null }): void {
    this.record('resources.list.start', payload);
  }
  resourcesListSuccess(payload: { id: string | number | null; count?: number }): void {
    this.record('resources.list.success', payload);
  }
  resourcesListFail(payload: { id: string | number | null; code?: number; message?: string }): void {
    this.record('resources.list.fail', payload);
  }

  resourcesTemplatesListStart(payload: { id: string | number | null }): void {
    this.record('resources.templates.list.start', payload);
  }
  resourcesTemplatesListSuccess(payload: { id: string | number | null; count?: number }): void {
    this.record('resources.templates.list.success', payload);
  }
  resourcesTemplatesListFail(payload: { id: string | number | null; code?: number; message?: string }): void {
    this.record('resources.templates.list.fail', payload);
  }

  toolkitAuthStart(payload: { toolkit?: string }): void {
    this.record('toolkit.auth.start', payload);
  }
  toolkitAuthSuccess(payload: { toolkit?: string }): void {
    this.record('toolkit.auth.success', payload);
  }
  toolkitAuthFail(payload: { toolkit?: string; reason?: string }): void {
    this.record('toolkit.auth.fail', payload);
  }
}


