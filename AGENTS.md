# FlowChart Repository Rules

These rules apply to every human or AI agent modifying this repository.

## Dependency and lockfile rule

- Any change to `package.json` dependencies, devDependencies, optionalDependencies, peerDependencies, package version, npm configuration, or Node/npm engine constraints MUST update `package-lock.json` in the same branch and pull request.
- Never edit dependency versions in `package.json` without regenerating the lockfile.
- Never manually invent or partially patch `package-lock.json` entries.
- Regenerate the lockfile with the repository's supported environment:

  ```bash
  nvm use 22
  npm install
  ```

- Before considering the task complete, verify that a clean install succeeds:

  ```bash
  npm ci
  npm run type-check
  npm run build
  ```

- `npm install` succeeding is not sufficient. `npm ci` is the required lockfile consistency check because Cloudflare Builds installs with `npm clean-install` / `npm ci`.
- If `package.json` changes but `package-lock.json` does not, stop and fix the lockfile before opening, updating, or merging a pull request.
- When updating dependencies through GitHub automation, remove any temporary workflow after it has generated and committed the final lockfile.

## Deployment compatibility

- Production uses Node.js 22 and npm 10. Validate dependency changes against Node 22.
- Cloudflare deployment must remain compatible with `npm ci`, Next.js, OpenNext, Wrangler, D1, Assets, and the Workers AI binding.

## Completion checklist

Before reporting that a dependency-related change is ready:

1. `package.json` and `package-lock.json` are synchronized.
2. `npm ci` succeeds from a clean checkout.
3. TypeScript checking succeeds.
4. Next.js production build succeeds.
5. OpenNext Cloudflare Worker bundle succeeds.
