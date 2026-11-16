# Production deployment

`production` is the only deployment branch. A merge or push to that protected branch builds an immutable image tagged with the commit SHA, scans it, deploys it with Helm, and verifies `https://longevity.mfu.ac.th`.

Required protected GitLab CI/CD variables:

- `HARBOR_USERNAME`, `HARBOR_PASSWORD`
- `KUBE_CONFIG_PROD` as a file variable scoped to `production`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- optional: `VITE_VAPID_PUBLIC_KEY`, `VITE_API_URL`

The Vite values are compiled into the browser bundle. Update them in GitLab and run a new `production` pipeline; do not place them in Kubernetes runtime secrets. The helper below can create or update a variable without committing its value:

```sh
GITLAB_TOKEN=... CI_PROJECT_ID=... scripts/ci/upsert-gitlab-variable.sh VITE_SUPABASE_URL 'https://example.supabase.co'
```

Kubernetes mapping:

- namespace: `mfu-apps-prod`
- release/service/deployment: `longevity`
- ingress: `longevity.mfu.ac.th`
- image pull secret: `harbor-registry`

Rollback is an explicit manual CI job and runs `helm rollback` for the production release.
