import { NextResponse, type NextRequest } from "next/server";

// The vertical's storefront hook for the shared proxy (as in Openfront Restaurant). The airline storefront needs
// no region, cart-cookie or redirect handling, so every request passes through, as the old proxy did.
export async function handleStorefrontRoutes(...route: [request: NextRequest, user: unknown]) {
  void route;
  return NextResponse.next();
}
