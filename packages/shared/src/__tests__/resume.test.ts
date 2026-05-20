import { describe, expect, it } from "vitest";
import { parseResume } from "../resume.js";

describe("parseResume", () => {
  it("extracts contact, skills, and years", () => {
    const parsed = parseResume(`
      Maya Patel
      maya@example.com
      +1 415 555 0199
      https://github.com/maya
      Senior Full Stack Engineer with 7 years building React, TypeScript, Node.js, Postgres, and AWS systems.
    `);

    expect(parsed.name).toBe("Maya Patel");
    expect(parsed.email).toBe("maya@example.com");
    expect(parsed.skills).toEqual(expect.arrayContaining(["React", "TypeScript", "Node.js", "Postgres", "AWS"]));
    expect(parsed.yearsExperience).toBe(7);
  });
});
