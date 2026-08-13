import { describe, expect, it } from "vitest";
import {
  CODE_LENGTHS,
  extractSecretFromInput,
  generateCommissionerSecret,
  generateLeagueCode,
  isValidCommissionerSecretShape,
  isValidLeagueCodeShape,
  normalizeCode,
} from "./codes";

const AMBIGUOUS = ["I", "L", "O", "U"];

describe("generateLeagueCode", () => {
  it("produces a code of the advertised length", () => {
    expect(generateLeagueCode()).toHaveLength(CODE_LENGTHS.leagueCode);
  });

  it("never emits a character that's ambiguous when read aloud", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateLeagueCode();
      for (const char of AMBIGUOUS) {
        expect(code).not.toContain(char);
      }
    }
  });

  it("does not repeat itself across many draws", () => {
    const codes = new Set(
      Array.from({ length: 1000 }, () => generateLeagueCode())
    );
    // 1000 draws from a ~1.07e9 space: a collision is possible but wildly
    // unlikely (~0.05%). A generator stuck on a constant fails loudly here.
    expect(codes.size).toBe(1000);
  });

  it("uses more than a handful of distinct characters", () => {
    const seen = new Set(
      Array.from({ length: 500 }, () => generateLeagueCode()).join("")
    );
    expect(seen.size).toBeGreaterThan(20);
  });
});

describe("generateCommissionerSecret", () => {
  it("produces a code of the advertised length", () => {
    expect(generateCommissionerSecret()).toHaveLength(
      CODE_LENGTHS.commissionerSecret
    );
  });

  it("is long enough to be infeasible to guess", () => {
    // 32^26 is ~130 bits. Guard against someone "simplifying" this later.
    expect(CODE_LENGTHS.commissionerSecret).toBeGreaterThanOrEqual(20);
  });

  it("does not repeat itself across many draws", () => {
    const secrets = new Set(
      Array.from({ length: 500 }, () => generateCommissionerSecret())
    );
    expect(secrets.size).toBe(500);
  });
});

describe("normalizeCode", () => {
  it("uppercases", () => {
    expect(normalizeCode("abc234")).toBe("ABC234");
  });

  it("strips spaces and dashes people add when writing codes down", () => {
    expect(normalizeCode("ABC-234")).toBe("ABC234");
    expect(normalizeCode("  ABC 234  ")).toBe("ABC234");
    expect(normalizeCode("A B-C 2 3 4")).toBe("ABC234");
  });

  it("maps letters that look like digits onto the digit", () => {
    expect(normalizeCode("IL0")).toBe("110");
    expect(normalizeCode("O")).toBe("0");
    expect(normalizeCode("oIl")).toBe("011");
  });

  it("leaves an already-normalized code untouched", () => {
    const code = generateLeagueCode();
    expect(normalizeCode(code)).toBe(code);
  });

  it("round-trips a generated code through lowercase and dashes", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateLeagueCode();
      const mangled = `${code.slice(0, 3)}-${code.slice(3)}`.toLowerCase();
      expect(normalizeCode(mangled)).toBe(code);
    }
  });
});

describe("isValidLeagueCodeShape", () => {
  it("accepts freshly generated codes", () => {
    for (let i = 0; i < 200; i++) {
      expect(isValidLeagueCodeShape(generateLeagueCode())).toBe(true);
    }
  });

  it("rejects the wrong length", () => {
    expect(isValidLeagueCodeShape("ABC23")).toBe(false);
    expect(isValidLeagueCodeShape("ABC2345")).toBe(false);
    expect(isValidLeagueCodeShape("")).toBe(false);
  });

  it("rejects characters outside the alphabet", () => {
    expect(isValidLeagueCodeShape("ABC23I")).toBe(false);
    expect(isValidLeagueCodeShape("ABC23!")).toBe(false);
  });
});

describe("isValidCommissionerSecretShape", () => {
  it("accepts freshly generated secrets", () => {
    for (let i = 0; i < 200; i++) {
      expect(
        isValidCommissionerSecretShape(generateCommissionerSecret())
      ).toBe(true);
    }
  });

  it("rejects a league code (far too short)", () => {
    expect(isValidCommissionerSecretShape(generateLeagueCode())).toBe(false);
  });
});

describe("extractSecretFromInput", () => {
  it("pulls the secret out of a pasted commissioner link", () => {
    const secret = generateCommissionerSecret();
    expect(
      extractSecretFromInput(`https://example.com/commish/enter?secret=${secret}`)
    ).toBe(secret);
  });

  it("handles the secret param sitting after another param", () => {
    const secret = generateCommissionerSecret();
    expect(
      extractSecretFromInput(`https://example.com/commish/enter?x=1&secret=${secret}`)
    ).toBe(secret);
  });

  it("stops at a following param or fragment", () => {
    const secret = generateCommissionerSecret();
    expect(
      extractSecretFromInput(`https://example.com/e?secret=${secret}&next=/board`)
    ).toBe(secret);
    expect(
      extractSecretFromInput(`https://example.com/e?secret=${secret}#top`)
    ).toBe(secret);
  });

  it("accepts a bare code with no URL around it", () => {
    const secret = generateCommissionerSecret();
    expect(extractSecretFromInput(secret)).toBe(secret);
    expect(extractSecretFromInput(`  ${secret.toLowerCase()}  `)).toBe(secret);
  });
});
