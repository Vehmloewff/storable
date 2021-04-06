// deno-lint-ignore-file no-explicit-any

export type MaybeStorable<T> = Storable<T> | T

export interface Storable<T> {
	get(): T
	set(v: T): void
	subscribe(listener: Subscriber<T>): () => void
}

export interface ReadOnlyStorable<T> {
	get(): T
	subscribe(listener: Subscriber<T>): () => void
}

export type Subscriber<T> = (newVal: T, initialCall: boolean) => void

export function storable<T>(value: T): Storable<T> {
	const subscribers: Subscriber<T>[] = []

	function get(): T {
		return value
	}

	function set(newVal: T) {
		if (value === newVal) return

		value = newVal

		subscribers.forEach(listener => listener(value, false))
	}

	function subscribe(listener: Subscriber<T>) {
		listener(value, true)

		subscribers.push(listener)

		return () => {
			const index = subscribers.indexOf(listener)
			if (index === -1) return // already unsubscribed

			subscribers.splice(index, 1)
		}
	}

	return {
		get,
		set,
		subscribe,
	}
}

export function isStorable<T>(value: MaybeStorable<T>): typeof value extends Storable<T> ? true : false
export function isStorable(value: MaybeStorable<any>): boolean {
	if (!value) return false
	if ((value as any).subscribe) return true
	return false
}

export function ensureStorable<T>(maybeStateful: MaybeStorable<T>): Storable<T> {
	if (isStorable(maybeStateful)) return maybeStateful as Storable<T>
	else return storable(maybeStateful) as Storable<T>
}

export function derive<OS, NS>(previousState: MaybeStorable<OS>, mapper: (oldValue: OS) => NS): Storable<NS> {
	return deriveMany([previousState], ([previousStateValue]) => mapper(previousStateValue))
}

// type _StorableValues<T> = T extends Storable<infer U> ? U : { [K in keyof T]: T[K] extends Storable<infer U> ? U : never }

export function deriveMany<T>(previousStates: MaybeStorable<any>[], mapper: (oldValue: any[]) => T): Storable<T> {
	const newValue = () => mapper(previousStates.map(sureGet) as any)

	const newState: Storable<T> = storable(newValue())

	groupSubscribe(index => {
		if (index !== null) newState.set(newValue())
	}, ...previousStates)

	return newState
}

/**
 *
 * @param fn Calls this function every time the values of `maybeStorables` are updated.
 * The first param passed into this function is the index of the storable that changed
 * in `maybeStorables`.  `changed` will be `null` if it is the initial call.
 *
 * @param maybeStorables The storables to watch.
 */
export function groupSubscribe(fn: (changed: number | null) => void, ...maybeStorables: MaybeStorable<any>[]) {
	const unsubscribes: (() => void)[] = []

	maybeStorables.forEach((maybeStateful, index) => {
		if (!isStorable(maybeStateful)) return

		const state = maybeStateful as Storable<any>
		unsubscribes.push(
			state.subscribe((_, initial) => {
				if (initial) return
				fn(index)
			})
		)
	})

	fn(null)

	return () => {
		unsubscribes.forEach(fn => fn())
	}
}

export interface TwoWayBindingOptions<O1, O2> {
	/** O1 has just emitted a new value.  What are we to set O2 to? */
	map1to2(o1Value: O1): O2
	/** O2 has just emitted a new value.  What are we to set O1 to? */
	map2to1(o2Value: O2): O1
	/** O2 has just emitted a new value, but if this function returns `true`, the emit will be ignored */
	ignoreO2Value?(o2Value: O2): boolean
	/** O1 has just emitted a new value, but if this function returns `true`, the emit will be ignored */
	ignoreO1Value?(o1Value: O1): boolean
	/** On the initial subscription, the first storable will generally set the second, but if this is `true`, the second one will set the first. */
	reverseInitialSetFlow?: boolean
}

export function twoWayBinding<O1, O2>(o1: Storable<O1>, o2: Storable<O2>, options: TwoWayBindingOptions<O1, O2>) {
	if (!options.reverseInitialSetFlow) o2.set(options.map1to2(o1.get()))
	else o1.set(options.map2to1(o2.get()))

	let internalChange = false

	o1.subscribe((val, initial) => {
		if (initial) return
		if (internalChange) return (internalChange = false)
		if (options.ignoreO1Value && options.ignoreO1Value(val)) return

		internalChange = true
		o2.set(options.map1to2(val))
	})

	o2.subscribe((val, initial) => {
		if (initial) return
		if (internalChange) return (internalChange = false)
		if (options.ignoreO2Value && options.ignoreO2Value(val)) return

		internalChange = true
		o1.set(options.map2to1(val))
	})
}

export function sureGet<T>(value: Storable<T> | T): T {
	if (isStorable(value)) return (value as Storable<T>).get()
	return value as T
}

export function readableOnly<T>(stateful: ReadOnlyStorable<T> | Storable<T>): ReadOnlyStorable<T> {
	return {
		get: stateful.get,
		subscribe: stateful.subscribe,
	}
}
