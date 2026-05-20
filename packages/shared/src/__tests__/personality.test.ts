import { describe, expect, it } from "vitest";
import { DEFAULT_PERSONALITY_ITEMS, scorePersonality } from "../personality.js";

describe("scorePersonality", () => {
  it("scores reversed items correctly and preserves work values", () => {
    const answers = DEFAULT_PERSONALITY_ITEMS.map((item) => ({
      id: item.id,
      value: item.reverse ? 1 : 5
    }));
    const profile = scorePersonality(answers, { autonomy: 90, remote: 80 });

    expect(profile.traits.openness).toBeGreaterThan(90);
    expect(profile.traits.conscientiousness).toBeGreaterThan(90);
    expect(profile.workValues.autonomy).toBe(90);
    expect(profile.workValues.remote).toBe(80);
  });
});
