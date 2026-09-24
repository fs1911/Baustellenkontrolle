import { defineConfig, type Plugin } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Build für Cloudflare Workers (vinext). Der Node.js-Build (`next build`) bleibt unverändert.
 * Native bzw. nicht benötigte Module werden durch Stubs ersetzt (siehe docs/deployment.md).
 */
/**
 * pdfkit berechnet beim Laden einen Dateipfad aus `import.meta.url` (nur für PDF/A nötig).
 * In Workers ist `import.meta.url` keine gültige Basis-URL → Pfad als einfacher String.
 */
function pdfkitWorkersFix(): Plugin {
  return {
    name: "bk-pdfkit-workers-fix",
    transform(code, id) {
      if (!id.includes("pdfkit") || !code.includes("sRGB_IEC61966_2_1.icc")) return null;
      return code.replace(
        /new URL\((['"])\.\/data\/sRGB_IEC61966_2_1\.icc\1,\s*import\.meta\.url\)\.href/g,
        "'./data/sRGB_IEC61966_2_1.icc'",
      );
    },
  };
}

/**
 * Der PDF-Renderer (@react-pdf) bringt einen eigenen React-Reconciler mit und braucht das vollständige
 * React. In der RSC-Umgebung würde "react" auf die react-server-Variante aufgelöst (ohne Client-Interna).
 * Next.js löst das über `serverExternalPackages`; hier wird "react" nur für @react-pdf umgeleitet.
 */
function reactPdfFullReact(): Plugin {
  const fullReact = path.resolve(import.meta.dirname, "node_modules/react/index.js");
  return {
    name: "bk-react-pdf-full-react",
    enforce: "pre",
    resolveId(source, importer) {
      if (source === "react" && importer?.includes("/node_modules/@react-pdf/")) return fullReact;
      return null;
    },
  };
}

/**
 * Die Layout-Engine von @react-pdf (yoga-layout) kompiliert eingebettetes WebAssembly zur Laufzeit –
 * das ist in Workers verboten. Das Binary wird deshalb beim Build als .wasm-Datei abgelegt, als
 * vorkompiliertes Modul importiert (CompiledWasm) und über den Emscripten-Hook `instantiateWasm` geladen.
 */
function yogaWorkersFix(): Plugin {
  const root = import.meta.dirname;
  const wasmPath = path.resolve(root, ".vinext/yoga.wasm");
  return {
    name: "bk-yoga-workers-fix",
    enforce: "pre",
    buildStart() {
      const source = readFileSync(path.resolve(root, "node_modules/yoga-layout/dist/binaries/yoga-wasm-base64-esm.js"), "utf8");
      const match = source.match(/data:application\/octet-stream;base64,([A-Za-z0-9+/=]+)/);
      if (!match) throw new Error("yoga-layout: eingebettetes WebAssembly nicht gefunden");
      mkdirSync(path.dirname(wasmPath), { recursive: true });
      writeFileSync(wasmPath, Buffer.from(match[1], "base64"));
    },
    transform(code, id) {
      if (!id.replace(/\\/g, "/").endsWith("/yoga-layout/dist/src/load.js")) return null;
      return [
        `import yogaModule from ${JSON.stringify(wasmPath)};`,
        `import loadYogaImpl from "../binaries/yoga-wasm-base64-esm.js";`,
        `import wrapAssembly from "./wrapAssembly.js";`,
        `export async function loadYoga() {`,
        `  return wrapAssembly(await loadYogaImpl({`,
        `    instantiateWasm(imports, receiveInstance) {`,
        `      WebAssembly.instantiate(yogaModule, imports).then(receiveInstance);`,
        `      return {};`,
        `    },`,
        `  }));`,
        `}`,
        `export * from "./generated/YGEnums.js";`,
      ].join("\n");
    },
  };
}

export default defineConfig({
  plugins: [
    pdfkitWorkersFix(),
    reactPdfFullReact(),
    yogaWorkersFix(),
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
  resolve: {
    alias: [
      { find: /^sharp$/, replacement: path.resolve(import.meta.dirname, "src/lib/workers/sharp-stub.ts") },
      // Browser-Varianten von pdfkit/@react-pdf/font: Standardschriften statisch eingebunden
      // statt zur Laufzeit per require() geladen (in Workers nicht möglich).
      { find: /^pdfkit$/, replacement: path.resolve(import.meta.dirname, "node_modules/pdfkit/js/pdfkit.browser.mjs") },
      {
        find: /^@react-pdf\/font$/,
        replacement: path.resolve(import.meta.dirname, "node_modules/@react-pdf/font/lib/index.browser.js"),
      },
    ],
  },
});
