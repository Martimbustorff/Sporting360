const mockStores: Record<string, { delete: jest.Mock; clearAll: jest.Mock; getBoolean: jest.Mock; set: jest.Mock }> = {};
const mockFlags: Record<string, boolean> = {};
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn((opts?: { id?: string }) => {
    const id = opts?.id ?? 'default';
    if (!mockStores[id]) {
      mockStores[id] = {
        delete: jest.fn(),
        clearAll: jest.fn(),
        getBoolean: jest.fn((k: string) => mockFlags[`${id}:${k}`]),
        set: jest.fn((k: string, v: boolean) => { mockFlags[`${id}:${k}`] = v; }),
      };
    }
    return mockStores[id];
  }),
}));

import { legacyCleanup } from '@/services/legacyCleanup';

describe('legacyCleanup', () => {
  it('deletes passcodecert and clears the V2 persist store on first call, then does nothing', () => {
    legacyCleanup();
    expect(mockStores.default!.delete).toHaveBeenCalledWith('passcodecert');
    expect(mockStores['app-persist-storage']!.clearAll).toHaveBeenCalledTimes(1);
    expect(mockStores.s360!.set).toHaveBeenCalledWith('s360.legacyCleanupDone', true);

    legacyCleanup();
    expect(mockStores.default!.delete).toHaveBeenCalledTimes(1);
    expect(mockStores['app-persist-storage']!.clearAll).toHaveBeenCalledTimes(1);
  });
});
