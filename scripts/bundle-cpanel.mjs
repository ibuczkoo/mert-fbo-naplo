// cPanel-telepítőcsomag: egyetlen szerverfájl (minden függőséggel), a webes felület
// és a migrációk egy zip-ben. A tárhelyen nem kell npm install és terminál sem.
//
//   pnpm build && node scripts/bundle-cpanel.mjs
//
// Kimenet: dist-cpanel/ és dist-cpanel/mert-fbo-naplo-cpanel-<verzió>.zip
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist-cpanel");
const app = path.join(out, "app");
const { version } = JSON.parse(readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root }).toString().trim();

rmSync(out, { recursive: true, force: true });
mkdirSync(app, { recursive: true });

await build({
  entryPoints: [path.join(root, "apps/api/src/server.ts")],
  outfile: path.join(app, "server.mjs"),
  bundle: true,
  platform: "node",
  target: "node20.2",
  format: "esm",
  minify: false,
  sourcemap: false,
  legalComments: "none",
  // A CommonJS függőségek (mysql2, fastify-részek) require-t várnak az ESM-csomagban is.
  banner: {
    js: [
      "import { createRequire as __cr } from 'node:module';",
      "const require = __cr(import.meta.url);",
    ].join("\n"),
  },
  logLevel: "warning",
});

// Passenger (cPanel Node.js App) CommonJS-ként tölti be az indítófájlt,
// ezért egy kis .cjs indító hívja be az ESM-szervert.
writeFileSync(
  path.join(app, "app.cjs"),
  `// cPanel "Setup Node.js App" indítófájl – MERT FBŐ napló ${version} (${commit})
const path = require("node:path");
const { pathToFileURL } = require("node:url");
process.env.MIGRATIONS_DIR ??= path.join(__dirname, "migrations");
process.env.WEB_DIST_DIR ??= path.join(__dirname, "web");
import(pathToFileURL(path.join(__dirname, "server.mjs")).href).catch((err) => {
  console.error("Az alkalmazás nem indult el:", err);
  process.exit(1);
});
`,
);
writeFileSync(
  path.join(app, "package.json"),
  JSON.stringify({ name: "mert-fbo-naplo", version, private: true, description: `build ${commit}` }, null, 2) + "\n",
);
cpSync(path.join(root, "apps/api/migrations"), path.join(app, "migrations"), { recursive: true });
cpSync(path.join(root, "apps/web/dist"), path.join(app, "web"), { recursive: true });

const zipName = `mert-fbo-naplo-cpanel-${version}-${commit}.zip`;
execFileSync("zip", ["-qr", path.join(out, zipName), "."], { cwd: app });
console.log(`Kész: dist-cpanel/${zipName}`);
