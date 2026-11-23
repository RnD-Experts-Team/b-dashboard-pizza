import { NextRequest } from "next/server";
import {
  invalidParam,
  isPositiveIntParam,
  proxyNotifications,
} from "../_lib/proxy";
import { validateMediaFields } from "../_lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/announcements/:id
 * Proxy → GET {NOTIFICATIONS_BASE_URL}/announcements/:id
 */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isPositiveIntParam(id)) return invalidParam("announcement id");
  return proxyNotifications(request, `/announcements/${id}`, { method: "GET" });
}

/**
 * PUT /api/announcements/:id
 * Proxy → PUT {NOTIFICATIONS_BASE_URL}/announcements/:id
 * Partial update: the client sends only the keys that changed.
 */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isPositiveIntParam(id)) return invalidParam("announcement id");
  return proxyNotifications(request, `/announcements/${id}`, {
    method: "PUT",
    body: "json",
    validateJson: validateMediaFields,
  });
}

/**
 * DELETE /api/announcements/:id
 * Proxy → DELETE {NOTIFICATIONS_BASE_URL}/announcements/:id
 * Also deletes the announcement's own uploaded media (never a picked GIF).
 */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isPositiveIntParam(id)) return invalidParam("announcement id");
  return proxyNotifications(request, `/announcements/${id}`, { method: "DELETE" });
}
