import fs from "node:fs";
import path from "node:path";

// Read at build time. Static export means none of this runs at request time,
// and only what a page actually passes down reaches the client bundle.
function read<T>(name: string): T {
  const p = path.join(process.cwd(), "public", "data", name);
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

export type Sawtooth = {
  quarter: string;
  dow: Record<string, number>;
  weekday: number;
  weekend: number;
  gap_pct: number;
  agency_share: number;
  rn_share: number;
  facility_days: number;
  facilities: number;
  percentiles: Record<string, number>;
  n_full_quarter: number;
  n_drop20: number;
  n_healthy: number;
  n_healthy_drop20: number;
};

export type Arm = {
  label: string;
  n_train: number;
  n_test: number;
  positives: number;
  positive_rate: number;
  auc_baseline: number;
  auc_challenger: number;
  brier_baseline: number;
  brier_challenger: number;
  delta_auc: number;
  ci_low: number;
  ci_high: number;
  criterion_delta: boolean;
  criterion_ci: boolean;
  criterion_brier: boolean;
  verdict: string;
};

export type Results = {
  model: { primary: Arm; contemporaneous: Arm | { withheld: true } };
  diagnostics: {
    redundancy: Record<string, Record<string, number>>;
    interpretable: {
      n: number;
      pseudo_r2: number;
      coefficients: Record<
        string,
        { coef: number; p: number; expected: string; observed: string; significant: boolean }
      >;
    };
    neg_binomial: { shape_significant: Record<string, number> };
    penalty_outcome: { surveys: number; events: number; usable: boolean };
  };
};

export type Redundancy = {
  r: number;
  n_total: number;
  points: [number, number, number][];
  correlations: Record<string, Record<string, number>>;
};

export type Flagged = {
  criteria: { mean_hprd_min: number; weekend_drop_min_pct: number; quarter: string };
  schema: string[];
  rows: [string, string, string, string, number, number, number | null][];
};

// NEW — the weekend-drop histogram, already exported by the analysis step
// but not previously read by the site.
export type GapHist = { bin_width: number; bins: [number, number][] };

export const getSawtooth = () => read<Sawtooth>("sawtooth.json");
export const getResults = () => read<Results>("results.json");
export const getRedundancy = () => read<Redundancy>("redundancy.json");
export const getFlagged = () => read<Flagged>("flagged.json");
export const getGapHist = () => read<GapHist>("gap_hist.json");
