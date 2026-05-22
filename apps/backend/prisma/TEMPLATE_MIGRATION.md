# Template model migration

This change added interactive template support by extending the `MessageTemplate` model with the following fields:

- `type` (enum: `TEXT|MEDIA|INTERACTIVE`)
- `status` (enum: `DRAFT|PUBLISHED|ARCHIVED`)
- `payload` (Json) — structured template payload for buttons/layouts
- `variables` (Json) — optional cached list of variables

If you're running this project locally, run the following to apply the migration and regenerate the Prisma client:

```bash
cd apps/backend
npx prisma migrate dev --name add-message-template-payload
npx prisma generate
```

If you have a separate `schema.prisma` under `apps/backend/src/prisma`, ensure it's updated too (this repo contains both locations).

After migration, the new endpoints are available:

- `GET /api/templates` — list templates
- `POST /api/templates` — create (accepts `type` and `payload`)
- `PUT /api/templates/:id` — update
- `DELETE /api/templates/:id` — delete
- `POST /api/templates/:id/render` — render preview with `{ variables: { name: '...' } }`

Permissions are enforced via existing `checkPermission` middleware.
