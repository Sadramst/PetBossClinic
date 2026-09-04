import { describe, it, expect } from "vitest";
import { THEME_PRESETS } from "@/lib/theme";

describe("Admin Theme and Configuration Unit Tests", () => {
  it("verifies Pet Boss Luxury Dark is the primary signature preset", () => {
    const signature = THEME_PRESETS.find((p) => p.id === "petboss-luxury-dark");
    expect(signature).toBeDefined();
    expect(signature?.isDark).toBe(true);
    expect(signature?.primaryColor).toBe("#c5a059");
    expect(signature?.bgColor).toBe("#181a20");
  });

  it("verifies all theme presets have bilingual labels", () => {
    for (const preset of THEME_PRESETS) {
      expect(preset.nameFa.length).toBeGreaterThan(0);
      expect(preset.nameEn.length).toBeGreaterThan(0);
      expect(preset.descriptionFa.length).toBeGreaterThan(0);
      expect(preset.descriptionEn.length).toBeGreaterThan(0);
    }
  });

  it("confirms theme preset IDs are unique", () => {
    const ids = THEME_PRESETS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
