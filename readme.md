# Storable

Inspired by [Svelte stores](https://svelte.dev/docs#svelte_store).

```ts
import { storable } from 'https://deno.land/x/storable/mod.ts'

const username = storable('Vehmloewff')

const unsubscribe = username.subscribe(username => console.log(`Username: ${username}`))

// -> Username: Vehmloewff

username.set('JohnDoe')

// -> Username: JohnDoe

unsubscribe()
```
