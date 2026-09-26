// `maxSize` is a count, so a fraction is never meaningful. `Infinity` is allowed as an unbounded cache.
// A `maxSize` past `Number.MAX_SAFE_INTEGER` is a count the cache can never reach. It is accepted today, so the check stays `Number.isInteger` instead of narrowing the values `maxSize` accepts.
const isValidMaxSize = value => typeof value === 'number'
	&& value > 0
	// eslint-disable-next-line unicorn/prefer-number-is-safe-integer
	&& (Number.isInteger(value) || value === Infinity);

// A per-item `maxAge` of `NaN` stores a `NaN` expiry, which means no expiry. Zero is a real expiry, so this must not be a truthiness check.
const hasExpiry = item => item.expiry !== undefined && !Number.isNaN(item.expiry);

// Modes for `#walk()`, by what it yields: a key, a value, a `[key, value]` pair, or the `[key, item]` pair that `evict()` and `resize()` need to act on the captured item.
const MODE_KEYS = 0;
const MODE_VALUES = 1;
const MODE_ENTRIES = 2;
const MODE_ITEMS = 3;

const INVALID_MAX_SIZE_MESSAGE = '`maxSize` must be a whole number greater than 0 or `Infinity`';

export default class QuickLRU extends Map {
	#cache = new Map();
	#oldCache = new Map();
	#maxSize;
	#maxAge;
	#onEviction;

	constructor(options = {}) {
		super();

		if (!isValidMaxSize(options.maxSize)) {
			throw new TypeError(INVALID_MAX_SIZE_MESSAGE);
		}

		if (typeof options.maxAge === 'number' && !(options.maxAge > 0)) {
			throw new TypeError('`maxAge` must be a number greater than 0');
		}

		this.#maxSize = options.maxSize;
		this.#maxAge = typeof options.maxAge === 'number' ? options.maxAge : Infinity;
		this.#onEviction = options.onEviction;
	}

	#emitEvictions(cache) {
		if (typeof this.#onEviction !== 'function') {
			return;
		}

		// A stale copy of a key that was written again is not an eviction, since the key is still in the cache. Filter before notifying, since a callback read can expire the current copy.
		const evictions = [...cache].filter(([key]) => !this.#cache.has(key) && !this.#oldCache.has(key));
		for (const [key, item] of evictions) {
			this.#onEviction(key, item.value);
		}
	}

	#deleteIfExpired(key, item) {
		if (hasExpiry(item) && item.expiry <= Date.now()) {
			// Remove before notifying, so a callback that reads the cache does not see the expired item.
			const deleted = this.delete(key);
			if (deleted && typeof this.#onEviction === 'function') {
				this.#onEviction(key, item.value);
			}

			return deleted;
		}

