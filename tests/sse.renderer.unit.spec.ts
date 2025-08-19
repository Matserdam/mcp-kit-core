import { describe, it, expect } from 'vitest';
import { createSseRenderer } from '../src/lib/sse';

describe('createSseRenderer', () => {
  it('renders simple data frame with event and id and retry', () => {
    const r = createSseRenderer();
    const bytes = r.render({ event: 'message', id: '1', retry: 2000, data: 'hello' });
    const text = new TextDecoder().decode(bytes);
    expect(text).toBe('event: message\nid: 1\nretry: 2000\ndata: hello\n\n');
  });

  it('renders multi-line data properly', () => {
    const r = createSseRenderer();
    const bytes = r.render({ data: 'a\nb' });
    const text = new TextDecoder().decode(bytes);
    expect(text).toBe('data: a\ndata: b\n\n');
  });

  it('renders heartbeat as comment when configured', () => {
    const r = createSseRenderer({ commentHeartbeat: true });
    const hb = r.renderHeartbeat();
    expect(new TextDecoder().decode(hb)).toBe(':heartbeat\n\n');
  });
});


