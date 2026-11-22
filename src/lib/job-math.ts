/**
 * The arithmetic of a printing job, shared by the database layer and the
 * screens so a bill always totals the same way in both places.
 *
 * Each job is charged for up to five kinds of work. Every kind is quantity x
 * rate; the job's grand total is the sum of the five amounts.
 */
export const workKinds = ["rota", "gto", "cutting", "lamination", "dye"] as const;

export type WorkKind = (typeof workKinds)[number];

export const workLabels: Record<WorkKind, string> = {
  rota: "Rota P",
  gto: "GTO P",
  cutting: "Cutting",
  lamination: "Lamination",
  dye: "Dye",
};

export type WorkChargeInput = {
  qty: number;
  rateCents: number;
};

export type WorkCharge = WorkChargeInput & {
  amountCents: number;
};

export type WorkAmounts = Record<WorkKind, number>;

/** Quantity x rate, rounded to the nearest paisa. Quantities may be fractional (2.5 packets). */
export function workAmountCents(charge: WorkChargeInput) {
  if (charge.qty === 0 || charge.rateCents === 0) {
    return 0;
  }

  return Math.round(charge.qty * charge.rateCents);
}

export function jobTotalCents(job: Record<WorkKind, WorkChargeInput>) {
  return workKinds.reduce((sum, kind) => sum + workAmountCents(job[kind]), 0);
}

export function emptyWorkAmounts(): WorkAmounts {
  return { rota: 0, gto: 0, cutting: 0, lamination: 0, dye: 0 };
}

/** Adds each job's per-work amounts into one row, as a bill's or a report's sub-total. */
export function sumWorkAmounts(jobs: Array<Record<WorkKind, { amountCents: number }>>): WorkAmounts {
  const totals = emptyWorkAmounts();

  for (const job of jobs) {
    for (const kind of workKinds) {
      totals[kind] += job[kind].amountCents;
    }
  }

  return totals;
}
