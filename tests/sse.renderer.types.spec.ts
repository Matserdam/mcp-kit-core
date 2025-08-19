import { describe, it, expect } from 'vitest';
import type { MCPSSERenderer, MCPSSERawEvent } from '../src';

describe('MCPSSERenderer type surface', () => {
  it('accepts raw events and returns Uint8Array', () => {
    const fakeRenderer: MCPSSERenderer = {
      render(event: MCPSSERawEvent): Uint8Array {
        void event;
        return new Uint8Array([100]);
      },
      renderHeartbeat(): Uint8Array {
        return new Uint8Array([58]);
      },
    };

    const ev: MCPSSERawEvent = { data: 'hello', event: 'message', id: '1', retry: 3000 };
    const bytes1 = fakeRenderer.render(ev);
    const bytes2 = fakeRenderer.renderHeartbeat();
    expect(bytes1).toBeInstanceOf(Uint8Array);
    expect(bytes2).toBeInstanceOf(Uint8Array);
  });
});


