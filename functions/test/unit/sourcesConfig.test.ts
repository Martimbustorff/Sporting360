import { API_SPORTS } from "../../src/modalities/sourcesConfig";

describe("API_SPORTS", () => {
  for (const [sport, cfg] of Object.entries(API_SPORTS)) {
    it(`${sport}: se estiver ativo, tem ids confirmados`, () => {
      if (!cfg.enabled) return;
      expect(cfg.teamId).not.toBeNull();
      expect(cfg.teamId).toBeGreaterThan(0);
      for (const l of cfg.leagues) {
        expect(l.id).not.toBeNull();
        expect(l.covered).not.toBeNull();
      }
    });
  }
});
