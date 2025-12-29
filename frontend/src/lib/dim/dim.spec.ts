import { beforeAll, describe, expect, it, test } from "vitest";
import dim, {
  checkUnitCompatibility,
  checkDimensionalCompatibility,
  getBaseUnit,
} from "./dim";

beforeAll(async () => {
  await dim.init();
});

describe("dim wasm", () => {
  it("evaluates operations with units", () => {
    expect(dim.eval("2 m * 3 m")).toBe("6 m²");
    expect(dim.eval("(9 m^2)^0.5")).toBe("3 m");
    expect(dim.eval("18 m / 3 s")).toBe("6 m/s");
    expect(dim.eval("18 kJ / 3 kg")).toBe("6000 J/kg");
    expect(dim.eval("18 kJ / 3 kg as kJ/kg")).toBe("6 kJ/kg");
    expect(dim.eval("0.5 kW * 36 s / 3 kg as kJ/kg")).toBe("6 kJ/kg");
  });

  it("evaluates identity", () => {
    expect(dim.eval("1 m")).toBe("1 m");
    expect(dim.eval("0.1234567 m")).toBe("0.1234567 m");
    expect(dim.eval("0.1234567 m as m:auto")).toBe("0.123 m");
  });

  it("defines constant and evaluates cast", () => {
    dim.defineConst("c", "299792458 m/s");
    expect(dim.eval("1 c as m/s")).toBe("299792458 m/s");
    expect(dim.eval("10 m/s as c:scientific")).toBe("3.336e-8 c");
  });
});

describe("unit compatibility (one expression, one unit)", () => {
  test("m -> other", () => {
    expect(checkUnitCompatibility("1 m", "m")).toBe(true);
    expect(checkUnitCompatibility("1 mm", "mi")).toBe(true);
    expect(checkUnitCompatibility("1 m", "C")).toBe(false);
    expect(checkUnitCompatibility("1 m", "m/s")).toBe(false);
  });
});

describe("dimensional compatibility (two expressions)", () => {
  test("m -> other", () => {
    expect(checkDimensionalCompatibility("1 m", "1 m")).toBe(true);
    expect(checkDimensionalCompatibility("1 km", "1 ft")).toBe(true);
    expect(checkDimensionalCompatibility("1 m", "1 C")).toBe(false);
    expect(checkDimensionalCompatibility("1 m", "1 m/s")).toBe(false);
  });
});

describe("get base unit", () => {
  test("m", () => {
    expect(getBaseUnit("1 m")).toBe("m");
    expect(getBaseUnit("1 yd")).toBe("m");
    expect(getBaseUnit("1 km")).toBe("m");
  });
});

describe("convert expression to unit", () => {
  test("m -> km", () => {
    expect(dim.convert("1 m", "km")).toBe("0.001 km");
    expect(dim.convert("1 C", "F")).toBe("33.7999999999999 F");
  });
});

describe("convert value to unit", () => {
  test("m -> km", () => {
    expect(dim.convertValue(1, "m", "km")).toBe(0.001);
    expect(dim.convertValue(1, "C", "F")).toBe(33.7999999999999);
  });
});
