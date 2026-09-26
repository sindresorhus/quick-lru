export type Options<KeyType = unknown, ValueType = unknown> = {
	/**
	The maximum number of milliseconds an item should remain in the cache. Must be greater than `0`. A non-numeric value means no expiration.

	@default Infinity

	By default, `maxAge` will be `Infinity`, which means that items will never expire.
	Lazy expiration: an expired item is removed when it is next read, iterated, or evicted. Until then, `.size` counts it.

	Individual expiration of an item can be specified with the `set(key, value, {maxAge})` method.
	*/
	readonly maxAge?: number;

	/**
	The target maximum number of items before evicting the least recently used items. Must be a whole number greater than `0`, or `Infinity`.

	__Note:__ This package uses an [algorithm](https://github.com/sindresorhus/quick-lru#algorithm) which can store up to `2 × maxSize - 1` items for performance reasons. `.size` is capped at `maxSize`.
	*/
	readonly maxSize: number;

	/**
	Called when an item is evicted from the cache due to LRU pressure, TTL expiration, `resize()`, or `evict()`.

	Useful for side effects or for items like object URLs that need explicit cleanup (`revokeObjectURL`).

	__Note:__ This callback is not called for manual removals via `delete()` or `clear()`, or when `set()` overwrites an item. The item is already removed when the callback runs. The callback must be synchronous, and it must not write to the cache.
	*/
	onEviction?: (key: KeyType, value: ValueType) => void;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export default class QuickLRU<KeyType, ValueType> extends Map<KeyType, ValueType> implements Iterable<[KeyType, ValueType]> {
	/**
	Simple ["Least Recently Used" (LRU) cache](https://en.m.wikipedia.org/wiki/Cache_replacement_policies#Least_Recently_Used_.28LRU.29).

	The instance is an [`Iterable`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Iteration_protocols) of `[key, value]` pairs so you can use it directly in a [`for…of`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Statements/for...of) loop, starting with the oldest (ascending in recency). Iterating removes the expired items it walks over. Keys added while iterating are not visited. Iteration copies the keys first, so it costs O(n) even when you stop early.

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
	constructor(options: Options<KeyType, ValueType>);

	// The iterator types come from `Map`, because newer TypeScript uses `MapIterator`, which is not assignable to `IterableIterator`.
	[Symbol.iterator](): ReturnType<Map<KeyType, ValueType>[typeof Symbol.iterator]>;

	/**
	Set an item. Returns the instance.

	Individual expiration of an item can be specified with the `maxAge` option. If not specified, the global `maxAge` value will be used in case it is specified in the constructor; otherwise the item will never expire. A value of `0` or less makes the item expire immediately, and a non-numeric or `NaN` value means no expiration.

	@returns The cache instance.
	*/
	set(key: KeyType, value: ValueType, options?: {maxAge?: number}): this;

	/**
	Get an item.

	@returns The stored item or `undefined`.
	*/
	get(key: KeyType): ValueType | undefined;

	/**
	Get an item, or set it to `value` if it does not exist.

	@returns The stored item, or `value` when the item was inserted.

	@example
	```
	import QuickLRU from 'quick-lru';

	const lru = new QuickLRU({maxSize: 1000});

	lru.set('🦄', '🌈');

	lru.getOrInsert('🦄', '💩');
	//=> '🌈'

	lru.getOrInsert('🦀', '🎀');
	//=> '🎀'
	```
	*/
	getOrInsert(key: KeyType, value: ValueType): ValueType;

	/**
	Get an item, or set it to the result of `callback(key)` if it does not exist. `callback` is only called when the item does not exist.

	@returns The stored item, or the value returned by `callback` when the item was inserted.

	@example
	```
	import QuickLRU from 'quick-lru';

	const lru = new QuickLRU({maxSize: 1000});

	lru.getOrInsertComputed('🦄', () => '🌈');
	//=> '🌈'
	```
	*/
	getOrInsertComputed(key: KeyType, callback: (key: KeyType) => ValueType): ValueType;

	/**
	Check if an item exists.
	*/
	has(key: KeyType): boolean;

	/**
	Get an item without marking it as recently used.

	@returns The stored item or `undefined`.
	*/
	peek(key: KeyType): ValueType | undefined;

	/**
	Delete an item.

	@returns `true` if the item is removed or `false` if the item doesn't exist.
	*/
	delete(key: KeyType): boolean;

	/**
	Delete all items.
	*/
	clear(): void;

	/**
	Get the remaining time to live (in milliseconds) for the given item, or `undefined` when the item is not in the cache.

	- Does not mark the item as recently used.
	- Does not trigger lazy expiration or remove the entry when it is expired.
	- Returns `Infinity` if the item has no expiration.
	- May return a negative number if the item is already expired but not yet lazily removed.

	@returns Remaining time to live in milliseconds when set, `Infinity` when there is no expiration, or `undefined` when the item does not exist.
	*/
	expiresIn(key: KeyType): number | undefined;

	/**
	Update the `maxSize` in-place, discarding items as necessary. Insertion order is mostly preserved, though this is not a strong guarantee.

	Useful for on-the-fly tuning of cache sizes in live systems.
	*/
	resize(maxSize: number): void;

	/**
	The stored item count, capped at `maxSize`.
	*/
	get size(): number;

	/**
	The set max size.
	*/
	get maxSize(): number;

	/**
	The set max age.
	*/
	get maxAge(): number;

	/**
	Iterable for all the keys, starting with the oldest (ascending in recency).
	*/
	keys(): ReturnType<Map<KeyType, ValueType>['keys']>;

	/**
	Iterable for all the values, starting with the oldest (ascending in recency).
	*/
	values(): ReturnType<Map<KeyType, ValueType>['values']>;

	/**
	Loop over the entries, calling `callbackFunction` for each, starting with the oldest.

	@param callbackFunction - Called with the value, the key, and the instance.
	@param thisArgument - Used as `this` when calling `callbackFunction`. Defaults to the instance.
	*/
	forEach(callbackFunction: (value: ValueType, key: KeyType, map: QuickLRU<KeyType, ValueType>) => void, thisArgument?: any): void;

	/**
	Iterable for all entries, starting with the oldest (ascending in recency).
	*/
	entriesAscending(): ReturnType<Map<KeyType, ValueType>['entries']>;

	/**
	Iterable for all entries, starting with the newest (descending in recency).
	*/
	entriesDescending(): ReturnType<Map<KeyType, ValueType>['entries']>;

	/**
	Evict the least recently used items from the cache.

	@param count - The number of items to evict. Defaults to 1.

	It will always keep at least one item in the cache, unless all items have expired. It walks the whole cache whatever `count` is, so it is for occasional use, not for a loop.

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
	evict(count?: number): void;
}
