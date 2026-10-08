export type ParsedInput =
  | { kind: "profile"; username: string }
  | { kind: "post"; shortcode: string; url: string; postKind: "post" | "reel" }
  | { kind: "invalid"; reason: string };

const USERNAME_RE = /^[a-z0-9._]{1,30}$/i;

/** Parse "@username", "username", instagram.com/username, or a post/reel URL. */
export function parseAnalyzeInput(raw: string): ParsedInput {
  const input = raw.trim();
  if (!input) return { kind: "invalid", reason: "Empty input" };
  if (input.length > 300) return { kind: "invalid", reason: "Input too long" };

  // URL?
  if (/^(https?:\/\/)?(www\.)?instagram\.com\//i.test(input)) {
    let url: URL;
    try {
      url = new URL(input.startsWith("http") ? input : `https://${input}`);
    } catch {
      return { kind: "invalid", reason: "Malformed URL" };
    }
    const parts = url.pathname.split("/").filter(Boolean);
    const first = parts[0]?.toLowerCase();
    if ((first === "p" || first === "reel" || first === "reels" || first === "tv") && parts[1]) {
      const code = parts[1];
      if (!/^[A-Za-z0-9_-]{5,40}$/.test(code)) return { kind: "invalid", reason: "Invalid post shortcode" };
      return { kind: "post", shortcode: code, url: `https://www.instagram.com/${first === "p" ? "p" : "reel"}/${code}/`, postKind: first === "p" ? "post" : "reel" };
    }
    if (parts.length >= 1 && parts[0] && USERNAME_RE.test(parts[0]) && !["explore", "accounts", "direct", "stories"].includes(first ?? "")) {
      return { kind: "profile", username: parts[0].toLowerCase() };
    }
    return { kind: "invalid", reason: "Unsupported Instagram URL" };
  }

  const username = input.replace(/^@/, "");
  if (!USERNAME_RE.test(username)) return { kind: "invalid", reason: "Username may contain only letters, numbers, dots and underscores (max 30)" };
  return { kind: "profile", username: username.toLowerCase() };
}
