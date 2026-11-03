import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

function formatBuildTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function ensureFileHeaderBanner(filePath: string, bannerLine: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  const stripped = raw.replace(/^\/\*![^\n]*\*\/\r?\n?/, '');
  fs.writeFileSync(filePath, `${bannerLine}\n${stripped}`, 'utf8');
}

function compareSemverStr(a?: string, b?: string): number {
  if (!a || a === 'static') return -1;
  if (!b || b === 'static') return 1;
  const pa = String(a).replace(/^[vV]/, '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^[vV]/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na > nb ? 1 : -1;
  }
  return 0;
}

function syncAndTouchVersionFiles(): { version: string; buildTime: string; vTag: number } {
  const rootVersionPath = path.resolve(__dirname, 'version.json');
  const pkgPath = path.resolve(__dirname, 'package.json');
  const srcVersionTsPath = path.resolve(__dirname, 'src/version.ts');

  let vData: any = {};
  let pkgData: any = null;
  let srcTsVersion: string | undefined;

  try {
    if (fs.existsSync(rootVersionPath)) {
      vData = JSON.parse(fs.readFileSync(rootVersionPath, 'utf8'));
    }
  } catch (_) {}
  try {
    if (fs.existsSync(pkgPath)) {
      pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    }
  } catch (_) {}
  try {
    if (fs.existsSync(srcVersionTsPath)) {
      const tsText = fs.readFileSync(srcVersionTsPath, 'utf8');
      const m = tsText.match(/SDK_VERSION\s*=[^\n]*?['"]v?(\d+\.\d+\.\d+)['"]/);
      if (m) srcTsVersion = m[1];
    }
  } catch (_) {}

  const candidates = [vData.version, vData.frontend?.version, vData.backend?.version, pkgData?.version, srcTsVersion];
  let unifiedVer = '1.6.0';
  for (const c of candidates) {
    if (c && c !== 'static' && compareSemverStr(c, unifiedVer) > 0) {
      unifiedVer = String(c).replace(/^[vV]/, '');
    }
  }

  const nowStr = vData.buildTime || formatBuildTime();
  vData.name = vData.name || 'AI 图片编辑器 (TiamoImageEditor)';
  vData.appId = vData.appId || 'image';
  vData.version = unifiedVer;
  vData.buildTime = nowStr;
  vData.frontend = { version: unifiedVer, buildTime: nowStr };
  vData.backend = {
    version: vData.backend?.version === 'static' ? 'static' : unifiedVer,
    buildTime: nowStr
  };

  fs.writeFileSync(rootVersionPath, JSON.stringify(vData, null, 2) + '\n', 'utf8');

  if (pkgData && pkgData.version !== unifiedVer) {
    pkgData.version = unifiedVer;
    fs.writeFileSync(pkgPath, JSON.stringify(pkgData, null, 2) + '\n', 'utf8');
  }

  let vTag = Date.now();
  try {
    vTag = Math.floor(fs.statSync(rootVersionPath).mtimeMs);
  } catch (_) {}

  return { version: unifiedVer, buildTime: nowStr, vTag };
}

function singleVersionPlugin(): Plugin {
  const rootVersionPath = path.resolve(__dirname, 'version.json');
  return {
    name: 'vite-plugin-single-version',
    buildStart() {
      syncAndTouchVersionFiles();
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/version.json')) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          return res.end(fs.readFileSync(rootVersionPath, 'utf8'));
        }
        next();
      });
    },
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const { version, buildTime, vTag } = syncAndTouchVersionFiles();
      const bannerLine = `/*! TiamoImageEditor v${version} | Build: ${buildTime} | TiamoProject */`;

      if (fs.existsSync(distDir) && fs.existsSync(rootVersionPath)) {
        const distVPath = path.join(distDir, 'version.json');
        fs.copyFileSync(rootVersionPath, distVPath);
        try {
          const vStat = fs.statSync(rootVersionPath);
          fs.utimesSync(distVPath, vStat.atime, vStat.mtime);
        } catch (_) {}
      }

      const umdFile = path.join(distDir, 'tiamo-image-editor.umd.js');
      const esFile = path.join(distDir, 'tiamo-image-editor.es.js');
      const cssFile = path.join(distDir, 'style.css');

      ensureFileHeaderBanner(umdFile, bannerLine);
      ensureFileHeaderBanner(esFile, bannerLine);
      ensureFileHeaderBanner(cssFile, bannerLine);

      console.log(`[TiamoImageEditor SDK] Banner 注入完成: ${bannerLine} (ts: ${vTag})`);
    }
  };
}

