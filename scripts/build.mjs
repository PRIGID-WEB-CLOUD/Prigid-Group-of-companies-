import { execSync } from "node:child_process";
import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.resolve(rootDir, "dist");

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function run() {
  console.log("==> [1/4] Building @workspace/api-server...");
  execSync("npm run build --workspace=@workspace/api-server", {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });

  console.log("==> [2/4] Building @workspace/luxe-boutique (Storefront)...");
  execSync("npm run build --workspace=@workspace/luxe-boutique", {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production", PORT: "3000", BASE_PATH: "/" },
  });

  console.log("==> [3/4] Building @workspace/luxe-boutique-admin (Admin Portal)...");
  execSync("npm run build --workspace=@workspace/luxe-boutique-admin", {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production", PORT: "3000", BASE_PATH: "/seller/" },
  });

  console.log("==> [4/4] Assembling unified dist/ directory...");
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  const storeDist = path.resolve(rootDir, "artifacts/luxe-boutique/dist/public");
  if (await exists(storeDist)) {
    console.log("  -> Copying Storefront files to dist/...");
    await cp(storeDist, distDir, { recursive: true });
  }

  const adminDist = path.resolve(rootDir, "artifacts/luxe-boutique-admin/dist/public");
  if (await exists(adminDist)) {
    console.log("  -> Copying Admin Portal files to dist/seller/...");
    const distAdmin = path.resolve(distDir, "seller");
    await mkdir(distAdmin, { recursive: true });
    await cp(adminDist, distAdmin, { recursive: true });
  }

  const serverDist = path.resolve(rootDir, "artifacts/api-server/dist");
  if (await exists(serverDist)) {
    console.log("  -> Copying API Server bundle to dist/server/...");
    const distServer = path.resolve(distDir, "server");
    await mkdir(distServer, { recursive: true });
    await cp(serverDist, distServer, { recursive: true });
  }

  const landingSrc = path.resolve(rootDir, "artifacts/prigid-landing");
  if (await exists(landingSrc)) {
    console.log("  -> Copying SaaS Landing Page to dist/landing/...");
    const distLanding = path.resolve(distDir, "landing");
    await mkdir(distLanding, { recursive: true });
    await cp(landingSrc, distLanding, { recursive: true });
  }

  const mobileStaticBuild = path.resolve(rootDir, "artifacts/luxe-boutique-mobile/static-build");
  if (await exists(mobileStaticBuild)) {
    console.log("  -> Copying Mobile App Build to dist/mobile/...");
    const distMobile = path.resolve(distDir, "mobile");
    await mkdir(distMobile, { recursive: true });
    await cp(mobileStaticBuild, distMobile, { recursive: true });

    const mobileAppJson = path.resolve(rootDir, "artifacts/luxe-boutique-mobile/app.json");
    if (await exists(mobileAppJson)) {
      await cp(mobileAppJson, path.resolve(distMobile, "app.json"));
    }

    const mobilePkgJson = path.resolve(rootDir, "artifacts/luxe-boutique-mobile/package.json");
    if (await exists(mobilePkgJson)) {
      await cp(mobilePkgJson, path.resolve(distMobile, "package.json"));
    }
  }

  // Copy .env.example into dist/ and dist/server/
  const envExample = path.resolve(rootDir, ".env.example");
  if (await exists(envExample)) {
    await cp(envExample, path.resolve(distDir, ".env.example"));
    if (await exists(path.resolve(distDir, "server"))) {
      await cp(envExample, path.resolve(distDir, "server/.env.example"));
    }
  }

  // Copy deployment guide and license
  const deployGuide = path.resolve(rootDir, "DEPLOYMENT-GUIDE.md");
  if (await exists(deployGuide)) {
    await cp(deployGuide, path.resolve(distDir, "DEPLOYMENT-GUIDE.md"));
    await cp(deployGuide, path.resolve(distDir, "README.md"));
  }

  const comprehensiveDeployGuide = path.resolve(rootDir, "DEPLOYMENT.md");
  if (await exists(comprehensiveDeployGuide)) {
    await cp(comprehensiveDeployGuide, path.resolve(distDir, "DEPLOYMENT.md"));
  }

  const defaultLicense = path.resolve(rootDir, "LICENSE-EXCLUSIVE-SOURCE-CODE.md");
  if (await exists(defaultLicense)) {
    await cp(defaultLicense, path.resolve(distDir, "LICENSE"));
    await cp(defaultLicense, path.resolve(distDir, "LICENSE.md"));
  }

  console.log("==> Production build successfully completed!");
}

run().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
