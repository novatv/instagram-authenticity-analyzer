import { describe, it, expect } from "vitest";
import { parseCsv, detectDelimiter } from "@/utils/csv";
import { importCsv, importJson, rowToAccount, rowToComment } from "@/utils/datasetImport";
import { sanitizeText, toNumber, toIsoDate, toBoolean } from "@/utils/sanitize";
import { parseAnalyzeInput } from "@/utils/parseInput";
import { analyzeDataset } from "@/analysis/analyzeDataset";
import { DEFAULT_SUSPICION_WEIGHTS } from "@/config/weights";

describe("csv parser", () => {
  it("parses quoted fields, escaped quotes and CRLF", () => {
    const r = parseCsv('username,bio\r\n"ana","hello, ""world"""\r\nluis,plain\r\n');
    expect(r.headers).toEqual(["username", "bio"]);
    expect(r.rows[0]).toEqual({ username: "ana", bio: 'hello, "world"' });
    expect(r.rows[1]!.username).toBe("luis");
  });
  it("auto-detects semicolon delimiter and strips BOM", () => {
    expect(detectDelimiter("a;b;c")).toBe(";");
    const r = parseCsv("﻿username;followers\nana;10\n");
    expect(r.rows[0]).toEqual({ username: "ana", followers: "10" });
  });
  it("respects maxRows", () => {
    const r = parseCsv("u\n1\n2\n3\n4", { maxRows: 2 });
    expect(r.rows.length).toBe(2);
  });
});

describe("sanitize", () => {
  it("strips control chars and caps length", () => {
    expect(sanitizeText("a\u0000b\u0007c")).toBe("abc");
    expect(sanitizeText("x".repeat(20), 5)).toBe("xxxxx");
  });
  it("coerces numbers, booleans and dates", () => {
    expect(toNumber("1,234")).toBe(1234);
    expect(toNumber("abc")).toBeUndefined();
    expect(toBoolean("yes")).toBe(true);
    expect(toBoolean("0")).toBe(false);
    expect(toIsoDate("1700000000")).toBe("2023-11-14T22:13:20.000Z");
    expect(toIsoDate("2026-01-02")).toMatch(/^2026-01-02/);
    expect(toIsoDate("nope")).toBeUndefined();
  });
});

describe("dataset import", () => {
  it("maps aliases and rejects bad rows", () => {
    const csv = "Username,Followers,Following,Posts,Has Profile Pic,Last Post\n@ana,120,300,45,yes,2026-05-01\n,1,2,3,no,\nbot_99281,2,4000,0,0,\nana,1,1,1,1,";
    const ds = importCsv(csv, { maxRows: 1000 });
    expect(ds.type).toBe("accounts");
    expect(ds.accounts!.length).toBe(2);
    expect(ds.accounts![0]).toMatchObject({ username: "ana", followersCount: 120, followingCount: 300, postsCount: 45, hasProfilePicture: true });
    expect(ds.rejected.map((r) => r.reason)).toEqual(["missing or invalid username", "duplicate username ana"]);
  });
  it("imports JSON arrays and wrapped objects with metadata", () => {
    const arr = importJson(JSON.stringify([{ username: "a", followers: 1 }, { username: "b" }]), { maxRows: 10 });
    expect(arr.accounts!.length).toBe(2);
    const wrapped = importJson(JSON.stringify({ type: "accounts", followersTotal: 5000, method: "export", accounts: [{ handle: "zz", follows_count: 2000 }] }), { maxRows: 10 });
    expect(wrapped.populationSize).toBe(5000);
    expect(wrapped.method).toBe("export");
    expect(wrapped.accounts![0]!.followingCount).toBe(2000);
    expect(importJson("{bad", { maxRows: 10 }).rejected[0]!.reason).toContain("Invalid JSON");
  });
  it("detects comment datasets and nested author data", () => {
    const ds = importJson(JSON.stringify({ comments: [{ author: { username: "x", followers: 2, following: 3000, posts: 0 }, text: "Nice pic", timestamp: 1700000000 }] }), { maxRows: 10 });
    expect(ds.type).toBe("comments");
    expect(ds.comments![0]!.author?.followingCount).toBe(3000);
    expect(ds.comments![0]!.createdAt).toBeDefined();
    const flat = rowToComment({ username: "y", comment: "hey", followers: "10" }, 0);
    expect("error" in flat ? null : flat.author?.followersCount).toBe(10);
    expect("error" in rowToComment({ username: "y", comment: "" }, 0)).toBe(true);
    expect("error" in rowToAccount({ username: "a", followers: -5 })).toBe(true);
  });
  it("caps rows at maxRows", () => {
    const rows = Array.from({ length: 50 }, (_, i) => `u${i},1`).join("\n");
    const ds = importCsv(`username,followers\n${rows}`, { maxRows: 10 });
    expect(ds.accounts!.length).toBe(10);
  });
  it("end-to-end dataset analysis reports insufficient data for tiny sets", () => {
    const ds = importCsv("username,followers\nana,1\nluis,2", { maxRows: 10 });
    const r = analyzeDataset(ds, DEFAULT_SUSPICION_WEIGHTS);
    expect(r.audience!.status).toBe("insufficient");
    expect(r.confidence.level).toBe("LOW");
  });
});

describe("parseAnalyzeInput", () => {
  it("parses usernames and urls", () => {
    expect(parseAnalyzeInput("@Some.User")).toEqual({ kind: "profile", username: "some.user" });
    expect(parseAnalyzeInput("https://www.instagram.com/p/ABC123xyz/")).toMatchObject({ kind: "post", shortcode: "ABC123xyz", postKind: "post" });
    expect(parseAnalyzeInput("instagram.com/reel/XyZ_-9876?igsh=1")).toMatchObject({ kind: "post", shortcode: "XyZ_-9876", postKind: "reel" });
    expect(parseAnalyzeInput("https://instagram.com/someone")).toEqual({ kind: "profile", username: "someone" });
    expect(parseAnalyzeInput("bad name!").kind).toBe("invalid");
    expect(parseAnalyzeInput("").kind).toBe("invalid");
    expect(parseAnalyzeInput("https://instagram.com/explore/tags/x").kind).toBe("invalid");
  });
});
