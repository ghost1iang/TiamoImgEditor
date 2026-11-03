#!/usr/bin/env node

/**
 * TiamoImageEditor SDK 发布脚本
 * 
 * 执行逻辑：
 * 1. 读取当前版本号 (package.json / src/version.ts)
 * 2. 确保 dist 打包文件存在 (dist/tiamo-image-editor.umd.js)
 * 3. 在 ../TiamoLogin/sdk/TiamoImgEditor 下创建版本号文件夹 (如 v1.5.3)
 * 4. 拷贝 tiamo-image-editor.umd.js 到该版本号文件夹下
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// 1. 读取版本号
let version = '1.0.0';
try {
  const pkgPath = path.resolve(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version) version = pkg.version;
  }
} catch (e) {
  console.warn('⚠️ 读取 package.json 版本号失败，尝试读取 src/version.ts');
}

// 尝试从 src/version.ts 校验
try {
  const verTsPath = path.resolve(projectRoot, 'src/version.ts');
  if (fs.existsSync(verTsPath)) {
    const verContent = fs.readFileSync(verTsPath, 'utf-8');
    const match = verContent.match(/SDK_VERSION\s*=\s*['"]v?([^'"]+)['"]/);
    if (match && match[1]) {
      version = match[1];
    }
  }
} catch (e) {}

const cleanVersion = version.replace(/^[vV]/, '');
const versionFolder = `v${cleanVersion}`;

console.log('====================================================');
console.log(`📦 TiamoImageEditor SDK 发布构建`);
console.log(`📌 当前版本: V${cleanVersion}`);
console.log(`📁 版本文件夹: ${versionFolder}`);
console.log('====================================================');

// 2. 检查 dist 源目录
const distDir = path.resolve(projectRoot, 'dist');
const umdFile = path.resolve(distDir, 'tiamo-image-editor.umd.js');

if (!fs.existsSync(umdFile)) {
  console.error(`❌ 未找到 dist/tiamo-image-editor.umd.js 打包产物，请先执行 npm run build！`);
  process.exit(1);
}

// 3. 目标目录 (../TiamoLogin/sdk/TiamoImgEditor/<版本号>)
const baseTargetDir = path.resolve(projectRoot, '../TiamoLogin/sdk/TiamoImgEditor');
if (!fs.existsSync(baseTargetDir)) {
  fs.mkdirSync(baseTargetDir, { recursive: true });
}

// 清理根目录下历史遗留的旧散落文件 (如旧版 Tiamo_Image_Editor_V*.js 等)
for (const entry of fs.readdirSync(baseTargetDir)) {
  if (entry === '.DS_Store') continue;
  const entryPath = path.join(baseTargetDir, entry);
  const stat = fs.statSync(entryPath);
  if (!stat.isDirectory()) {
    fs.rmSync(entryPath, { force: true });
  }
}

const targetVersionDir = path.resolve(baseTargetDir, versionFolder);
if (!fs.existsSync(targetVersionDir)) {
  console.log(`📁 创建版本目录: ${targetVersionDir}`);
  fs.mkdirSync(targetVersionDir, { recursive: true });
}

// 4. 拷贝单一核心 SDK 文件：tiamo-image-editor.umd.js
const targetFile = path.resolve(targetVersionDir, 'tiamo-image-editor.umd.js');
fs.copyFileSync(umdFile, targetFile);

const sizeKb = (fs.statSync(targetFile).size / 1024).toFixed(1);
console.log(`✅ [已同步] ${versionFolder}/tiamo-image-editor.umd.js (${sizeKb} KB)`);

console.log('----------------------------------------------------');
console.log(`🎉 发布成功！`);
console.log(`👉 目标路径: ${targetFile}`);
console.log('====================================================\n');
