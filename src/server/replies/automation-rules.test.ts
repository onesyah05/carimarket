import { describe, expect, it } from "vitest";
import { isWithinQuietHours } from "./automation-rules";

const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 9, 10, hour, minute));

describe("isWithinQuietHours", () => {
  it("tidak aktif saat jam tenang dimatikan", () => {
    expect(isWithinQuietHours({ quietHoursEnabled: false, quietHoursStart: "22:00", quietHoursEnd: "07:00" }, at(23))).toBe(false);
  });

  it("tidak aktif saat jam belum lengkap", () => {
    expect(isWithinQuietHours({ quietHoursEnabled: true, quietHoursStart: null, quietHoursEnd: "07:00" }, at(23))).toBe(false);
  });

  it("menangani rentang yang melewati tengah malam", () => {
    const setting = { quietHoursEnabled: true, quietHoursStart: "22:00", quietHoursEnd: "07:00" };
    expect(isWithinQuietHours(setting, at(23))).toBe(true);
    expect(isWithinQuietHours(setting, at(3))).toBe(true);
    expect(isWithinQuietHours(setting, at(7))).toBe(false);
    expect(isWithinQuietHours(setting, at(12))).toBe(false);
  });

  it("menangani rentang dalam satu hari", () => {
    const setting = { quietHoursEnabled: true, quietHoursStart: "09:00", quietHoursEnd: "17:00" };
    expect(isWithinQuietHours(setting, at(8, 59))).toBe(false);
    expect(isWithinQuietHours(setting, at(9))).toBe(true);
    expect(isWithinQuietHours(setting, at(16, 59))).toBe(true);
    expect(isWithinQuietHours(setting, at(17))).toBe(false);
  });

  it("mengabaikan rentang nol dan format tidak valid", () => {
    expect(isWithinQuietHours({ quietHoursEnabled: true, quietHoursStart: "08:00", quietHoursEnd: "08:00" }, at(8))).toBe(false);
    expect(isWithinQuietHours({ quietHoursEnabled: true, quietHoursStart: "24:00", quietHoursEnd: "07:00" }, at(1))).toBe(false);
    expect(isWithinQuietHours({ quietHoursEnabled: true, quietHoursStart: "malam", quietHoursEnd: "pagi" }, at(1))).toBe(false);
  });
});
