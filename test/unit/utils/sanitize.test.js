/**
 * Test suite for sanitization utilities
 * Tests: M5 - XSS prevention in user inputs
 */

import { describe, it, expect } from "@jest/globals";
import {
  sanitizeText,
  sanitizeHtml,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeFilename,
  sanitizeObject,
} from "../../../src/utils/sanitize.js";

describe("Sanitization Utilities - M5: XSS Prevention", () => {
  describe("sanitizeText - Basic Input Sanitization", () => {
    it("should remove script tags from text", () => {
      const input = 'Hello <script>alert("XSS")</script> World';
      const result = sanitizeText(input);
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("alert");
    });

    it("should remove event handlers from text", () => {
      const input = 'Click <img src=x onerror="alert(1)"> here';
      const result = sanitizeText(input);
      expect(result).not.toContain("onerror");
      expect(result).not.toContain("alert");
    });

    it("should handle safe text without modification", () => {
      const input = "This is safe text with no HTML";
      const result = sanitizeText(input);
      expect(result).toContain("This is safe text");
    });

    it("should remove potentially dangerous protocols", () => {
      const input = 'Click <a href="javascript:alert(1)">here</a>';
      const result = sanitizeText(input);
      expect(result).not.toContain("javascript:");
    });

    it("should handle empty and null inputs gracefully", () => {
      expect(sanitizeText("")).toBe("");
      expect(sanitizeText(null)).toBe("");
      expect(sanitizeText(undefined)).toBe("");
    });

    it("should preserve safe formatting", () => {
      const input = "Some <b>bold</b> and <em>italic</em> text";
      const result = sanitizeText(input);
      expect(result).toContain("bold");
      expect(result).toContain("italic");
    });

    it("should remove data URIs", () => {
      const input = '<img src="data:text/html,<script>alert(1)</script>">';
      const result = sanitizeText(input);
      expect(result).not.toContain("data:");
    });
  });

  describe("sanitizeHtml - HTML Content Sanitization", () => {
    it("should allow safe HTML tags", () => {
      const input = "<p>Safe paragraph <b>with bold</b></p>";
      const result = sanitizeHtml(input);
      expect(result).toContain("paragraph");
      expect(result).toContain("bold");
    });

    it("should remove script tags even in HTML", () => {
      const input = '<p>Text</p><script>alert("XSS")</script>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain("<script>");
    });

    it("should remove event handler attributes", () => {
      const input = '<div onclick="alert(1)">Click me</div>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain("onclick");
    });
  });

  describe("sanitizeEmail - Email Input Validation", () => {
    it("should remove HTML from email addresses", () => {
      const input = "user<script></script>@example.com";
      const result = sanitizeEmail(input);
      expect(result).not.toContain("<script>");
    });

    it("should preserve valid email format", () => {
      const input = "user@example.com";
      const result = sanitizeEmail(input);
      expect(result).toBe("user@example.com");
    });

    it("should remove dangerous characters", () => {
      const input = 'user\\"@example.com';
      const result = sanitizeEmail(input);
      expect(result).not.toContain('\\"');
    });
  });

  describe("sanitizeUrl - URL Sanitization", () => {
    it("should allow safe URLs", () => {
      const input = "https://example.com/path";
      const result = sanitizeUrl(input);
      expect(result).toBe("https://example.com/path");
    });

    it("should remove javascript: protocol", () => {
      const input = "javascript:alert(1)";
      const result = sanitizeUrl(input);
      expect(result).not.toContain("javascript:");
    });

    it("should remove data: protocol", () => {
      const input = "data:text/html,<script>alert(1)</script>";
      const result = sanitizeUrl(input);
      expect(result).not.toContain("data:");
    });

    it("should handle empty URLs gracefully", () => {
      expect(sanitizeUrl("")).toBe("");
      expect(sanitizeUrl(null)).toBe("");
    });
  });

  describe("sanitizeFilename - File Upload Sanitization", () => {
    it("should remove path traversal attempts", () => {
      const input = "../../../etc/passwd";
      const result = sanitizeFilename(input);
      expect(result).not.toContain("..");
      expect(result).not.toContain("/");
    });

    it("should remove special characters", () => {
      const input = "file<script>.txt";
      const result = sanitizeFilename(input);
      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
    });

    it("should preserve alphanumeric and safe characters", () => {
      const input = "my-document_2024.pdf";
      const result = sanitizeFilename(input);
      expect(result).toContain("my");
      expect(result).toContain("document");
      expect(result).toContain("2024");
      expect(result).toContain("pdf");
    });

    it("should handle consecutive spaces and dots", () => {
      const input = "file  name..pdf";
      const result = sanitizeFilename(input);
      expect(result.length).toBeLessThan(input.length);
    });

    it("should enforce maximum length", () => {
      const input = "a".repeat(500) + ".txt";
      const result = sanitizeFilename(input);
      expect(result.length).toBeLessThanOrEqual(255);
    });

    it("should handle null/undefined gracefully", () => {
      expect(sanitizeFilename(null)).toBe("file");
      expect(sanitizeFilename(undefined)).toBe("file");
    });
  });

  describe("sanitizeObject - Batch Object Sanitization", () => {
    it("should sanitize specified fields in an object", () => {
      const input = {
        name: "User<script>alert(1)</script>",
        email: "user@example.com",
        description: "Test <img src=x onerror=alert(1)>",
      };

      const fieldsToSanitize = ["name", "description"];
      const result = sanitizeObject(input, fieldsToSanitize);

      expect(result.name).not.toContain("<script>");
      expect(result.email).toBe("user@example.com");
      expect(result.description).not.toContain("onerror");
    });

    it("should preserve non-string fields", () => {
      const input = {
        name: "John",
        age: 30,
        active: true,
        tags: ["tag1", "tag2"],
        metadata: { key: "value" },
      };

      const fieldsToSanitize = ["name"];
      const result = sanitizeObject(input, fieldsToSanitize);

      expect(result.age).toBe(30);
      expect(result.active).toBe(true);
      expect(result.tags).toEqual(["tag1", "tag2"]);
      expect(result.metadata).toEqual({ key: "value" });
    });

    it("should handle missing fields gracefully", () => {
      const input = {
        name: "User<script></script>",
      };

      const fieldsToSanitize = ["name", "description", "notes"];
      const result = sanitizeObject(input, fieldsToSanitize);

      expect(result.name).not.toContain("<script>");
      expect(result.description).toBeUndefined();
    });

    it("should use custom sanitizer function if provided", () => {
      const input = {
        name: "User<b>Name</b>",
        description: "Test<b>Desc</b>",
      };

      const customSanitizer = (text) => text.replace(/<[^>]*>/g, "");
      const fieldsToSanitize = ["name"];

      const result = sanitizeObject(input, fieldsToSanitize, {
        customSanitizer,
      });

      expect(result.name).toBe("UserName");
      // description should use default sanitizer, not custom
      expect(result.description).toContain("Test");
    });

    it("should handle null/undefined input gracefully", () => {
      expect(sanitizeObject(null, ["name"])).toEqual({});
      expect(sanitizeObject(undefined, ["name"])).toEqual({});
    });
  });

  describe("Real-World Attack Vectors (M5 - XSS Prevention Validation)", () => {
    it("should prevent stored XSS in expense description", () => {
      const maliciousDescription =
        "Lunch <img src=x onerror=\"fetch('http://attacker.com')\"> for team";
      const sanitized = sanitizeText(maliciousDescription);

      expect(sanitized).not.toContain("onerror");
      expect(sanitized).not.toContain("fetch");
    });

    it("should prevent DOM-based XSS in vendor names", () => {
      const maliciousVendor =
        "ACME Corp<script>document.location='http://attacker.com'</script>";
      const sanitized = sanitizeText(maliciousVendor);

      expect(sanitized).not.toContain("<script>");
      expect(sanitized).not.toContain("document.location");
    });

    it("should prevent reflected XSS through notes field", () => {
      const maliciousNote = '"><svg onload=alert("XSS")>';
      const sanitized = sanitizeText(maliciousNote);

      expect(sanitized).not.toContain("onload");
      expect(sanitized).not.toContain("alert");
    });

    it("should prevent polyglot XSS attacks", () => {
      const polyglotXss =
        '";alert(String.fromCharCode(88,83,83))//";alert(String.fromCharCode(88,83,83));';
      const sanitized = sanitizeText(polyglotXss);

      expect(sanitized).not.toContain("alert");
      expect(sanitized).not.toContain("fromCharCode");
    });

    it("should handle Unicode escape sequences safely", () => {
      const unicodeXss =
        "Test\\u003cscript\\u003ealert(1)\\u003c/script\\u003e";
      const sanitized = sanitizeText(unicodeXss);

      expect(sanitized).not.toContain("<script>");
    });
  });
});
