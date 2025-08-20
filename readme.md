# quick-lru [![Coverage Status](https://codecov.io/gh/sindresorhus/quick-lru/branch/main/graph/badge.svg)](https://codecov.io/gh/sindresorhus/quick-lru/branch/main)

> Simple [“Least Recently Used” (LRU) cache](https://en.m.wikipedia.org/wiki/Cache_replacement_policies#Least_Recently_Used_.28LRU.29)

Useful when you need to cache something and limit memory usage.

Inspired by the [`hashlru` algorithm](https://github.com/dominictarr/hashlru#algorithm), but instead uses [`Map`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Map) to support keys of any type, not just strings, and values can be `undefined`.

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

The maximum number of items before evicting the least recently used items.

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

Called right before an item is evicted from the cache.

Useful for side effects or for items like object URLs that need explicit cleanup (`revokeObjectURL`).

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

## Related

- [yocto-queue](https://github.com/sindresorhus/yocto-queue) - Tiny queue data structure
