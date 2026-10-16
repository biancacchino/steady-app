import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// No baseURL: the web app and the API share one origin, so requests go to /api/auth on this site.
export const authClient = createAuthClient({
  // The header and footer read the session on every page. Refetching it whenever the window
  // regains focus re-rendered the header mid-click and hung about 3% of Firefox test clicks
  // (0 in 100 with it off). Sign-out in another tab still reaches this one: better-auth
  // broadcasts it, and every protected route checks the session on navigation.
  sessionOptions: { refetchOnWindowFocus: false },
  plugins: [
    inferAdditionalFields({
      user: {
        ageConfirmedAt: { type: "date", required: true },
        careTeamLink: { type: "string", required: false, input: false },
      },
    }),
  ],
});

export async function getSession() {
  const { data } = await authClient.getSession();
  return data;
}
