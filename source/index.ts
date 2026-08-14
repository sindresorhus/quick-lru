export type Options<KeyType, ValueType> = {
	/**
	The maximum number of milliseconds an item should remain in the cache.

	@default Infinity

	By default, `maxAge` will be `Infinity`, which means that items will never expire.
	Lazy expiration occurs upon the next write or read call.

	Individual expiration of an item can be specified with the `set(key, value, {maxAge})` method.
	*/
	readonly maxAge?: number;

	/**
	The target maximum number of items before evicting the least recently used items.

	__Note:__ This package uses an [algorithm](https://github.com/sindresorhus/quick-lru#algorithm) which maintains between `maxSize` and `2 × maxSize` items for performance reasons. The cache may temporarily contain up to twice the specified size due to the dual-cache design that avoids expensive delete operations.
	*/
	readonly maxSize: number;

	/**
	Called right before an item is evicted from the cache due to LRU pressure, TTL expiration, or manual eviction via `evict()`.

	Useful for side effects or for items like object URLs that need explicit cleanup (`revokeObjectURL`).

	__Note:__ This callback is not called for manual removals via `delete()` or `clear()`. It fires for automatic evictions and manual evictions via `evict()`.
	*/
	onEviction?: (key: KeyType, value: ValueType) => void;
};

type CacheItem<ValueType> = {
	value: ValueType;
	expiry: number | undefined;
};

/**
Simple ["Least Recently Used" (LRU) cache](https://en.m.wikipedia.org/wiki/Cache_replacement_policies#Least_Recently_Used_.28LRU.29).

The instance is an [`Iterable`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Iteration_protocols) of `[key, value]` pairs so you can use it directly in a [`for…of`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Statements/for...of) loop.

@example
```
import QuickLRU from 'quick-lru';

const lru = new QuickLRU({maxSize: 1000});

lru.set('🦄', '🌈');

lru.has('🦄');
//=> true

lru.get('🦄');
//=> '🌈'
```
*/
// eslint-disable-next-line @typescript-eslint/naming-convention
export default class QuickLRU<KeyType, ValueType> extends Map<KeyType, ValueType> implements Iterable<[KeyType, ValueType]> {
	#size = 0;
	#cache = new Map<KeyType, CacheItem<ValueType>>();
	#oldCache = new Map<KeyType, CacheItem<ValueType>>();
	#maxSize: number;
	readonly #maxAge: number;
	readonly #onEviction?: (key: KeyType, value: ValueType) => void;

	constructor(options: Options<KeyType, ValueType>) {
		super();

		const {maxSize, maxAge, onEviction}: Partial<Options<KeyType, ValueType>> = options ?? {};

		if (!(maxSize && maxSize > 0)) {
			throw new TypeError('`maxSize` must be a number greater than 0');
		}

		if (typeof maxAge === 'number' && maxAge === 0) {
			throw new TypeError('`maxAge` must be a number greater than 0');
		}

		this.#maxSize = maxSize;
		// Note: `||` rather than `??` so a `NaN` `maxAge` falls back to `Infinity`.
		this.#maxAge = maxAge || Number.POSITIVE_INFINITY; // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing
		this.#onEviction = onEviction;
	}

	// For tests.
	get __oldCache() {
		return this.#oldCache;
	}

	#emitEvictions(cache: Iterable<[KeyType, CacheItem<ValueType>]>) {
		if (typeof this.#onEviction !== 'function') {
			return;
		}

