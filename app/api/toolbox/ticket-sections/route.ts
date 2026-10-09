import { NextRequest } from "next/server";
import {
  toolboxGet,
  toolboxPost,
} from "@/app/api/toolbox/_lib/toolbox-proxy";

/** Catalogue; ?include_inactive=1 for the admin view. */
export async function GET(request: NextRequest) {
  return toolboxGet(request, "/ticket-sections");
}

/** Create — key, name, description?, display_order? */
export async function POST(request: NextRequest) {
  return toolboxPost(request, "/ticket-sections");
}
