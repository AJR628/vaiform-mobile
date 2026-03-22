import { describe, expect, test } from "@jest/globals";

import {
  formatRenderTimeAmount,
  formatRenderTimeLeft,
  getEstimatedUsageSec,
  getSettledBilledSec,
} from "@/lib/renderUsage";

describe("client/lib/renderUsage", () => {
  test("formats short render durations in seconds", () => {
    expect(formatRenderTimeAmount(4.1)).toBe("5s");
    expect(formatRenderTimeAmount(0)).toBe("0s");
  });

  test("formats minute render durations with seconds", () => {
    expect(formatRenderTimeAmount(61.1)).toBe("1m 2s");
  });

  test("formats remaining render time or dash for invalid values", () => {
    expect(formatRenderTimeLeft(59.2)).toBe("1m 0s left");
    expect(formatRenderTimeLeft(-1)).toBe("—");
  });

  test("extracts estimated usage seconds from the session billing estimate", () => {
    expect(
      getEstimatedUsageSec({ billingEstimate: { estimatedSec: 11.2 } }),
    ).toBe(12);
    expect(
      getEstimatedUsageSec({ billingEstimate: { estimatedSec: 0 } }),
    ).toBeNull();
  });

  test("extracts settled billed seconds from the session billing payload", () => {
    expect(getSettledBilledSec({ billing: { billedSec: 13.1 } })).toBe(14);
    expect(getSettledBilledSec({ billing: { billedSec: -3 } })).toBeNull();
  });
});
