/**
 * Hook interface for emitting observability/audit events.
 *
 * Implementations can log, buffer, or forward events to external systems.
 */
export interface EventSink {
  // RPC lifecycle
  rpcReceived?(payload: { id: string | number | null; method: string }): void;
  rpcSucceeded?(payload: { id: string | number | null; method: string }): void;
  rpcFailed?(
    payload: { id: string | number | null; method: string; code: number; message?: string },
  ): void;

  // Tools
  toolCallStart?(payload: { id: string | number | null; name: string }): void;
  toolCallSuccess?(payload: { id: string | number | null; name: string }): void;
  toolCallFail?(
    payload: { id: string | number | null; name: string; code?: number; message?: string },
  ): void;

  // Resources
  resourceReadStart?(payload: { id: string | number | null; uri?: string }): void;
  resourceReadSuccess?(payload: { id: string | number | null; uri?: string }): void;
  resourceReadFail?(
    payload: { id: string | number | null; uri?: string; code?: number; message?: string },
  ): void;

  // Prompts
  promptsGetStart?(payload: { id: string | number | null; name?: string }): void;
  promptsGetSuccess?(payload: { id: string | number | null; name?: string }): void;
  promptsGetFail?(
    payload: { id: string | number | null; name?: string; code?: number; message?: string },
  ): void;

  // List endpoints
  toolsListStart?(payload: { id: string | number | null }): void;
  toolsListSuccess?(payload: { id: string | number | null; count?: number }): void;
  toolsListFail?(payload: { id: string | number | null; code?: number; message?: string }): void;

  promptsListStart?(payload: { id: string | number | null }): void;
  promptsListSuccess?(payload: { id: string | number | null; count?: number }): void;
  promptsListFail?(payload: { id: string | number | null; code?: number; message?: string }): void;

  resourcesListStart?(payload: { id: string | number | null }): void;
  resourcesListSuccess?(payload: { id: string | number | null; count?: number }): void;
  resourcesListFail?(
    payload: { id: string | number | null; code?: number; message?: string },
  ): void;

  resourcesTemplatesListStart?(payload: { id: string | number | null }): void;
  resourcesTemplatesListSuccess?(payload: { id: string | number | null; count?: number }): void;
  resourcesTemplatesListFail?(
    payload: { id: string | number | null; code?: number; message?: string },
  ): void;

  // Toolkit auth
  toolkitAuthStart?(payload: { toolkit?: string }): void;
  toolkitAuthSuccess?(payload: { toolkit?: string }): void;
  toolkitAuthFail?(payload: { toolkit?: string; reason?: string }): void;
}
