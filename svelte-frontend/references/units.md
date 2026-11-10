# Units: worked shapes

## Contents

- `cn`
- A component
- A Zag.js wrapper
- `Icon`
- An attachment
- Shared state in a `.svelte.ts` module
- A story file with play tests

Names and classes are illustrative; token roles come from `design-tokens`.
In an app on a design, `cn`, `Icon` and every generic unit come from the
design's packages (`design-system`): these shapes are for the units the
project builds itself, and for the design-system repo.

## `cn`

```ts
// src/lib/utils/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class inputs and lets later Tailwind utilities win over earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

## A component

```svelte
<!-- src/lib/components/Button/Button.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils/cn';

  interface Props extends HTMLButtonAttributes {
    /** Visual weight; `danger` only for destructive actions. */
    variant?: 'primary' | 'secondary' | 'danger';
    /** The label, optionally with an `Icon` before it. */
    children: Snippet;
  }

  let { variant = 'secondary', type = 'button', class: className, children, ...rest }: Props =
    $props();

  const variants = {
    primary: 'bg-brand text-fg-on-solid hover:bg-brand-emphasis',
    secondary: 'border border-border bg-surface-raised text-fg hover:bg-surface-sunken',
    danger: 'bg-danger text-danger-fg hover:bg-danger/90',
  } satisfies Record<NonNullable<Props['variant']>, string>;
</script>

<button
  {...rest}
  {type}
  class={cn(
    'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none motion-safe:transition-colors',
    variants[variant],
    className,
  )}
>
  {@render children()}
</button>
```

- `variant` and `children` are declared here, so they carry doc comments;
  `onclick`, `disabled` and the rest come from `HTMLButtonAttributes`.
- `type` defaults to `button` so a button inside a form does not submit it
  by accident.
- The variant map is a typed lookup kept in the unit (`design-tokens`).

## A Zag.js wrapper

The only layer that imports `@zag-js/*`. The machine owns the keyboard,
focus and ARIA; the wrapper fixes the tokens and structure, and callers
never see the machine's parts.

```svelte
<!-- src/lib/components/Dialog/Dialog.svelte -->
<script lang="ts">
  import * as dialog from '@zag-js/dialog';
  import { normalizeProps, portal, useMachine } from '@zag-js/svelte';
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  interface Props {
    /** Whether the dialog is open; the caller binds it. */
    open?: boolean;
    /** Heading text, also the dialog's accessible name. */
    title: string;
    /** Body content. */
    children: Snippet;
    /** Footer actions, least destructive first. */
    actions?: Snippet;
    /** Extra classes for the panel. */
    class?: string;
  }

  let { open = $bindable(false), title, children, actions, class: className }: Props = $props();

  const id = $props.id();
  // A getter, so prop changes reach the machine; the change callback writes `open` back.
  const service = useMachine(dialog.machine, () => ({
    id,
    open,
    onOpenChange(details: dialog.OpenChangeDetails) {
      open = details.open;
    },
  }));
  const api = $derived(dialog.connect(service, normalizeProps));
  // Unmounting while open must release the machine's focus trap and dismiss layer.
  $effect(() => () => service.send({ type: 'CLOSE', restoreFocus: false }));
</script>

