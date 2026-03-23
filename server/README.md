# server/

This subtree is local build and deployment support for the mobile repo. It is not backend contract truth and it is not the Vaiform backend repo.

## What It Owns

- `server/index.ts`: local Express entrypoint that serves the Expo landing page, static build output, and platform manifests for Replit/cloud deployment.
- `server/routes.ts`: local HTTP server bootstrap only. It does not define the Vaiform backend API surface.
- `server/storage.ts`: leftover local storage interface/template code from the Replit app scaffold; not part of the mobile-to-backend contract.
- `server/templates/`: landing-page assets for the local deployment surface.

## Related Local Entry Points

- `.replit`: wires the local deploy workflow to `expo:static:build`, `server:build`, and `server:prod`.
- `package.json` scripts:
  - `server:dev`
  - `server:build`
  - `server:prod`
  - `expo:static:build`
- `scripts/build.js`: produces the local `static-build` output consumed by the local server/deployment flow.

## What It Does Not Own

- Backend/mobile contract truth
- Mobile transport ownership
- Vaiform backend route/controller/service behavior

For current mobile caller truth, use `docs/MOBILE_USED_SURFACES.md`.

For mobile docs front-door and canonical backend references, use `README.md` and `docs/DOCS_INDEX.md`.
