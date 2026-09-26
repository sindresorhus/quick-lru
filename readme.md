# quick-lru

> Simple [“Least Recently Used” (LRU) cache](https://en.m.wikipedia.org/wiki/Cache_replacement_policies#Least_Recently_Used_.28LRU.29)

Useful when you need to cache something and limit memory usage.

See the [algorithm section](#algorithm) for implementation details.

## Install

```sh
npm install quick-lru
```

## Usage

```js
import QuickLRU from 'quick-lru';

const lru = new QuickLRU({maxSize: 1000});

lru.set('🦄', '🌈');

lru.has('🦄');
//=> true

lru.get('🦄');
//=> '🌈'
```

## API

### new QuickLRU(options)

Returns a new instance.

It's a [`Map`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Map) subclass.

Throws a `TypeError` if an option is invalid.

### options

Type: `object`

#### maxSize

*Required*\
Type: `number`

The target maximum number of items before evicting the least recently used items. Must be a whole number greater than `0`, or `Infinity`.

> [!NOTE]
> This package uses an [algorithm](#algorithm) which can store up to `2 × maxSize - 1` items for performance reasons. [`.size`](#size-getter) is capped at `maxSize`.

#### maxAge

Type: `number`\
Default: `Infinity`

The maximum number of milliseconds an item should remain in the cache. Must be greater than `0`. A non-numeric value means no expiration.
By default, `maxAge` will be `Infinity`, which means that items will never expire.

Lazy expiration: an expired item is removed when it is next read, iterated, or evicted. Until then, [`.size`](#size-getter) counts it.

Individual expiration of an item can be specified by the `set(key, value, options)` method.

#### onEviction

*Optional*\
Type: `(key, value) => void`

Called when an item is evicted from the cache due to LRU pressure, TTL expiration, `resize()`, or `evict()`.

Useful for side effects or for items like object URLs that need explicit cleanup (`revokeObjectURL`).

> [!NOTE]
> This callback is **not** called for manual removals via `delete()` or `clear()`, or when `set()` overwrites an item. The item is already removed when the callback runs. The callback must be synchronous, and it must not write to the cache.

### Instance

The instance is an [`Iterable`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Iteration_protocols) of `[key, value]` pairs so you can use it directly in a [`for…of`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Statements/for...of) loop, starting with the oldest (ascending in recency). Iterating removes the expired items it walks over. Keys added while iterating are not visited. Iteration copies the keys first, so it costs O(n) even when you stop early.

Both `key` and `value` can be of any type.

> [!TIP]
> In TypeScript, the key and value types can only be inferred from `onEviction`. Otherwise, specify them: `new QuickLRU<string, string>({maxSize: 1000})`.

#### .set(key, value, options?)

Set an item. Returns the instance.

Individual expiration of an item can be specified with the `maxAge` option. If not specified, the global `maxAge` value will be used in case it is specified in the constructor; otherwise, the item will never expire. A value of `0` or less makes the item expire immediately, and a non-numeric or `NaN` value means no expiration.

#### .get(key)

Get an item.

#### .getOrInsert(key, value)

Get an item, or set it to `value` if it does not exist.

```js
import QuickLRU from 'quick-lru';

const lru = new QuickLRU({maxSize: 1000});

lru.set('🦄', '🌈');

lru.getOrInsert('🦄', '💩');
//=> '🌈'

lru.getOrInsert('🦀', '🎀');
//=> '🎀'
```

#### .getOrInsertComputed(key, callback)

Get an item, or set it to the result of `callback(key)` if it does not exist. `callback` is only called when the item does not exist.

```js
import QuickLRU from 'quick-lru';

const lru = new QuickLRU({maxSize: 1000});

lru.getOrInsertComputed('🦄', () => '🌈');
//=> '🌈'
```

#### .has(key)

Check if an item exists.

#### .peek(key)

Get an item without marking it as recently used.

#### .delete(key)

Delete an item.

Returns `true` if the item is removed or `false` if the item doesn't exist.

#### .clear()

Delete all items.

#### .expiresIn(key)

Get the remaining time to live (in milliseconds) for the given item, or `undefined` if the item is not in the cache.

- Does not mark the item as recently used.
- Does not trigger lazy expiration or remove the entry when it’s expired.
- Returns `Infinity` if the item has no expiration (`maxAge` not set for the item and no global `maxAge`).
- May return a negative number if the item has already expired but has not yet been lazily removed.

#### .resize(maxSize)

Update the `maxSize`, discarding items as necessary. Insertion order is mostly preserved, though this is not a strong guarantee.

Useful for on-the-fly tuning of cache sizes in live systems.

#### .evict(count?)

Evict the least recently used items from the cache.

The `count` parameter specifies how many items to evict. Defaults to 1.

It will always keep at least one item in the cache, unless all items have expired. It walks the whole cache whatever `count` is, so it is for occasional use, not for a loop.

```js
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

#### .keys()

Iterable for all the keys, starting with the oldest (ascending in recency).

#### .values()

Iterable for all the values, starting with the oldest (ascending in recency).

#### .entriesAscending()

Iterable for all entries, starting with the oldest (ascending in recency).

#### .entriesDescending()

Iterable for all entries, starting with the newest (descending in recency).

#### .entries()

Iterable for all entries, starting with the oldest (ascending in recency).

**This method exists for `Map` compatibility. Prefer [.entriesAscending()](#entriesascending) instead.**

#### .forEach(callbackFunction, thisArgument)

Loop over entries calling the `callbackFunction` for each entry (ascending in recency).

The callback is called with the value, the key, and the instance. `thisArgument` is used as `this`, and defaults to the instance.

**This method exists for `Map` compatibility. Prefer [.entriesAscending()](#entriesascending) instead.**

#### .size *(getter)*

The stored item count, capped at `maxSize`.

#### .maxSize *(getter)*

The set max size.

#### .maxAge *(getter)*

The set max age.

## Algorithm

This library implements a variant of the [hashlru algorithm](https://github.com/dominictarr/hashlru#algorithm) using JavaScript's `Map` for broader key type support.

### How it works

The algorithm uses a dual-cache approach with two `Map` objects:

1. New cache - Stores recently accessed items
2. Old cache - Stores less recently accessed items

On `set()` operations:
- If the key exists in the new cache, update it
- Otherwise, add the key-value pair to the new cache. A copy in the old cache is now stale, and it is dropped at the next promotion
- When the new cache reaches `maxSize`, promote it to become the old cache and create a fresh new cache

On `get()` operations:
- If the key is in the new cache, return it directly
- If the key is in the old cache, move it to the new cache (promoting its recency)

When the new cache is promoted, the previous old cache is discarded as a whole. This is where the speed comes from, and where this differs from a strict LRU. With `maxSize` 3:

```js
const evicted = [];
const lru = new QuickLRU({maxSize: 3, onEviction: key => evicted.push(key)});

for (const key of ['1', '2', '3', '4', '5', '6']) {
	lru.set(key, key);
	// The keys held after each write:
	// 1
	// 1 2
	// 1 2 3
	// 1 2 3 4
	// 1 2 3 4 5
	// 4 5 6
}

console.log(evicted);
//=> ['1', '2', '3']
```

A strict LRU drops `1`, `2`, and `3` one write at a time. Here they are dropped together on the sixth write, so a single write can evict up to `maxSize` items.

### Benefits

- Performance: Avoids expensive `delete` operations that can cause performance issues in JavaScript engines
- Simplicity: No complex linked list management required
- Cache efficiency: Approximates LRU semantics, with eviction in batches, while being much faster than traditional implementations

### Trade-offs

- Size variance: The cache can contain between `0` and `2 × maxSize - 1` items temporarily
- Memory overhead: Uses roughly twice the target memory compared to strict LRU implementations

### When to use

Choose this implementation when:
- You need high-performance caching with many operations
- You can tolerate temporary size variance for better performance
- You want simple, reliable caching without complex data structures

Consider alternatives when:
- You need strict memory limits (exactly `maxSize` items)
- Memory usage is more critical than performance

## Related

- [yocto-queue](https://github.com/sindresorhus/yocto-queue) - Tiny queue data structure
