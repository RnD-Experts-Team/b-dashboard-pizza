import { NextRequest } from "next/server";
import {
  toolboxGet,
  toolboxPost,
} from "@/app/api/toolbox/_lib/toolbox-proxy";

/** Filters user_ids[], section_ids[], level_ids[], per_page. */
export async function GET(request: NextRequest) {
  return toolboxGet(request, "/ticket-assignments");
}

/** user_id + exactly one target, store_scoped? */
export async function POST(request: NextRequest) {
  return toolboxPost(request, "/ticket-assignments");
}
