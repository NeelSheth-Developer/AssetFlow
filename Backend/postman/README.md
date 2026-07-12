# AssetFlow — Postman Collection

Complete Postman collection for the AssetFlow backend: **110 endpoints** across 17 modules, every request with a body, description, and required-role note.

## Files

| File | What it is |
|------|-----------|
| `AssetFlow.postman_collection.json` | The collection — import this into Postman. |

The collection is fully self-contained: `baseUrl` and all the id variables live inside it as collection variables, so no separate environment file is needed.

## Import

1. Open Postman → **Import** → drop in `AssetFlow.postman_collection.json`.
2. Confirm the `baseUrl` variable = `http://localhost:3000` (the backend's default port). Edit it under the collection's **Variables** tab if your setup differs.

## Authentication (important)

Auth is **cookie-based**, not bearer tokens. Login/Signup set HttpOnly `at` (access, 15 min) and `rt` (refresh, 7 days) cookies, and Postman's **cookie jar stores them automatically per host**.

So the flow is simply:

1. Run **Auth → Login** (or **Signup**) once. Cookies are captured automatically.
2. Every other request is now authenticated — nothing to copy or paste.
3. When the access token expires (15 min), run **Auth → Refresh session** to get a new one.

> If you tunnel through ngrok/Cloudflare, set `baseUrl` to the tunnel URL. Cookies are scoped per host, so log in again against that host.

## Path variables

Detail/update/action requests use `:id`-style paths bound to collection variables — `assetId`, `userId`, `departmentId`, `categoryId`, `allocationId`, `transferId`, `bookingId`, `resourceId`, `maintenanceId`, `cycleId`, `itemId`, `notificationId`, `fieldId`. Grab an id from any **List** response and paste it into the matching variable.

## Response envelope

Every response uses:

```json
{ "success": true, "message": "…", "data": { } }
```

Errors use the same shape with `"success": false`.

## Roles

`ADMIN` · `ASSET_MANAGER` · `DEPT_HEAD` · `EMPLOYEE`. Each request's required access is listed under **Access** in its description. Many list/detail endpoints are **scoped** — an Employee sees only their own records, a Dept Head sees their department, Admin/Asset Manager see everything.

## Modules

| Folder | Endpoints |
|--------|----------:|
| Auth | 8 |
| Users | 7 |
| Departments | 7 |
| Categories | 8 |
| Assets | 12 |
| Locations | 1 |
| Allocations | 8 |
| Transfers | 5 |
| Resources (bookable) | 3 |
| Bookings | 8 |
| Maintenance | 11 |
| Audit Cycles | 11 |
| Dashboard | 6 |
| Reports | 6 |
| Notifications | 6 |
| Activity Logs | 2 |
| Health | 1 |
| **Total** | **110** |

## Regenerating

The collection is generated from the route source in `src/routes/`. If the API changes, update the generator and re-run it rather than hand-editing the JSON.
