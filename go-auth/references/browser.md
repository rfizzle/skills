# The browser side

SvelteKit with `adapter-static` and a Connect-ES client. The client module,
its 401 hook (`onUnauthenticated`), `signInHref` and `safeReturn` in
`lib/api/session.ts`, and the root layout that creates the transport are
`frontend-api-client`'s; folders and the import rule are
`svelte-frontend`'s. This file is what auth adds on top: the server
contract the client relies on, the guard, re-authentication in place,
sign-out, the reset page and the stories.

## Server contract

- `AuthService.GetSession` is public and returns an empty `user` for an
  anonymous caller, so public pages (`/sign-in`, `/reset`) load without
  tripping the 401 hook.
- `SignIn` answers `Unauthenticated` with the one generic message for a
  wrong password or unknown account, `ResourceExhausted` with
  `Retry-After` when limited or locked, and a `totp_required` result with a
  challenge id when the second step is due.
- Every other procedure answers `Unauthenticated` when there is no session.

## The guard

```ts
// web/src/routes/(app)/+layout.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent, url }) => {
	const { me } = await parent(); // the root load, depends('api:session')
	// url, not location: during navigation location is still the old page
	if (!me) redirect(307, `/sign-in?return=${encodeURIComponent(url.pathname + url.search)}`);
	return { me };
};
```

Every protected screen lives under the `(app)` group; `/sign-in`, `/reset`
and other public screens live outside it. The guard is a convenience for
the user: the server refuses the data anyway. After sign-in the screen
follows `safeReturn(page.url.searchParams.get('return'))`.

## Re-authenticating in place

A session that expires while someone is typing must not cost them the
draft. The root layout's `onUnauthenticated` hook decides:

```ts
// web/src/routes/+layout.svelte, the hook passed to createTransport
onUnauthenticated: () => {
	void invalidate('api:session'); // the client forgets the user at once
	if (location.pathname === '/sign-in') return;
	if (drafts.any) reauth.open = true; // sign in over the page; the draft stays mounted
	else void goto(signInHref(location), { replaceState: true });
},
```

```ts
// web/src/lib/utils/drafts.svelte.ts
// A form registers while it has unsaved input; nothing else reads it.
class Drafts {
	#dirty = new Set<symbol>();
	set(id: symbol, dirty: boolean): void {
		if (dirty) this.#dirty.add(id);
		else this.#dirty.delete(id);
	}
	get any(): boolean {
		return this.#dirty.size > 0;
	}
}
export const drafts = new Drafts();

// web/src/lib/features/ReauthDialog/reauth.svelte.ts
class Reauth {
	open = $state(false);
}
export const reauth = new Reauth();
```

`ReauthDialog` (a feature, mounted once in the root layout) shows the same
form as the sign-in screen, including the TOTP step. On success it closes,
calls `invalidate('api:session')`, and the person presses Save again; the
failed call is not replayed behind their back. On cancel it navigates to
`signInHref(location)` after the browser's own unsaved-changes prompt. A
form calls `drafts.set(id, dirty)` from an `$effect` and clears it on
submit and on destroy.

A live stream that ends with `Unauthenticated` goes through the same hook;
its view reconnects when `api:session` changes.

## Sign-out

Features may not import `$app/*`, so the user menu takes an `onSignOut`
callback and the `(app)` layout supplies it:

```ts
async function signOut(): Promise<void> {
	try {
		await api.auth.signOut({}); // the server deletes the row and expires the cookie
	} finally {
		await goto('/sign-in', { replaceState: true, invalidateAll: true });
	}
}
```

The `finally` also clears any client cache of API data. The cookie is
`HttpOnly`, so the client cannot remove it and does not try; the server's
expired `Set-Cookie` does.

## The reset page

The token arrives in the fragment (`/reset#token=...`), which never reaches
the server or its logs:

```ts
const token = new URLSearchParams(location.hash.slice(1)).get('token');
history.replaceState(history.state, '', location.pathname); // out of the address bar and history
```

## Stories

The sign-in screen is `Screens/Sign in` (`storybook-layout`), rendered from
`routes/sign-in/SignInScreen.svelte`, with stories `Default`,
`WrongCredentials`, `Locked` (the retry time from `Retry-After`),
`TotpStep`, `RecoveryCode` and `Submitting`, and a play test that `return`
survives the TOTP step. `Features/ReauthDialog` has its own stories and a
Flows file proving a draft in the page beneath survives sign-in.