{#if api.open}
  <div use:portal {...api.getBackdropProps()} class="fixed inset-0 bg-surface-overlay"></div>
  <div use:portal {...api.getPositionerProps()} class="fixed inset-0 grid place-items-center p-4">
    <div
      {...api.getContentProps()}
      class={cn('w-full max-w-md rounded-md bg-surface-raised p-6 text-fg shadow-lg', className)}
    >
      <h2 {...api.getTitleProps()} class="text-lg font-semibold">{title}</h2>
      {@render children()}
      {#if actions}
        <div class="mt-6 flex justify-end gap-2">{@render actions()}</div>
      {/if}
    </div>
  </div>
{/if}
```

`open` is one of the two places `$bindable` is allowed (form-like values
and an overlay's open state). A composition that opens the dialog binds it
once; it does not re-export it as its own bindable. State styling reads
the machine's `data-state`, `data-disabled` and `data-focus-visible`
attributes (`data-[state=open]:`), never a copy of the state in the wrapper.

## `Icon`

```svelte
<!-- src/lib/components/Icon/Icon.svelte -->
<script lang="ts">
  import type { Component } from 'svelte';
  import type { IconProps } from '@lucide/svelte';
  import { cn } from '$lib/utils/cn';

  interface Props {
    /** The icon, imported from `@lucide/svelte/icons/<name>`. */
    icon: Component<IconProps>;
    /** sm 16 px beside small text, md 20 px by default, lg 24 px on its own. */
    size?: 'sm' | 'md' | 'lg';
    /** Accessible name; omit when the icon only decorates visible text. */
    label?: string;
    /** Extra classes, usually a text colour role. */
    class?: string;
  }

  let { icon: Glyph, size = 'md', label, class: className }: Props = $props();
  const pixels = { sm: 16, md: 20, lg: 24 } as const;
</script>

<Glyph
  size={pixels[size]}
  class={cn('shrink-0', className)}
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
/>
```

Use: `import Trash from '@lucide/svelte/icons/trash';` then
`<Icon icon={Trash} size="sm" />`. An icon-only button puts the name on the
button, not the icon.

## An attachment

DOM behaviour tied to one element is an attachment: it runs when the
element mounts, re-runs when the state it reads changes, and its returned
function cleans up.

```svelte
<script lang="ts">
  import type { Attachment } from 'svelte/attachments';

  /** Grows the textarea to fit its content. */
  const autosize: Attachment<HTMLTextAreaElement> = (node) => {
    const fit = () => {
      node.style.height = 'auto';
      node.style.height = `${node.scrollHeight}px`;
    };
    fit();
    node.addEventListener('input', fit);
    return () => node.removeEventListener('input', fit);
  };
</script>

<textarea {@attach autosize}></textarea>
```

## Shared state in a `.svelte.ts` module

Only for app-lifetime state. Export an instance and change its fields; a
module cannot export a `$state` it reassigns.

```ts
// src/lib/features/toasts/toasts.svelte.ts
export interface Toast {
  id: string;
  message: string;
  undo?: () => void;
}

class Toasts {
  items = $state<Toast[]>([]);
  latest = $derived(this.items.at(-1));

  push(toast: Omit<Toast, 'id'>): void {
    this.items.push({ ...toast, id: crypto.randomUUID() });
  }

  dismiss(id: string): void {
    this.items = this.items.filter((toast) => toast.id !== id);
  }
}

export const toasts = new Toasts();
```

A test that pushes toasts resets them in `beforeEach`; module state
outlives a single test.

## A story file with play tests

One file per unit. The visual stories come first, in the order
`ui-component-contract` and `storybook-layout` set, `Default` first; the
play-test stories follow them. `asChild` renders the children as the story
instead of passing them to the component.

```svelte
<!-- src/lib/compositions/FilterBar/FilterBar.stories.svelte -->
<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn } from 'storybook/test';
  import FilterBar from './FilterBar.svelte';

  const { Story } = defineMeta({
    title: 'Compositions/FilterBar',
    component: FilterBar,
    args: { onChange: fn() },
  });

  const two = [
    { key: 'state', label: 'State: running' },
    { key: 'region', label: 'Region: eu-west' },
  ];
</script>

<Story name="Default" args={{ filters: [{ key: 'state', label: 'State: running' }] }} />
<Story name="Empty" args={{ filters: [] }} />
<Story
  name="WithLongContent"
  args={{ filters: [{ key: 'owner', label: 'Owner: Maria-Fernanda Albuquerque de Souza' }] }}
/>

<Story
  name="ClearAllByKeyboard"
  args={{ filters: two }}
  play={async ({ args, canvas, userEvent }) => {
    canvas.getByRole('button', { name: 'Clear all' }).focus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onChange).toHaveBeenCalledWith([]);
  }}
/>
```

A story's `play` receives `canvas` and `userEvent` from the context; import
`expect` and `fn` from `storybook/test`, never from vitest, so the same
assertion runs in the Storybook UI and in `make web-test`.