		return false;
	}

	// Returns the value, or `undefined` once the item has been removed as expired.
	#getItemValue(key, item) {
		return this.#deleteIfExpired(key, item) === false ? item.value : undefined;
	}

	#set(key, item) {
		this.#cache.set(key, item);

		if (this.#cache.size < this.#maxSize) {
			return;
		}

		const oldCache = this.#oldCache;
		this.#oldCache = this.#cache;
		this.#cache = new Map();
		// Emit after the swap, so a throwing callback cannot leave the caches out of sync.
		this.#emitEvictions(oldCache);
	}

	#moveToRecent(key, item) {
		this.#oldCache.delete(key);
		this.#set(key, item);
	}

	// The current item for `key`, or `undefined` if it is gone or has expired. The recent cache wins, since an old cache copy of a key that is in both is stale. Not a generator, since this runs once per item during iteration.
	#liveItem(key) {
		const item = this.#cache.get(key) ?? this.#oldCache.get(key);
		if (item !== undefined && this.#deleteIfExpired(key, item) === false) {
			return item;
		}
	}

	// The current item for `key`, promoted to the recent cache when it was in the old one, or `undefined` when the key is missing or has expired. Only for the methods that refresh recency, since promoting is what separates them from `peek()`. One lookup per cache, since where the item is found decides the promotion. Not a generator, since this runs once per lookup.
	#getLiveItem(key) {
		let item = this.#cache.get(key);
		if (item === undefined) {
			item = this.#oldCache.get(key);
			if (item === undefined || this.#deleteIfExpired(key, item)) {
				return;
			}

			this.#moveToRecent(key, item);
		} else if (this.#deleteIfExpired(key, item)) {
			return;
		}

		return item;
	}

	// The old cache keys that are not also in the recent cache, since an old copy of such a key is stale. A plain loop, since this runs once per item during iteration.
	#olderKeys() {
		const keys = [];
		for (const key of this.#oldCache.keys()) {
			if (!this.#cache.has(key)) {
				keys.push(key);
			}
		}

		return keys;
	}

	* #walk(mode, descending) {
		// Snapshot the keys, so writes during the walk cannot make it visit a key twice or loop forever. The old keys not also in the recent cache come first, then the recent cache, which ascends in recency. Reversing that list is the descending order, so both directions share this loop.
		const keys = [...this.#olderKeys(), ...this.#cache.keys()];
		if (descending) {
			keys.reverse();
		}

		for (const key of keys) {
			const item = this.#liveItem(key);
			if (item === undefined) {
				continue;
			}

			// The dispatch is an else-if chain because a `switch` would need a `break` per case inside the walk's loop, which lint flags.
			// eslint-disable-next-line unicorn/prefer-switch
			if (mode === MODE_KEYS) {
				yield key;
			} else if (mode === MODE_VALUES) {
				yield item.value;
			} else if (mode === MODE_ITEMS) {
				yield [key, item];
			} else {
				// MODE_ENTRIES.
				yield [key, item.value];
			}
		}
	}

	// For tests. Public on purpose, so the test suite can see where an item lives.
	// eslint-disable-next-line unicorn/prefer-private-class-fields
	get __oldCache() {
		return this.#oldCache;
	}

	get(key) {
		const item = this.#getLiveItem(key);
		return item === undefined ? undefined : item.value;
	}

	getOrInsert(key, value) {
		// One lookup, so a stored `undefined` does not pay for a second round, and an item that expires during the call is treated as missing.
		const item = this.#getLiveItem(key);
		if (item === undefined) {
			this.set(key, value);
			return value;
		}

		return item.value;
	}

	getOrInsertComputed(key, callback) {
		const item = this.#getLiveItem(key);
		if (item === undefined) {
			// Only called for a missing key, matching `Map`.
			const value = callback(key);
			this.set(key, value);
			return value;
		}

		return item.value;
	}

	set(key, value, {maxAge = this.#maxAge} = {}) {
		const expiry = typeof maxAge === 'number' && maxAge !== Infinity
			? (Date.now() + maxAge)
			: undefined;

		// No lookup is spent telling an existing key from a new one: `#set()` updates a hit in place, since a hit cannot fill the cache, and only an insert can grow it into a rotation. An old cache copy of a re-set key is left in place, stale, and the next rotation drops it.
		this.#set(key, {value, expiry});

		return this;
	}

	has(key) {
		const item = this.#cache.get(key) ?? this.#oldCache.get(key);
		return item !== undefined && !this.#deleteIfExpired(key, item);
	}

	peek(key) {
		const item = this.#cache.get(key) ?? this.#oldCache.get(key);
		return item === undefined ? undefined : this.#getItemValue(key, item);
	}

	expiresIn(key) {
		const item = this.#cache.get(key) ?? this.#oldCache.get(key);
		if (item) {
			return hasExpiry(item) ? item.expiry - Date.now() : Infinity;
		}
	}

	delete(key) {
		const deleted = this.#cache.delete(key);
		return this.#oldCache.delete(key) || deleted;
	}

	clear() {
		this.#cache.clear();
		this.#oldCache.clear();
	}

	resize(newSize) {
		if (!isValidMaxSize(newSize)) {
			throw new TypeError(INVALID_MAX_SIZE_MESSAGE);
		}

		const items = [...this.#walk(MODE_ITEMS)];
		const removeCount = items.length - newSize;
		if (removeCount < 0) {
			this.#cache = new Map(items);
			this.#oldCache = new Map();
		} else {
			this.#oldCache = new Map(items.slice(removeCount));
			this.#cache = new Map();
		}

		this.#maxSize = newSize;

		if (removeCount > 0) {
			// Emit after the rebuild, so a callback that throws or writes cannot undo it.
			this.#emitEvictions(items.slice(0, removeCount));
		}
	}

	evict(count = 1) {
		const requested = Number(count);
		if (!requested || requested <= 0) {
			return;
		}

		// Delete the oldest items where they live. Rebuilding the caches would empty the recent cache, which counts toward the rotation, and repeated calls would then keep deferring the rotation, so the cache would grow without limit.
		const live = [...this.#walk(MODE_ITEMS)];

		const evictCount = Math.min(Math.trunc(requested), Math.max(live.length - 1, 0));
		const evicted = [];
		for (const [key] of live.slice(0, evictCount)) {
			// A callback during the walk can change the cache, so report the current item, and only if it is still there.
			const item = this.#cache.get(key) ?? this.#oldCache.get(key);
			if (item !== undefined && this.delete(key)) {
				evicted.push([key, item]);
			}
		}

		// Emit after the removals, so a callback that throws or writes cannot undo them.
		this.#emitEvictions(evicted);
	}

	keys() {
		return this.#walk(MODE_KEYS);
	}

	values() {
		return this.#walk(MODE_VALUES);
	}

	[Symbol.iterator]() {
		// `Map` requires the iterator, `keys()`, `values()` and `entries()` to agree on the order.
		return this.entriesAscending();
	}

	entriesDescending() {
		return this.#walk(MODE_ENTRIES, true);
	}

	entriesAscending() {
		return this.#walk(MODE_ENTRIES);
	}

	get size() {
		// A key that `set()` wrote again can be in both caches, so count it once. Either cache can be walked for that, so walk the smaller one, and skip the walk entirely while one is still empty.
		const recentSize = this.#cache.size;
		const olderSize = this.#oldCache.size;
		if (recentSize === 0 || olderSize === 0) {
			return Math.min(recentSize + olderSize, this.#maxSize);
		}

		let walked = this.#cache;
		let checked = this.#oldCache;
		if (olderSize < recentSize) {
			walked = this.#oldCache;
			checked = this.#cache;
		}

		let duplicates = 0;
		for (const key of walked.keys()) {
			if (checked.has(key)) {
				duplicates++;
			}
		}

		return Math.min(recentSize + olderSize - duplicates, this.#maxSize);
	}

	get maxSize() {
		return this.#maxSize;
	}

	get maxAge() {
		return this.#maxAge;
	}

	entries() {
		return this.entriesAscending();
	}

	forEach(callbackFunction, thisArgument = this) {
		for (const [key, value] of this.entriesAscending()) {
			callbackFunction.call(thisArgument, value, key, this);
		}
	}

	get [Symbol.toStringTag]() {
		return 'QuickLRU';
	}

	toString() {
		return `QuickLRU(${this.size}/${this.maxSize})`;
	}

	[Symbol.for('nodejs.util.inspect.custom')]() {
		return this.toString();
	}
}
