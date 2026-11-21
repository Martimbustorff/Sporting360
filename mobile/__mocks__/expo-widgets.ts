// Mock do expo-widgets (módulo nativo só do iOS). As atividades ficam numa lista que os testes podem ler e limpar.
type Listener = (e: { activityPushToStartToken: string }) => void;

export const __pushToStart: { listeners: Listener[] } = { listeners: [] };
export const __activities: { id: string; props: unknown; url?: string; token: string | null }[] = [];

export const widgetsDirectory = 'file:///group/ExpoWidgets/';

export const addPushToStartTokenListener = jest.fn((l: Listener) => {
  __pushToStart.listeners.push(l);
  return { remove: jest.fn(() => (__pushToStart.listeners = __pushToStart.listeners.filter((x) => x !== l))) };
});

class MockActivity {
  constructor(private readonly rec: (typeof __activities)[number]) {}
  getId() {
    return this.rec.id;
  }
  getPushToken() {
    return Promise.resolve(this.rec.token);
  }
  addPushTokenListener() {
    return { remove: jest.fn() };
  }
  update = jest.fn(() => Promise.resolve());
  end = jest.fn(() => Promise.resolve());
}

export function createLiveActivity() {
  return {
    start: jest.fn((props: unknown, url?: string) => {
      const rec = { id: `act-${__activities.length + 1}`, props, url, token: null };
      __activities.push(rec);
      return new MockActivity(rec);
    }),
    getInstances: jest.fn(() => __activities.map((r) => new MockActivity(r))),
  };
}

export const createWidget = jest.fn();
