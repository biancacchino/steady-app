import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// No baseURL: the web app and the API share one origin, so requests go to /api/auth on this site.
export const authClient = createAuthClient({
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