		for (const [key, item] of cache) {
			this.#onEviction(key, item.value);
		}
	}

	#deleteIfExpired(key: KeyType, item: CacheItem<ValueType>) {
		if (typeof item.expiry === 'number' && item.expiry <= Date.now()) {
			if (typeof this.#onEviction === 'function') {
				this.#onEviction(key, item.value);
			}

			return this.delete(key);
		}

		return false;
	}

	#getOrDeleteIfExpired(key: KeyType, item: CacheItem<ValueType>): ValueType | undefined {
		const deleted = this.#deleteIfExpired(key, item);
		if (!deleted) {
			return item.value;
		}

		return undefined;
	}

	#getItemValue(key: KeyType, item: CacheItem<ValueType>): ValueType | undefined {
		return item.expiry ? this.#getOrDeleteIfExpired(key, item) : item.value;
	}

	#peek(key: KeyType, cache: Map<KeyType, CacheItem<ValueType>>): ValueType | undefined {
		const item = cache.get(key)!;
		return this.#getItemValue(key, item);
	}

	#set(key: KeyType, value: CacheItem<ValueType>) {
		this.#cache.set(key, value);
		this.#size++;

		if (this.#size >= this.#maxSize) {
			this.#size = 0;
			this.#emitEvictions(this.#oldCache);
			this.#oldCache = this.#cache;
			this.#cache = new Map();
		}
	}

	#moveToRecent(key: KeyType, item: CacheItem<ValueType>) {
		this.#oldCache.delete(key);
		this.#set(key, item);
	}

	* #entriesAscending(): Generator<[KeyType, CacheItem<ValueType>], void, unknown> {
		for (const item of this.#oldCache) {
			const [key, value] = item;
			if (!this.#cache.has(key)) {
				const deleted = this.#deleteIfExpired(key, value);
				if (!deleted) {
					yield item;
				}
			}
		}

		for (const item of this.#cache) {
			const [key, value] = item;
			const deleted = this.#deleteIfExpired(key, value);
			if (!deleted) {
				yield item;
			}
		}
	}

	/**
	Get an item.

	@returns The stored item or `undefined`.
	*/
	get(key: KeyType): ValueType | undefined {
		if (this.#cache.has(key)) {
			const item = this.#cache.get(key)!;
			return this.#getItemValue(key, item);
		}

		if (this.#oldCache.has(key)) {
			const item = this.#oldCache.get(key)!;
			if (!this.#deleteIfExpired(key, item)) {
				this.#moveToRecent(key, item);
				return item.value;
			}
		}

		return undefined;
	}

	/**
	Set an item. Returns the instance.

	Individual expiration of an item can be specified with the `maxAge` option. If not specified, the global `maxAge` value will be used in case it is specified in the constructor; otherwise the item will never expire.

	@returns The cache instance.
	*/
	set(key: KeyType, value: ValueType, {maxAge = this.#maxAge}: {maxAge?: number} = {}): this {
		const expiry = typeof maxAge === 'number' && maxAge !== Number.POSITIVE_INFINITY
			? (Date.now() + maxAge)
			: undefined;

		if (this.#cache.has(key)) {
			this.#cache.set(key, {
				value,
				expiry,
			});
		} else {
			this.#set(key, {value, expiry});
		}

		return this;
	}

	/**
	Check if an item exists.
	*/
	has(key: KeyType): boolean {
		if (this.#cache.has(key)) {
			return !this.#deleteIfExpired(key, this.#cache.get(key)!);
		}

		if (this.#oldCache.has(key)) {
			return !this.#deleteIfExpired(key, this.#oldCache.get(key)!);
		}

		return false;
	}

	/**
	Get an item without marking it as recently used.

	@returns The stored item or `undefined`.
	*/
	peek(key: KeyType): ValueType | undefined {
		if (this.#cache.has(key)) {
			return this.#peek(key, this.#cache);
		}

		if (this.#oldCache.has(key)) {
			return this.#peek(key, this.#oldCache);
		}

		return undefined;
	}

	/**
	Get the remaining time to live (in milliseconds) for the given item, or `undefined` when the item is not in the cache.

	- Does not mark the item as recently used.
	- Does not trigger lazy expiration or remove the entry when it is expired.
	- Returns `Infinity` if the item has no expiration.
	- May return a negative number if the item is already expired but not yet lazily removed.

	@returns Remaining time to live in milliseconds when set, `Infinity` when there is no expiration, or `undefined` when the item does not exist.
	*/
	expiresIn(key: KeyType): number | undefined {
		const item = this.#cache.get(key) ?? this.#oldCache.get(key);
		if (item) {
			return item.expiry ? item.expiry - Date.now() : Number.POSITIVE_INFINITY;
		}

		return undefined;
	}

	/**
	Delete an item.

	@returns `true` if the item is removed or `false` if the item doesn't exist.
	*/
	delete(key: KeyType): boolean {
		const deleted = this.#cache.delete(key);
		if (deleted) {
			this.#size--;
		}

		return this.#oldCache.delete(key) || deleted;
	}

	/**
	Delete all items.
	*/
	clear(): void {
		this.#cache.clear();
		this.#oldCache.clear();
		this.#size = 0;
	}

	/**
	Update the `maxSize` in-place, discarding items as necessary. Insertion order is mostly preserved, though this is not a strong guarantee.

	Useful for on-the-fly tuning of cache sizes in live systems.
	*/
	resize(newSize: number): void {
		if (!(newSize && newSize > 0)) {
			throw new TypeError('`maxSize` must be a number greater than 0');
		}

		const items = [...this.#entriesAscending()];
		const removeCount = items.length - newSize;
		if (removeCount < 0) {
			this.#cache = new Map(items);
			this.#oldCache = new Map();
			this.#size = items.length;
		} else {
			if (removeCount > 0) {
				this.#emitEvictions(items.slice(0, removeCount));
			}

			this.#oldCache = new Map(items.slice(removeCount));
			this.#cache = new Map();
			this.#size = 0;
		}

		this.#maxSize = newSize;
	}

	/**
	Evict the least recently used items from the cache.

	@param count - The number of items to evict. Defaults to 1.

	It will always keep at least one item in the cache.

	@example
	```
	import QuickLRU from 'quick-lru';

	const lru = new QuickLRU({maxSize: 10});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);

	lru.evict(2); // Evicts 'a' and 'b'

	console.log(lru.has('a'));
	//=> false

	console.log(lru.has('c'));
	//=> true
	```
	*/
	evict(count = 1): void {
		const requested = Number(count);
		if (!requested || requested <= 0) {
			return;
		}

		const items = [...this.#entriesAscending()];
		const evictCount = Math.trunc(Math.min(requested, Math.max(items.length - 1, 0)));
		if (evictCount <= 0) {
			return;
		}

		this.#emitEvictions(items.slice(0, evictCount));
		this.#oldCache = new Map(items.slice(evictCount));
		this.#cache = new Map();
		this.#size = 0;
	}

	/**
	Iterable for all the keys.
	*/
	* keys(): MapIterator<KeyType> {
		for (const [key] of this) {
			yield key;
		}
	}

	/**
	Iterable for all the values.
	*/
	* values(): MapIterator<ValueType> {
		for (const [, value] of this) {
			yield value;
		}
	}

	* [Symbol.iterator](): MapIterator<[KeyType, ValueType]> {
		for (const item of this.#cache) {
			const [key, value] = item;
			const deleted = this.#deleteIfExpired(key, value);
			if (!deleted) {
				yield [key, value.value];
			}
		}

		for (const item of this.#oldCache) {
			const [key, value] = item;
			if (!this.#cache.has(key)) {
				const deleted = this.#deleteIfExpired(key, value);
				if (!deleted) {
					yield [key, value.value];
				}
			}
		}
	}

	/**
	Iterable for all entries, starting with the newest (descending in recency).
	*/
	* entriesDescending(): MapIterator<[KeyType, ValueType]> {
		let items = [...this.#cache];
		for (let i = items.length - 1; i >= 0; --i) {
			const item = items[i]!;
			const [key, value] = item;
			const deleted = this.#deleteIfExpired(key, value);
			if (!deleted) {
				yield [key, value.value];
			}
		}

		items = [...this.#oldCache];
		for (let i = items.length - 1; i >= 0; --i) {
			const item = items[i]!;
			const [key, value] = item;
			if (!this.#cache.has(key)) {
				const deleted = this.#deleteIfExpired(key, value);
				if (!deleted) {
					yield [key, value.value];
				}
			}
		}
	}

	/**
	Iterable for all entries, starting with the oldest (ascending in recency).
	*/
	* entriesAscending(): MapIterator<[KeyType, ValueType]> {
		for (const [key, value] of this.#entriesAscending()) {
			yield [key, value.value];
		}
	}

	/**
	The stored item count.
	*/
	get size(): number {
		if (!this.#size) {
			return this.#oldCache.size;
		}

		let oldCacheSize = 0;
		for (const key of this.#oldCache.keys()) {
			if (!this.#cache.has(key)) {
				oldCacheSize++;
			}
		}

		return Math.min(this.#size + oldCacheSize, this.#maxSize);
	}

	/**
	The set max size.
	*/
	get maxSize(): number {
		return this.#maxSize;
	}

	/**
	The set max age.
	*/
	get maxAge(): number {
		return this.#maxAge;
	}

	entries(): MapIterator<[KeyType, ValueType]> {
		return this.entriesAscending();
	}

	forEach(callbackFunction: (value: ValueType, key: KeyType, map: Map<KeyType, ValueType>) => void, thisArgument: unknown = this): void {
		for (const [key, value] of this.entriesAscending()) {
			callbackFunction.call(thisArgument, value, key, this);
		}
	}

	get [Symbol.toStringTag](): string {
		return 'QuickLRU';
	}

	toString(): string {
		return `QuickLRU(${this.size}/${this.maxSize})`;
	}

	[Symbol.for('nodejs.util.inspect.custom')]() {
		return this.toString();
	}
}