function terminalLauncherPlugin(): Plugin {
  return {
    name: 'terminal-launcher',
    configureServer(server) {
      server.middlewares.use('/api/launch-terminal', async (req, res) => {
        if (req.method === 'POST') {
          const cwd = process.cwd();
          
          exec(`open -a Terminal "${cwd}" && osascript -e 'tell application "Terminal" to activate'`, (err) => {
            if (err) {
              console.warn('[Terminal Launcher] Failed to activate Terminal:', err.message);
              exec(`open -a Terminal "${cwd}"`);
            }
          });

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            cwd,
            command: `cd "${cwd}" && npm run publish:sdk`,
            shortCommand: 'npm run publish:sdk',
          }));
          return;
        }
        res.statusCode = 404;
        res.end();
      });

      server.middlewares.use('/api/sdk-info', (req, res) => {
        const cwd = process.cwd();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          cwd,
          command: `cd "${cwd}" && npm run publish:sdk`,
          shortCommand: 'npm run publish:sdk',
        }));
      });
    },
  };
}

function distTimestampPlugin(): Plugin {
  return {
    name: 'dist-timestamp',
    transformIndexHtml(html) {
      try {
        const umdPath = path.resolve(process.cwd(), 'dist/tiamo-image-editor.umd.js');
        if (fs.existsSync(umdPath)) {
          const stat = fs.statSync(umdPath);
          const timestamp = Math.floor(stat.mtimeMs || stat.ctimeMs);
          return html.replace(
            /(['"]\.\/dist\/tiamo-image-editor\.umd\.js)(\?t=\d+)?(['"])/g,
            `$1?t=${timestamp}$3`
          );
        }
      } catch (e) {
        console.warn('[distTimestampPlugin] Failed to read mtime:', e);
      }
      return html;
    },
  };
}

export default defineConfig(({ command }) => {
  let currentVer = '1.6.0';
  let buildTime = formatBuildTime();
  try {
    const vRaw = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'version.json'), 'utf8'));
    currentVer = vRaw.version || currentVer;
    buildTime = vRaw.buildTime || buildTime;
  } catch (_) {}

  const banner = `/*! TiamoImageEditor v${currentVer} | Build: ${buildTime} | TiamoProject */\n`;

  return {
    plugins: [react(), singleVersionPlugin(), terminalLauncherPlugin(), distTimestampPlugin()],
    define: {
      ...(command === 'build' ? { 'process.env.NODE_ENV': JSON.stringify('production') } : {}),
      '__PROJECT_CWD__': JSON.stringify(process.cwd()),
      __SDK_VERSION__: JSON.stringify(`v${currentVer}`),
      __SDK_BUILD_TIME__: JSON.stringify(buildTime),
      __TIAMO_SDK_VERSION__: JSON.stringify(currentVer),
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      watch: {
        usePolling: true,
      },
    },
    build: {
      lib: {
        entry: path.resolve(__dirname, 'src/index.ts'),
        name: 'TiamoImageEditor',
        fileName: (format) => `tiamo-image-editor.${format}.js`,
        formats: ['es', 'umd'],
      },
      rollupOptions: {
        external: [],
        output: {
          banner: banner,
          exports: 'named',
          globals: {},
        },
      },
      cssCodeSplit: false,
      sourcemap: true,
    },
  };
});
