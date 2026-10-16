import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const temp = mkdtempSync(join(tmpdir(), "gambix-consumer-"));
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

try {
  const packed = JSON.parse(
    execFileSync(npmCmd, ["pack", "--json", "--pack-destination", temp], {
      cwd: root,
      encoding: "utf8",
      shell: process.platform === "win32",
    }),
  );
  const filename = Array.isArray(packed)
    ? packed[0].filename
    : (packed.gambixjs?.filename || Object.values(packed)[0]?.filename);
  if (!filename) throw new Error("Could not determine packed tarball filename");
  const tarball = join(temp, filename);
  const consumer = join(temp, "consumer");
  mkdirSync(consumer);
  execFileSync(npmCmd, ["init", "-y"], {
    cwd: consumer,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  writeFileSync(join(consumer, ".npmrc"), "audit=false\nfund=false\n");
  const installEnv = { ...process.env };
  delete installEnv.npm_config_allow_scripts;
  delete installEnv.npm_config_ignore_scripts;
  execFileSync(npmCmd, ["install", "--no-audit", "--no-fund", tarball], {
    cwd: consumer,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: installEnv,
  });
  writeFileSync(join(consumer, "index.mjs"), 'import Gambix from "gambixjs";\nif (typeof Gambix !== "function") process.exit(1);\n');
  writeFileSync(join(consumer, "index.ts"), 'import Gambix from "gambixjs";\nconst board: Gambix | null = null;\nvoid board;\n');
  execFileSync(process.execPath, ["index.mjs"], { cwd: consumer, stdio: "inherit" });
  execFileSync(
    process.execPath,
    [join(root, "node_modules", "typescript", "bin", "tsc"), "--noEmit", "--module", "nodenext", "--moduleResolution", "nodenext", "--target", "esnext", "index.ts"],
    { cwd: consumer, stdio: "inherit" },
  );
  const consumerPackage = JSON.parse(readFileSync(join(consumer, "node_modules", "gambixjs", "package.json"), "utf8"));
  if (consumerPackage.exports["./style.css"] !== "./dist/bundle.css") throw new Error("CSS export is missing");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
