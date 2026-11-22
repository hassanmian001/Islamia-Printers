import { describe, expect, it } from "vitest";

import { jobTotalCents, sumWorkAmounts, workAmountCents } from "./job-math";

const none = { qty: 0, rateCents: 0 };

describe("job math", () => {
  it("charges quantity x rate for each kind of work", () => {
    expect(workAmountCents({ qty: 2000, rateCents: 150 })).toBe(300_000);
    expect(workAmountCents({ qty: 2.5, rateCents: 120_000 })).toBe(300_000);
    expect(workAmountCents({ qty: 0, rateCents: 500 })).toBe(0);
    expect(workAmountCents({ qty: 10, rateCents: 0 })).toBe(0);
  });

  it("rounds to the nearest paisa", () => {
    expect(workAmountCents({ qty: 0.333, rateCents: 100 })).toBe(33);
    expect(workAmountCents({ qty: 0.335, rateCents: 100 })).toBe(34);
  });

  it("makes the grand total the sum of the five kinds of work", () => {
    expect(
      jobTotalCents({
        rota: { qty: 1000, rateCents: 200 },
        gto: { qty: 1, rateCents: 50_000 },
        cutting: { qty: 1, rateCents: 10_000 },
        lamination: { qty: 100, rateCents: 300 },
        dye: none,
      }),
    ).toBe(200_000 + 50_000 + 10_000 + 30_000);
  });

  it("adds jobs into a sub-total per kind of work", () => {
    const job = (rota: number, dye: number) => ({
      rota: { amountCents: rota },
      gto: { amountCents: 0 },
      cutting: { amountCents: 0 },
      lamination: { amountCents: 0 },
      dye: { amountCents: dye },
    });

    expect(sumWorkAmounts([job(100, 5), job(250, 0)])).toEqual({ rota: 350, gto: 0, cutting: 0, lamination: 0, dye: 5 });
  });
});
