import { NextRequest } from "next/server";
import {
  toolboxGet,
  toolboxPost,
} from "@/app/api/toolbox/_lib/toolbox-proxy";

/** Always the nested tree. */
export async function GET(request: NextRequest) {
  return toolboxGet(request, "/ticket-levels");
}

/** Create a level. */
export async function POST(request: NextRequest) {
  return toolboxPost(request, "/ticket-levels");
}
