interface PrivyAuthenticateInput {
  accessToken: string;
  identityToken: string;
}

export async function authenticatePrivy(input: PrivyAuthenticateInput) {
  const res = await fetch("/api/auth/privy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken: input.accessToken,
      identityToken: input.identityToken,
    }),
  });
  const data = await res.json();
  const token = data.accessToken as string;
  return { success: true, token };
}
