import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmAction } from './confirm';

describe('confirmAction', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks the native dialog and returns its answer', () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('window', { confirm });
    expect(confirmAction('Delete?')).toBe(true);
    expect(confirm).toHaveBeenCalledWith('Delete?');
    confirm.mockReturnValue(false);
    expect(confirmAction('Delete?')).toBe(false);
  });
});
