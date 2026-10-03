import { NextRequest } from "next/server";
import { forward, invalidNumericId } from "../../_lib/route-utils";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ recipe: string }> };

/** PUT /api/dough-sauce/recipes/{recipe} → [data] closes the row and opens a new one */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { recipe } = await params;
  const invalid = invalidNumericId(recipe, "Recipe id");
  if (invalid) return invalid;
  return forward("data", request, `/dough-sauce/recipes/${recipe}`, "PUT");
}

/** DELETE /api/dough-sauce/recipes/{recipe} → [data] soft close (effective_to = yesterday) */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { recipe } = await params;
  const invalid = invalidNumericId(recipe, "Recipe id");
  if (invalid) return invalid;
  return forward("data", request, `/dough-sauce/recipes/${recipe}`, "DELETE");
}
