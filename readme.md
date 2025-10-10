# quick-lru [![Coverage Status](https://codecov.io/gh/sindresorhus/quick-lru/branch/main/graph/badge.svg)](https://codecov.io/gh/sindresorhus/quick-lru/branch/main)

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

### new QuickLRU(options?)

Returns a new instance.

It's a [`Map`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Map) subclass.

### options

Type: `object`

#### maxSize

*Required*\
Type: `number`

The target maximum number of items before evicting the least recently used items.

> [!NOTE]
> This package uses an [algorithm](#algorithm) which maintains between `maxSize` and `2 × maxSize` items for performance reasons. The cache may temporarily contain up to twice the specified size due to the dual-cache design that avoids expensive delete operations.

#### maxAge

Type: `number`\
Default: `Infinity`

The maximum number of milliseconds an item should remain in the cache.
By default, `maxAge` will be `Infinity`, which means that items will never expire.

Lazy expiration occurs upon the next `write` or `read` call.

Individual expiration of an item can be specified by the `set(key, value, options)` method.

#### onEviction

*Optional*\
Type: `(key, value) => void`

Called right before an item is evicted from the cache due to LRU pressure, TTL expiration, or manual eviction via `evict()`.

Useful for side effects or for items like object URLs that need explicit cleanup (`revokeObjectURL`).

> [!NOTE]
> This callback is **not** called for manual removals via `delete()` or `clear()`. It fires for automatic evictions and manual evictions via `evict()`.

### Instance

The instance is an [`Iterable`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Iteration_protocols) of `[key, value]` pairs so you can use it directly in a [`for…of`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Statements/for...of) loop.

Both `key` and `value` can be of any type.

#### .set(key, value, options?)

Set an item. Returns the instance.

Individual expiration of an item can be specified with the `maxAge` option. If not specified, the global `maxAge` value will be used in case it is specified in the constructor; otherwise, the item will never expire.

#### .get(key)

Get an item.

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

It will always keep at least one item in the cache.

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

Iterable for all the keys.

#### .values()

Iterable for all the values.

#### .entriesAscending()

Iterable for all entries, starting with the oldest (ascending in recency).

#### .entriesDescending()

Iterable for all entries, starting with the newest (descending in recency).

#### .entries()

Iterable for all entries, starting with the oldest (ascending in recency).

**This method exists for `Map` compatibility. Prefer [.entriesAscending()](#entriesascending) instead.**

#### .forEach(callbackFunction, thisArgument)

Loop over entries calling the `callbackFunction` for each entry (ascending in recency).

**This method exists for `Map` compatibility. Prefer [.entriesAscending()](#entriesascending) instead.**

#### .size *(getter)*

The stored item count.

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
- Otherwise, add the key-value pair to the new cache
- When the new cache reaches `maxSize`, promote it to become the old cache and create a fresh new cache

On `get()` operations:
- If the key is in the new cache, return it directly
- If the key is in the old cache, move it to the new cache (promoting its recency)

### Benefits

- Performance: Avoids expensive `delete` operations that can cause performance issues in JavaScript engines
- Simplicity: No complex linked list management required
- Cache efficiency: Maintains LRU semantics while being much faster than traditional implementations

### Trade-offs

- Size variance: The cache can contain between `maxSize` and `2 × maxSize` items temporarily
- Memory overhead: Uses up to twice the target memory compared to strict LRU implementations

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
