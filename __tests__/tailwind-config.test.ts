import { describe, it, expect } from "vitest";
import tailwindConfig from "../apps/web/tailwind.config";
import type { Config } from "tailwindcss";

describe("Tailwind Configuration", () => {
  it("should be a valid Tailwind config object", () => {
    expect(tailwindConfig).toBeDefined();
    expect(typeof tailwindConfig).toBe("object");
  });

  it("should have content paths configured", () => {
    expect(tailwindConfig.content).toBeDefined();
    expect(Array.isArray(tailwindConfig.content)).toBe(true);
    expect(tailwindConfig.content.length).toBeGreaterThan(0);
  });

  describe("Custom Colors", () => {
    it("should have primary color palette defined", () => {
      const theme = tailwindConfig.theme as any;
      expect(theme?.extend?.colors?.primary).toBeDefined();

      // Check for key color shades
      expect(theme.extend.colors.primary).toHaveProperty("50");
      expect(theme.extend.colors.primary).toHaveProperty("500");
      expect(theme.extend.colors.primary).toHaveProperty("600");
      expect(theme.extend.colors.primary).toHaveProperty("700");
    });

    it("should have accent color defined", () => {
      const theme = tailwindConfig.theme as any;
      expect(theme?.extend?.colors?.accent).toBeDefined();
      expect(typeof theme.extend.colors.accent).toBe("string");
    });

    it("should have brand colors already defined (existing)", () => {
      const theme = tailwindConfig.theme as any;
      expect(theme?.extend?.colors?.brand).toBeDefined();
      expect(theme.extend.colors.brand).toHaveProperty("500");
    });
  });

  describe("Custom Fonts", () => {
    it("should have custom font families defined", () => {
      const theme = tailwindConfig.theme as any;
      expect(theme?.extend?.fontFamily).toBeDefined();
    });

    it("should have Inter font for sans-serif", () => {
      const theme = tailwindConfig.theme as any;
      expect(theme?.extend?.fontFamily?.sans).toBeDefined();
      expect(Array.isArray(theme.extend.fontFamily.sans)).toBe(true);
      expect(theme.extend.fontFamily.sans).toContain("Inter");
    });

    it("should have Montserrat font for display text", () => {
      const theme = tailwindConfig.theme as any;
      expect(theme?.extend?.fontFamily?.display).toBeDefined();
      expect(Array.isArray(theme.extend.fontFamily.display)).toBe(true);
      expect(theme.extend.fontFamily.display).toContain("Montserrat");
    });
  });

  describe("Dark Mode", () => {
    it("should have dark mode configured", () => {
      expect(tailwindConfig.darkMode).toBeDefined();
    });

    it("should use class-based dark mode strategy", () => {
      // Class-based allows for manual toggle, while 'media' uses prefers-color-scheme
      expect(tailwindConfig.darkMode).toBe("class");
    });
  });

  describe("Plugins", () => {
    it("should have plugins array defined", () => {
      expect(tailwindConfig.plugins).toBeDefined();
      expect(Array.isArray(tailwindConfig.plugins)).toBe(true);
    });
  });

  describe("Animations", () => {
    it("should have custom animations defined", () => {
      const theme = tailwindConfig.theme as any;
      expect(theme?.extend?.animation).toBeDefined();
    });

    it("should have pulse-slow animation already defined (existing)", () => {
      const theme = tailwindConfig.theme as any;
      expect(theme?.extend?.animation?.["pulse-slow"]).toBeDefined();
    });
  });
});
