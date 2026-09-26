import {inspect} from 'node:util';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import QuickLRU from './index.js';

const lruWithDuplicates = () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('key', 'value');
	lru.set('keyDupe', 1);
	lru.set('keyDupe', 2);
	return lru;
};

test('main', () => {
	assert.throws(() => {
		new QuickLRU(); // eslint-disable-line no-new
	}, {message: /maxSize/v});
});

test('maxSize: throws on a non-number', () => {
	// The comparison coerces, so these were accepted and leaked back out of the `maxSize` getter.
	for (const maxSize of ['5', true, [5]]) {
		assert.throws(() => {
			new QuickLRU({maxSize}); // eslint-disable-line no-new
		}, {message: /maxSize/v}, `maxSize: ${String(maxSize)}`);
	}
});

test('maxSize: throws on a negative, `NaN` or zero value', () => {
	for (const maxSize of [0, -1, NaN, -0.5]) {
		assert.throws(() => {
			new QuickLRU({maxSize}); // eslint-disable-line no-new
		}, {message: /maxSize/v}, `maxSize: ${maxSize}`);
	}
});

test('maxSize: throws on a fractional value', () => {
	// A count cannot be fractional, and the fraction leaked into `size` and `toString()`.
	assert.throws(() => {
		new QuickLRU({maxSize: 2.5}); // eslint-disable-line no-new
	}, {message: '`maxSize` must be a whole number greater than 0 or `Infinity`'});

	const lru = new QuickLRU({maxSize: 5});
	assert.throws(() => {
		lru.resize(2.5);
	}, {message: '`maxSize` must be a whole number greater than 0 or `Infinity`'});
	assert.equal(lru.maxSize, 5);
});

test('the `maxSize` error message describes every rejected value', () => {
	// A fraction is a number greater than 0, so the message used to be wrong for it.
	for (const maxSize of [2.5, 0, -3, '5', true, NaN]) {
		assert.throws(() => {
			new QuickLRU({maxSize}); // eslint-disable-line no-new
		}, {message: '`maxSize` must be a whole number greater than 0 or `Infinity`'}, `maxSize: ${String(maxSize)}`);
	}
});

test('maxSize: accepts a positive whole number and `Infinity`', () => {
	assert.equal(new QuickLRU({maxSize: 1}).maxSize, 1);
	assert.equal(new QuickLRU({maxSize: 2.5 + 0.5}).maxSize, 3);
	assert.equal(new QuickLRU({maxSize: Infinity}).maxSize, Infinity);
});

test('maxSize: `Infinity` never evicts', () => {
	const lru = new QuickLRU({maxSize: Infinity});
	for (let index = 0; index < 1000; index++) {
		lru.set(index, index);
	}

	// The rotation never runs, so the old cache stays empty and nothing is capped.
	assert.equal(lru.size, 1000);
	assert.equal([...lru].length, 1000);
	assert.ok(lru.has(0));
	assert.ok(lru.has(999));
});

test('the read methods work for a key that is only in the old cache', () => {
	const lru = new QuickLRU({maxSize: 3, maxAge: 10_000});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	// `1` to `3` are now in the old cache, and readable.
	assert.ok(lru.__oldCache.has('1'));
	assert.ok(lru.__oldCache.has('2'));
	assert.ok(lru.__oldCache.has('3'));

	assert.ok(lru.has('1'));
	assert.equal(lru.peek('1'), 1);
	assert.ok(lru.expiresIn('1') > 0);
	assert.equal(lru.get('1'), 1);
	// Reading promotes it, so it is no longer only in the old cache.
	assert.equal(lru.__oldCache.has('1'), false);

	assert.ok(lru.delete('2'));
	assert.ok(!(lru.has('2')));
});

test('clear() keeps the configuration', () => {
	const lru = new QuickLRU({maxSize: 3, maxAge: 1000});
	lru.set('1', 1);
	lru.clear();

	assert.equal(lru.size, 0);
	assert.equal(lru.maxSize, 3);
	assert.equal(lru.maxAge, 1000);
	assert.deepEqual([...lru], []);
	assert.equal(lru.toString(), 'QuickLRU(0/3)');
});

test('maxAge: throws on invalid value', () => {
	assert.throws(() => {
		new QuickLRU({maxSize: 10, maxAge: 0}); // eslint-disable-line no-new
	}, {message: /maxAge/v});
});

test('maxAge: throws on a negative or `NaN` value', () => {
	for (const maxAge of [-1, -0.5, NaN]) {
		assert.throws(() => {
			new QuickLRU({maxSize: 10, maxAge}); // eslint-disable-line no-new
		}, {message: /maxAge/v}, `maxAge: ${maxAge}`);
	}
});

test('maxAge: accepts a positive value and `Infinity`', () => {
	assert.equal(new QuickLRU({maxSize: 10, maxAge: 1}).maxAge, 1);
	assert.equal(new QuickLRU({maxSize: 10, maxAge: Infinity}).maxAge, Infinity);
});

test('maxAge: undefined means no expiration', () => {
	const lru = new QuickLRU({maxSize: 10, maxAge: undefined});
	assert.equal(lru.maxAge, Infinity);
});

test('maxAge: a non-numeric value means no expiration', () => {
	// Matches `set()`, which also ignores a non-numeric per-item `maxAge`.
	for (const maxAge of ['100', null, true, {}, [100]]) {
		assert.equal(new QuickLRU({maxSize: 10, maxAge}).maxAge, Infinity, `maxAge: ${String(maxAge)}`);
	}
});

test('.getOrInsert() inserts a missing key and returns the stored value otherwise', () => {
	const lru = new QuickLRU({maxSize: 5});

	assert.equal(lru.getOrInsert('a', 1), 1);
	assert.equal(lru.get('a'), 1);
	assert.equal(lru.size, 1);
	assert.deepEqual([...lru.keys()], ['a']);

	// The stored value wins over the passed one.
	assert.equal(lru.getOrInsert('a', 2), 1);
	assert.equal(lru.get('a'), 1);
	assert.equal(lru.size, 1);
});

test('.getOrInsertComputed() only calls the callback for a missing key', () => {
	const lru = new QuickLRU({maxSize: 5});
	const seenKeys = [];
	const compute = key => {
		seenKeys.push(key);
		return `value for ${key}`;
	};

	assert.equal(lru.getOrInsertComputed('a', compute), 'value for a');
	// Calling it again is the point: a second call must not recompute.
	// eslint-disable-next-line node-test/no-duplicate-assertions
	assert.equal(lru.getOrInsertComputed('a', compute), 'value for a');
	assert.deepEqual(seenKeys, ['a']);
	assert.equal(lru.get('a'), 'value for a');
	assert.equal(lru.size, 1);
});

test('.getOrInsert() stores into the LRU, not into the base `Map`', () => {
	// `QuickLRU` extends `Map` but keeps its items in two private maps, so an inherited method would write to the unused base storage, where nothing can ever see or remove it again.
	const baseMapSize = () => Object.getOwnPropertyDescriptor(Map.prototype, 'size').get.call(lru);
	const lru = new QuickLRU({maxSize: 5});

	lru.getOrInsert('a', 1);
	lru.getOrInsertComputed('b', () => 2);
	assert.equal(baseMapSize(), 0);

	lru.clear();
	assert.equal(lru.size, 0);
	assert.deepEqual([...lru], []);
	assert.equal(baseMapSize(), 0);
});

test('.getOrInsert() marks an existing key as recently used', () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	// `1` is now only in the old cache.
	assert.equal(lru.getOrInsert('1', 99), 1);
	assert.equal(lru.__oldCache.has('1'), false);
	assert.deepEqual([...lru.entriesAscending()], [['2', 2], ['1', 1]]);
});

test('.getOrInsert() replaces an expired key', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 5});
	lru.set('a', 'old', {maxAge: 10});
	t.mock.timers.tick(100);
	// Expired, so it is gone by the time the insert is considered.
	assert.equal(lru.getOrInsert('a', 'new'), 'new');
	assert.equal(lru.get('a'), 'new');
	assert.equal(lru.size, 1);
});

test('.getOrInsert() stores an `undefined` value', () => {
	const lru = new QuickLRU({maxSize: 5});

	assert.equal(lru.getOrInsert('a', undefined), undefined);
	assert.ok(lru.has('a'));
	assert.equal(lru.size, 1);
	assert.deepEqual([...lru.keys()], ['a']);

	assert.equal(lru.getOrInsertComputed('b', () => undefined), undefined);
	assert.ok(lru.has('b'));
	assert.equal(lru.size, 2);
});

test('.getOrInsertComputed() leaves nothing behind when the callback throws', () => {
	const lru = new QuickLRU({maxSize: 5});

	assert.throws(() => {
		lru.getOrInsertComputed('a', () => {
			throw new Error('boom');
		});
	}, {message: 'boom'});

	assert.ok(!(lru.has('a')));
	assert.equal(lru.size, 0);
	assert.deepEqual([...lru], []);
});

// An item that expired between two expiry checks used to make `getOrInsert()` return `undefined` and store nothing. The clock is stubbed, so this test is serial and restores it.
test('.getOrInsert() returns the value when the item expires mid-call', () => {
	const realNow = Date.now;
	// `set` stamps an expiry of 1_000_500; the first check reads before it, a second one would read after.
	const times = [1_000_000, 1_000_100, 1_000_600];
	let calls = 0;
	Date.now = () => times[Math.min(calls++, times.length - 1)];

	try {
		const lru = new QuickLRU({maxSize: 5});
		lru.set('a', 'old', {maxAge: 500});
		const returned = lru.getOrInsert('a', 'new');

		// The item was alive for the first expiry check, so its value comes back.
		assert.notEqual(returned, undefined, 'never undefined for a key that was live a moment ago');
		assert.equal(returned, 'old', 'the value that was still live came back');

		// Wind the clock back inside the TTL and check the entry survived intact, rather than being deleted and re-inserted.
		const insideTtl = () => {
			calls = 1;
		};

		insideTtl();
		assert.ok(lru.has('a'), 'still cached');
		insideTtl();
		assert.equal(lru.peek('a'), 'old', 'still holds the live value, not the new one');
		insideTtl();
		assert.equal(lru.get('a'), 'old');
	} finally {
		Date.now = realNow;
	}
});

// Same as the `getOrInsert()` case above.
test('.getOrInsertComputed() returns the value when the item expires mid-call', () => {
	const realNow = Date.now;
	// `set` stamps an expiry of 1_000_500; the first check reads before it, the second after.
	const times = [1_000_000, 1_000_100, 1_000_600];
	let calls = 0;
	Date.now = () => times[Math.min(calls++, times.length - 1)];

	try {
		const lru = new QuickLRU({maxSize: 5});
		lru.set('a', 'old', {maxAge: 500});
		let called = 0;
		const returned = lru.getOrInsertComputed('a', () => {
			called++;
			return 'new';
		});

		assert.notEqual(returned, undefined, 'never undefined for a key that was live a moment ago');
		assert.equal(returned, 'old', 'the value that was still live came back');
		assert.equal(called, 0, 'the callback was not called for a present key');

		// Wind the clock back inside the TTL and check the entry survived intact.
		const insideTtl = () => {
			calls = 1;
		};

		insideTtl();
		assert.ok(lru.has('a'), 'still cached');
		insideTtl();
		assert.equal(lru.peek('a'), 'old', 'still holds the live value, not the new one');
	} finally {
		Date.now = realNow;
	}
});

test('.getOrInsert() over an existing `undefined` value', () => {
	const lru = new QuickLRU({maxSize: 5});
	lru.set('a', undefined);

	// `undefined` is a value, not a miss, so the insert must not happen.
	assert.equal(lru.getOrInsert('a', 1), undefined);
	assert.equal(lru.get('a'), undefined);
	assert.equal(lru.size, 1);
});

test('.getOrInsert() applies the global `maxAge`', () => {
	const lru = new QuickLRU({maxSize: 5, maxAge: 1});
	lru.getOrInsert('a', 1);
	lru.getOrInsertComputed('b', () => 2);
	assert.ok(lru.expiresIn('a') <= 1);
	assert.ok(lru.expiresIn('b') <= 1);
});

test('.get() / .set()', () => {
	const lru = new QuickLRU({maxSize: 100});
	lru.set('foo', 1);
	const setReturnValue = lru.set('bar', 2);
	assert.equal(setReturnValue, lru);
	assert.equal(lru.get('foo'), 1);
	assert.equal(lru.size, 2);
});

test('.get() - limit', () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	assert.equal(lru.get('1'), 1);
	assert.equal(lru.get('3'), undefined);
	lru.set('3', 3);
	lru.get('1');
	lru.set('4', 4);
	lru.get('1');
	lru.set('5', 5);
	assert.ok(lru.has('1'));
});

test('.set() - limit', () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('foo', 1);
	lru.set('bar', 2);
	assert.equal(lru.get('foo'), 1);
	assert.equal(lru.get('bar'), 2);
	lru.set('baz', 3);
	lru.set('faz', 4);
	assert.ok(!(lru.has('foo')));
	assert.ok(!(lru.has('bar')));
	assert.ok(lru.has('baz'));
	assert.ok(lru.has('faz'));
	assert.equal(lru.size, 2);
});

test('.set() - update item', () => {
	const lru = new QuickLRU({maxSize: 100});
	lru.set('foo', 1);
	assert.equal(lru.get('foo'), 1);
	lru.set('foo', 2);
	assert.equal(lru.get('foo'), 2);
	assert.equal(lru.size, 1);
});

test('.set() of an existing key stores the new expiry', () => {
	const lru = new QuickLRU({maxSize: 5, maxAge: 10_000});
	lru.set('a', 1);
	assert.ok(lru.expiresIn('a') > 0);

	// Overwriting must not keep the expiry of the previous value.
	lru.set('a', 2, {maxAge: 20});
	assert.equal(lru.get('a'), 2);
	assert.ok(lru.expiresIn('a') <= 20, 'the shorter per-item expiry applies');

	lru.set('a', 3);
	assert.ok(lru.expiresIn('a') > 20, 'the global expiry applies again');

	lru.set('a', 4, {maxAge: Infinity});
	assert.equal(lru.expiresIn('a'), Infinity, 'the expiry can be cleared');
	assert.equal(lru.size, 1);
});

test('.set() promotion with `maxSize` 1', () => {
	const lru = new QuickLRU({maxSize: 1});
	lru.set('a', 1);
	lru.set('b', 2);
	// `a` is only in the old cache here, so this is an insert, not a promotion.
	lru.set('a', 3);
	assert.deepEqual([...lru.keys()], ['a']);
	assert.equal(lru.get('a'), 3);
	assert.equal(lru.size, 1);
});

test('symbol and `__proto__` keys survive promotion and eviction', () => {
	const symbol = Symbol('key');
	const lru = new QuickLRU({maxSize: 2});
	lru.set(symbol, 1);
	lru.set('__proto__', 2);
	// Both are only in the old cache, so these are inserts.
	lru.set(symbol, 3);
	assert.equal(lru.get(symbol), 3);

	lru.set('__proto__', 4);
	assert.equal(lru.get('__proto__'), 4);
	assert.equal(lru.size, 2);

	lru.evict(1);
	assert.equal([...lru.keys()].length, 1);
	assert.ok(lru.size > 0);
});

test('.get() keeps a recent-cache hit in place, and promotes an old-cache hit', () => {
	// Moving a recent-cache hit would more than double the cost of `get()`. The position only affects iteration order and which items `evict()` and `resize()` drop.
	const recent = new QuickLRU({maxSize: 3});
	recent.set('a', 1);
	recent.set('b', 2);
	recent.get('a');
	assert.deepEqual([...recent.entriesAscending()], [['a', 1], ['b', 2]]);

	const old = new QuickLRU({maxSize: 3});
	old.set('a', 1);
	old.set('b', 2);
	old.set('c', 3); // Rotates, so `a` and `b` are now only in the old cache
	old.get('a');
	assert.deepEqual([...old.entriesAscending()], [['b', 2], ['c', 3], ['a', 1]]);
});

test('.set() updates a recent-cache key in place, and promotes an old-cache key', () => {
	// Same as `get()`: moving a recent-cache key costs a delete and makes overwrites about 2.5x slower.
	const recent = new QuickLRU({maxSize: 3});
	recent.set('a', 1);
	recent.set('b', 2);
	recent.set('a', 3);
	assert.deepEqual([...recent.entriesAscending()], [['a', 3], ['b', 2]]);
	assert.deepEqual([...recent.entriesDescending()], [['b', 2], ['a', 3]]);
	assert.equal(recent.size, 2);

	const old = new QuickLRU({maxSize: 3});
	old.set('a', 1);
	old.set('b', 2);
	old.set('c', 3); // Rotates, so `a` and `b` are now only in the old cache
	old.set('a', 4);
	assert.deepEqual([...old.entriesAscending()], [['b', 2], ['c', 3], ['a', 4]]);
	assert.equal(old.size, 3);
});

test('.has()', () => {
	const lru = new QuickLRU({maxSize: 100});
	lru.set('foo', 1);
	assert.ok(lru.has('foo'));
});

test('.peek()', () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	assert.equal(lru.peek('1'), 1);
	lru.set('2', 2);
	assert.equal(lru.peek('1'), 1);
	assert.equal(lru.peek('3'), undefined);
	lru.set('3', 3);
	lru.set('4', 4);
	assert.ok(!(lru.has('1')));
});

test('expiresIn() returns undefined for missing key', () => {
	const lru = new QuickLRU({maxSize: 100});
	assert.equal(lru.expiresIn('nope'), undefined);
});

test('expiresIn() returns Infinity when no maxAge', () => {
	const lru = new QuickLRU({maxSize: 100});
	lru.set('infinity', 'no ttl given');
	assert.equal(lru.expiresIn('infinity'), Infinity);
});

test('expiresIn() returns remaining ms for expiring item', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 100});
	const maxAge = 4000;
	lru.set('4s', 'ttl given', {maxAge});
	const initialRemainingMs = lru.expiresIn('4s');
	assert.ok(initialRemainingMs <= maxAge);
	assert.ok(initialRemainingMs > maxAge - 500);
	t.mock.timers.tick(500);
	const remainingMs = lru.expiresIn('4s');
	assert.ok(remainingMs <= initialRemainingMs - 300);
	assert.ok(remainingMs > 0);
});

test('expiresIn() returns <= 0 when expired and does not evict', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 100});
	lru.set('short', 'value', {maxAge: 20});
	t.mock.timers.tick(30);
	const remainingMs = lru.expiresIn('short');
	assert.ok(remainingMs <= 0);
});

test('.delete()', () => {
	const lru = new QuickLRU({maxSize: 100});
	lru.set('foo', 1);
	lru.set('bar', 2);
	assert.ok(lru.delete('foo'));
	assert.ok(!(lru.has('foo')));
	assert.ok(lru.has('bar'));
	assert.ok(!(lru.delete('foo')));
	assert.equal(lru.size, 1);
});

test('.delete() - limit', () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('foo', 1);
	lru.set('bar', 2);
	assert.equal(lru.size, 2);
	assert.ok(lru.delete('foo'));
	assert.ok(!(lru.has('foo')));
	assert.ok(lru.has('bar'));
	lru.delete('bar');
	assert.equal(lru.size, 0);
});

test('.delete() reports correctly for every presence state', () => {
	const absent = new QuickLRU({maxSize: 5});
	absent.set('a', 1);
	assert.ok(!(absent.delete('missing')), 'absent key');
	assert.equal(absent.size, 1, 'size untouched');

	const recent = new QuickLRU({maxSize: 5});
	recent.set('a', 1);
	assert.ok(recent.delete('a'), 'recent key');
	assert.equal(recent.size, 0, 'size follows');

	const old = new QuickLRU({maxSize: 2});
	old.set('a', 1);
	old.set('b', 2);
	old.set('c', 3);
	assert.ok(old.__oldCache.has('a'), '`a` is only in the old cache');
	assert.ok(old.delete('a'), 'old cache key');
	assert.equal(old.size, 2);
	assert.deepEqual([...old.keys()], ['b', 'c']);

	const undefinedValue = new QuickLRU({maxSize: 5});
	undefinedValue.set('a', undefined);
	assert.ok(undefinedValue.has('a'), '`undefined` is a value, not a miss');
	assert.ok(undefinedValue.delete('a'));
	assert.equal(undefinedValue.size, 0);
});

test('.expiresIn() never promotes or removes', () => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 10_000});
	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);
	// The rotation leaves `a` and `b` only in the old cache.
	assert.ok(lru.__oldCache.has('a'));

	assert.ok(lru.expiresIn('a') > 0);
	assert.ok(lru.__oldCache.has('a'), 'still in the old cache');
	assert.equal(lru.size, 2, 'still counted');
	assert.equal(lru.expiresIn('missing'), undefined);
});

test('resize to `Infinity` and back', () => {
	const lru = new QuickLRU({maxSize: 3});
	lru.set('a', 1);
	lru.set('b', 2);
	lru.resize(Infinity);
	assert.equal(lru.maxSize, Infinity);
	assert.equal(lru.__oldCache.size, 0, 'growing folds everything into the recent cache');

	// An unbounded cache never rotates, so nothing is dropped.
	lru.set('c', 3);
	lru.set('d', 4);
	lru.set('e', 5);
	assert.equal(lru.size, 5);

	lru.resize(2);
	assert.equal(lru.maxSize, 2);
	assert.deepEqual([...lru.keys()], ['d', 'e']);
});

test('`clear()` during iteration', () => {
	const lru = new QuickLRU({maxSize: 10});
	for (let index = 0; index < 5; index++) {
		lru.set(index, index);
	}

	const seen = [];
	for (const [key] of lru) {
		seen.push(key);
		// Mutating during iteration is what this test is about.
		// eslint-disable-next-line unicorn/no-loop-iterable-mutation
		lru.clear();
	}

	assert.deepEqual(seen, [0]);
	assert.equal(lru.size, 0);
	assert.deepEqual([...lru], []);
});

test('`set()` does not keep a reference to the options object', () => {
	const lru = new QuickLRU({maxSize: 5});
	const options = {maxAge: 10_000};
	lru.set('a', 1, options);

	// Mutating the caller's object must not change the stored expiry. The TTL is long enough that the remaining time cannot plausibly drop this far in the meantime.
	options.maxAge = 1;
	assert.ok(lru.expiresIn('a') > 1000, 'the stored expiry was not shortened to 1ms');
});

test('only the items whose own `maxAge` passed expire', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	// A spread of per-item TTLs, so expiry times differ per key.
	const lru = new QuickLRU({maxSize: 10});
	lru.set('forever', 1);
	lru.set('brief', 2, {maxAge: 20});
	lru.set('medium', 3, {maxAge: 5000});
	t.mock.timers.tick(400);

	assert.ok(lru.has('forever'), 'no per-item maxAge');
	assert.ok(!(lru.has('brief')), 'the short TTL passed');
	assert.ok(lru.has('medium'), 'the long TTL did not');

	// Touching the expired one must not disturb the others.
	assert.deepEqual([...lru.keys()], ['forever', 'medium']);
	assert.equal(lru.size, 2);
});

test('degenerate key types round-trip', () => {
	const symbol = Symbol('key');
	const big = 9_007_199_254_740_993n;
	// `NaN` equals itself as a `Map` key, so these five all round-trip.
	const keys = [NaN, '', symbol, big, '0'];
	const lru = new QuickLRU({maxSize: 20});

	for (const [index, key] of keys.entries()) {
		lru.set(key, index);
	}

	for (const [index, key] of keys.entries()) {
		assert.equal(lru.get(key), index, `key ${renderForTest(key)}`);
		assert.ok(lru.has(key), `has ${renderForTest(key)}`);
	}

	assert.equal(lru.size, keys.length);
	assert.equal([...lru.keys()].length, keys.length);

	// `0` and `-0` are the same key to a `Map`, so the second write replaces the first.
	lru.set(0, 'first');
	lru.set(-0, 'second');
	assert.equal(lru.get(0), 'second');
	assert.equal(lru.get(-0), 'second');
	assert.equal(lru.size, keys.length + 1);

	assert.ok(lru.delete(symbol));
	assert.ok(!(lru.has(symbol)));
	assert.equal(lru.size, keys.length);
});

const renderForTest = key => typeof key === 'symbol' ? key.toString() : String(key);

test('a large `maxSize` holds every item', () => {
	const maxSize = 20_000;
	const lru = new QuickLRU({maxSize});
	for (let index = 0; index < maxSize; index++) {
		lru.set(index, index);
	}

	assert.equal(lru.size, maxSize);
	assert.equal([...lru].length, maxSize);
	assert.ok(lru.has(maxSize - 1));
});

test('.clear()', () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('foo', 1);
	lru.set('bar', 2);
	lru.set('baz', 3);
	lru.clear();
	assert.equal(lru.size, 0);
});

test('.keys()', () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	assert.deepEqual([...lru.keys()], ['1', '2', '3']);
});

test('.keys() - accounts for duplicates', () => {
	const lru = lruWithDuplicates();
	assert.deepEqual([...lru.keys()], ['key', 'keyDupe']);
});

test('.values()', () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	assert.deepEqual([...lru.values()], [1, 2, 3]);
});

test('.values() - accounts for duplicates', () => {
	const lru = lruWithDuplicates();
	assert.deepEqual([...lru.values()], ['value', 2]);
});

test('.[Symbol.iterator]()', () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	assert.deepEqual([...lru], [['1', 1], ['2', 2], ['3', 3]]);
});

test('iteration does not yield an item that was already evicted', () => {
	// A write from the callback can fill the recent cache and rotate, evicting the very entries the loop is walking. Handing those back would report an item as evicted and then let the consumer act on it anyway.
	const evicted = [];
	const lru = new QuickLRU({
		maxSize: 2,
		onEviction(key) {
			evicted.push(key);
		},
	});
	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);
	const seen = [];
	const stale = [];

	lru.forEach((value, key) => {
		// Visiting a key before it is evicted is fine, visiting it after is not.
		if (evicted.includes(key)) {
			stale.push(key);
		}

		seen.push(key);
		if (key !== 'a') {
			return;
		}

		lru.set('d', 4);
		lru.set('e', 5);
	});

	assert.deepEqual(evicted, ['a', 'b']);
	assert.deepEqual(stale, []);
});

test('`entriesDescending()` does not yield a key twice when the cache rotates', () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);
	const seen = [];

	for (const [key] of lru.entriesDescending()) {
		seen.push(key);
		if (key !== 'c') {
			continue;
		}

		lru.set('d', 4);
		lru.set('e', 5);
	}

	assert.deepEqual([...new Set(seen)], seen, 'no key is yielded twice');
});

test('iteration terminates when the consumer re-sets a key it was given', () => {
	// `get()` moves each key out of the old cache while the walk is on it, and moving the last one rotates the caches. Each key must still be visited once. Refreshing values while walking is natural, for instance to extend every TTL.
	const lru = new QuickLRU({maxSize: 3});
	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3); // Rotates, so all three are in the old cache

	const seen = [];
	for (const key of lru.keys()) {
		seen.push(key);
		lru.set(key, lru.get(key));
		// Throwing rather than looping forever, so a regression fails instead of hanging.
		if (seen.length > 50) {
			throw new Error(`iteration did not terminate, saw ${JSON.stringify(seen)}`);
		}
	}

	assert.deepEqual(seen, ['a', 'b', 'c'], 'every key exactly once');
});

test('iteration does not repeat a key that is promoted mid-walk', () => {
	const lru = new QuickLRU({maxSize: 5});
	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);
	// Fill once more so there is an old cache to promote out of.
	lru.set('d', 4);
	lru.set('e', 5);

	const seen = [];
	for (const [key] of lru) {
		seen.push(key);
		if (key === 'a') {
			lru.get('a'); // Promotes `a` out of the old cache
		}
	}

	assert.deepEqual(seen, ['a', 'b', 'c', 'd', 'e']);
});

test('iteration survives every kind of write from the callback', () => {
	// A consumer that writes while iterating is not supported, but the walk must still terminate and hand back each key at most once, and the cache must stay coherent. `set()` and `get()` move a key from the old cache to the end of the recent one, which is what made an unguarded walk loop forever.
	const mutations = [
		['no write', () => {}],
		['set(key, get(key))', (lru, key) => {
			lru.set(key, lru.get(key));
		}],
		['set twice', (lru, key) => {
			lru.set(key, 1);
			lru.set(key, 2);
		}],
		['get(key)', (lru, key) => {
			lru.get(key);
		}],
		['delete(key)', (lru, key) => {
			lru.delete(key);
		}],
		['evict(1)', lru => {
			lru.evict(1);
		}],
		['resize down', lru => {
			lru.resize(1);
		}],
		['set a new key', (lru, key) => {
			lru.set(`${key}:new`, 1);
		}],
		['getOrInsert(key)', (lru, key) => {
			lru.getOrInsert(key, 1);
		}],
	];

	for (const [label, mutate] of mutations) {
		for (const maxSize of [1, 3, 8]) {
			const lru = new QuickLRU({maxSize});
			for (let index = 0; index < 6; index++) {
				lru.set(String.fromCodePoint(97 + index), index);
			}

			const seen = [];
			for (const [key] of lru) {
				seen.push(key);
				mutate(lru, key);
				// A budget rather than an infinite loop, so a regression fails instead of hanging.
				if (seen.length > 100) {
					assert.fail(`${label} at maxSize ${maxSize}: did not terminate`);
					// The budget ends the runaway walk, and there is no outer loop to continue.
					// eslint-disable-next-line unicorn/no-break-in-nested-loop
					break;
				}
			}

			assert.equal(new Set(seen).size, seen.length, `${label} at maxSize ${maxSize}: each key at most once`);

			const after = [...lru];
			const afterKeys = after.map(([key]) => key);
			assert.equal(new Set(afterKeys).size, afterKeys.length, `${label} at maxSize ${maxSize}: no duplicates`);
			assert.equal(lru.size, Math.min(afterKeys.length, lru.maxSize), `${label} at maxSize ${maxSize}: size`);
			assert.ok(lru.size <= lru.maxSize, `${label} at maxSize ${maxSize}: size within maxSize`);
		}
	}
});

test('all the `Map` iteration methods agree on the order', () => {
	const lru = new QuickLRU({maxSize: 3});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	// `1` to `3` are now only in the old cache while `4` is in the recent cache, so the two halves of the dual cache are both populated and in a visible order.
	lru.set('4', 4);

	// `Map` requires these to all yield the same order, and `.entries()` is documented as starting with the oldest item.
	const ascending = [['1', 1], ['2', 2], ['3', 3], ['4', 4]];
	assert.deepEqual([...lru.entriesAscending()], ascending);
	assert.deepEqual([...lru.entries()], ascending);
	assert.deepEqual([...lru], ascending);
	assert.deepEqual([...lru.keys()], ['1', '2', '3', '4']);
	assert.deepEqual([...lru.values()], [1, 2, 3, 4]);

	const forEachSeen = [];
	lru.forEach((value, key) => {
		forEachSeen.push([key, value]);
	});
	assert.deepEqual(forEachSeen, ascending);

	assert.deepEqual([...lru.entriesDescending()], ascending.toReversed());
});

test('.[Symbol.iterator]() - accounts for duplicates', () => {
	const lru = lruWithDuplicates();
	assert.deepEqual([...lru], [['key', 'value'], ['keyDupe', 2]]);
});

test('.size', () => {
	const lru = new QuickLRU({maxSize: 100});
	lru.set('1', 1);
	lru.set('2', 2);
	assert.equal(lru.size, 2);
	lru.delete('1');
	assert.equal(lru.size, 1);
	lru.set('3', 3);
	assert.equal(lru.size, 2);
});

test('.size - accounts for duplicates', () => {
	const lru = lruWithDuplicates();
	assert.equal(lru.size, 2);
});

test('.size - accounts for duplicates when the old cache is not full', () => {
	const lru = new QuickLRU({maxSize: 3});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	lru.delete('2');
	lru.set('1', 4);
	assert.equal(lru.size, 2);
});

test('.get() / .peek() / .has() - use the recent value of duplicates', () => {
	const lru = lruWithDuplicates();
	assert.equal(lru.peek('keyDupe'), 2);
	assert.ok(lru.has('keyDupe'));
	assert.equal(lru.get('keyDupe'), 2);
});

test('.expiresIn() - uses the recent expiry of duplicates', () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1, {maxAge: 100});
	lru.set('2', 2);
	lru.set('1', 3, {maxAge: 10_000});
	assert.ok(lru.expiresIn('1') > 1000);
});

test('.entriesAscending() - accounts for duplicates', () => {
	const lru = lruWithDuplicates();
	assert.deepEqual([...lru.entriesAscending()], [['key', 'value'], ['keyDupe', 2]]);
});

test('.entriesDescending() - accounts for duplicates', () => {
	const lru = lruWithDuplicates();
	assert.deepEqual([...lru.entriesDescending()], [['keyDupe', 2], ['key', 'value']]);
});

test('.delete() - removes both values of duplicates', () => {
	const lru = lruWithDuplicates();
	assert.ok(lru.delete('keyDupe'));
	assert.ok(!(lru.has('keyDupe')));
	assert.equal(lru.peek('keyDupe'), undefined);
	assert.equal(lru.size, 1);
	assert.deepEqual([...lru], [['key', 'value']]);
});

test('maxAge: an expired recent value of a duplicate does not bring back the old value', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('1', 3, {maxAge: 10});
	t.mock.timers.tick(20);
	assert.equal(lru.get('1'), undefined);
	assert.ok(!(lru.has('1')));
	assert.equal(lru.size, 1);
	assert.deepEqual([...lru], [['2', 2]]);
});

test('maxAge: an expired old value of a duplicate does not remove the recent value', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const evicted = [];
	const lru = new QuickLRU({
		maxSize: 2,
		onEviction(key, value) {
			evicted.push([key, value]);
		},
	});
	lru.set('1', 1, {maxAge: 10});
	lru.set('2', 2);
	lru.set('1', 3);
	t.mock.timers.tick(20);
	// The iterator follows `entriesAscending()`, like every other `Map` method.
	assert.deepEqual([...lru], [['2', 2], ['1', 3]]);
	assert.deepEqual([...lru.entriesAscending()], [['2', 2], ['1', 3]]);
	assert.deepEqual([...lru.entriesDescending()], [['1', 3], ['2', 2]]);
	assert.ok(lru.has('1'));
	assert.equal(lru.get('1'), 3);
	assert.equal(lru.size, 2);
	assert.deepEqual(evicted, []);
});

test('max size', () => {
	const lru = new QuickLRU({maxSize: 3});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	assert.equal(lru.size, 3);
	lru.set('4', 4);
	assert.equal(lru.size, 3);
});

test('draining the cache by deleting while iterating visits every key once', () => {
	const lru = new QuickLRU({maxSize: 10});
	for (let index = 0; index < 5; index++) {
		lru.set(`key${index}`, index);
	}

	const seen = [];
	for (const [key] of lru) {
		seen.push(key);
		lru.delete(key);
	}

	assert.deepEqual(seen, ['key0', 'key1', 'key2', 'key3', 'key4']);
	assert.deepEqual([...lru], []);
	assert.equal(lru.size, 0);
});

test('`evict()` works on an unbounded cache', () => {
	// `maxSize: Infinity` never rotates, so eviction is the only way anything leaves.
	const lru = new QuickLRU({maxSize: Infinity});
	for (let index = 0; index < 5; index++) {
		lru.set(`key${index}`, index);
	}

	assert.equal(lru.size, 5);
	lru.evict(2);
	assert.deepEqual([...lru.keys()], ['key2', 'key3', 'key4']);
	assert.equal(lru.size, 3);

	// The keep-one rule still applies.
	lru.evict(Infinity);
	assert.deepEqual([...lru.keys()], ['key4']);
	assert.equal(lru.size, 1);
});

test('`size` does not count a key held in both caches twice', () => {
	// The getter adds the two cache sizes together, so it would count a key twice if it did not subtract the keys that are in both. The cap at `maxSize` hides that whenever the two caches are near full, so this needs the shape where they are not: `evict()` empties the recent cache and leaves the old one partly filled.
	const lru = new QuickLRU({maxSize: 10});
	for (let index = 0; index < 10; index++) {
		lru.set(`key${index}`, index);
	}

	lru.evict(8);
	assert.equal(lru.size, 2, 'the two survivors');
	assert.ok(lru.__oldCache.has('key8'), '`key8` is one of them, and only there');

	// Writing a key that is only in the old cache leaves a stale copy there, which must not be counted.
	lru.set('key8', 'updated');
	assert.equal(lru.get('key8'), 'updated');
	// Writing promoted it to the recent cache, so ascending order puts it last.
	assert.deepEqual([...lru.keys()], ['key9', 'key8']);
	assert.equal(lru.size, 2, 'counted once, not twice');
});

test('a key in both the recent and the old cache is counted and visited once', () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	// `1` is now only in the old cache, and setting it again leaves a stale copy there.
	lru.set('1', 3);
	assert.ok(lru.__oldCache.has('1'));
	assert.equal(lru.size, 2);
	assert.equal(lru.get('1'), 3);
	// `2` is now the older of the two, so ascending order is `2` then `1`.
	assert.deepEqual([...lru.keys()], ['2', '1']);
	assert.deepEqual([...lru.entriesDescending()], [['1', 3], ['2', 2]]);
});

test('a rotation does not report the stale old copy of a key that was set again', () => {
	const evicted = [];
	const lru = new QuickLRU({
		maxSize: 2,
		onEviction(key, value) {
			evicted.push([key, value]);
		},
	});
	lru.set('a', 1);
	lru.set('b', 2);
	// `a` is in both caches now, and the old cache copy is stale.
	lru.set('a', 3);
	lru.set('c', 4);
	assert.deepEqual(evicted, [['b', 2]]);
	assert.deepEqual([...lru], [['a', 3], ['c', 4]]);
});

test('a callback read does not report an overwritten old-cache value', () => {
	const evicted = [];
	const lru = new QuickLRU({
		maxSize: 2,
		onEviction(key, value) {
			evicted.push([key, value]);
			if (key === 'b') {
				// This read expires the replacement before the rotation reaches its stale copy.
				lru.has('a');
			}
		},
	});
	lru.set('b', 'B');
	lru.set('a', 'old');
	lru.set('a', 'new', {maxAge: -1});
	lru.set('c', 'C');

	assert.deepEqual(evicted, [['b', 'B'], ['a', 'new']]);
	assert.deepEqual([...lru], [['c', 'C']]);
});

test('`size` stays `min(live items, maxSize)` through a mixed sequence', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	// Walks the relationship between the capped `size` and the items the iterators actually report, across lazy expiry, eviction and resizing.
	const lru = new QuickLRU({maxSize: 4});
	for (let index = 1; index <= 4; index++) {
		lru.set(`live${index}`, index);
	}

	lru.set('perishable1', 1, {maxAge: 20});
	lru.set('perishable2', 2, {maxAge: 20});
	lru.set('live5', 5);
	t.mock.timers.tick(200);

	// Six live items plus two expired ones are stored, and `size` reports the cap.
	assert.equal(lru.size, 4);
	// Expiry is lazy and per item, so the expired ones are still there.
	assert.ok(lru.expiresIn('perishable1') <= 0);
	assert.ok(lru.expiresIn('perishable2') <= 0);

	// Touching one expired item removes only that one.
	assert.equal(lru.peek('perishable1'), undefined);
	assert.ok(!(lru.has('perishable1')));
	assert.equal(lru.expiresIn('perishable2') <= 0, true, 'the other is expired but untouched');
	assert.equal(lru.size, 4);

	// Iterating expires what it walks over, leaving the five live items.
	assert.deepEqual([...lru.keys()], ['live1', 'live2', 'live3', 'live4', 'live5']);
	assert.equal(lru.size, 4, 'still capped at maxSize');

	lru.evict(2);
	const afterEvict = [...lru.keys()];
	assert.equal(afterEvict.length, 3);
	assert.equal(lru.size, 3);

	lru.resize(2);
	assert.deepEqual([...lru.keys()], afterEvict.slice(1));
	assert.equal(lru.size, 2);
});

test('rotating discards the whole old cache at once', () => {
	// The documented trade-off: one write can evict up to `maxSize` items, not just one.
	const evicted = [];
	const lru = new QuickLRU({
		maxSize: 3,
		onEviction(key) {
			evicted.push(key);
		},
	});

	for (const key of ['1', '2', '3', '4', '5', '6']) {
		lru.set(key, key);
	}

	// A strict LRU of size 3 would have dropped only `1` by the last write.
	assert.deepEqual([...lru.keys()], ['4', '5', '6']);
	assert.deepEqual(evicted, ['1', '2', '3']);
});

test('the cache stores at most `2 * maxSize - 1` items', () => {
	// The documented range, so the readme claim stays verifiable.
	for (const maxSize of [1, 2, 3, 5, 10]) {
		const lru = new QuickLRU({maxSize});
		let peak = 0;
		for (let index = 0; index <= 4 * maxSize; index++) {
			lru.set(`key${index}`, index);
			peak = Math.max(peak, [...lru].length);
		}

		assert.equal(peak, (2 * maxSize) - 1, `maxSize: ${maxSize}`);
	}
});

test('`.size` is capped at `maxSize` while more items are stored', () => {
	const lru = new QuickLRU({maxSize: 5});
	for (let index = 1; index <= 9; index++) {
		lru.set(`key${index}`, index);
	}

	// The dual cache holds more than `maxSize` items, so `.size` under-reports.
	assert.equal([...lru].length, 9);
	assert.equal(lru.size, 5);
});

test('.size never reports more than `maxSize`', () => {
	const lru = new QuickLRU({maxSize: 5});

	// The dual cache holds up to `2 * maxSize - 1` items, so more than `maxSize` are stored here.
	for (let index = 1; index <= 9; index++) {
		lru.set(index, index);
	}

	assert.equal(lru.size, 5);

	// `evict()` drops the oldest item where it already lives, so the count is unchanged.
	lru.evict(1);
	assert.equal(lru.size, 5);
	assert.equal(lru.toString(), 'QuickLRU(5/5)');
});

test('.maxSize', () => {
	const maxSize = 100;
	const lru = new QuickLRU({maxSize});
	assert.equal(lru.maxSize, maxSize);
});

test('.maxAge', () => {
	const lru = new QuickLRU({maxSize: 1});
	assert.equal(lru.maxAge, Infinity);
});

test('checks total cache size does not exceed `maxSize`', () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.get('1');
	assert.equal(lru.__oldCache.has('1'), false);
});

test('`onEviction` is not called for a key that is still cached', () => {
	const evicted = [];
	const lru = new QuickLRU({
		maxSize: 2,
		onEviction(key, value) {
			evicted.push([key, value]);
		},
	});

	lru.set('1', 'old');
	lru.set('2', 'b');
	// `1` is now only in the old cache. Setting it again makes it recent, so the stale old copy must not be reported as an eviction.
	lru.set('1', 'new');
	lru.set('3', 'c');

	assert.deepEqual(evicted, [['2', 'b']]);
	assert.equal(lru.get('1'), 'new');
});

test('`onEviction` is called synchronously and its result is ignored', async () => {
	let called = 0;
	let isSettled = false;
	const lru = new QuickLRU({
		maxSize: 1,
		// A `=> void` type accepts an async function, and the readme points at resource cleanup here, so this is easy to write. The callback is called from a synchronous method, so the promise is not awaited.
		async onEviction() {
			called++;
			await Promise.resolve();
			isSettled = true;
		},
	});

	lru.set('a', 1);
	lru.set('b', 2);
	assert.equal(called, 1, 'called once');
	assert.ok(!(isSettled), 'the returned promise was not awaited');

	// The cache is unaffected either way, and the microtask runs on its own.
	assert.equal(lru.get('b'), 2);
	await Promise.resolve();
	assert.ok(isSettled, 'the callback body still completed');
});

test('a throwing `onEviction` does not leave the cache inconsistent', () => {
	let shouldThrow = true;
	const lru = new QuickLRU({
		maxSize: 2,
		onEviction() {
			if (!shouldThrow) {
				return;
			}

			shouldThrow = false;
			throw new Error('eviction failed');
		},
	});

	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);

	// This rotation reports `1` and `2` as evicted, then the callback throws.
	assert.throws(() => {
		lru.set('4', 4);
	}, {message: 'eviction failed'});

	// The reported evictions must match reality.
	assert.deepEqual([...lru.keys()], ['3', '4']);
	assert.equal(lru.size, 2);
});

test('`onEviction` can read the cache without recursing', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const evicted = [];
	const lru = new QuickLRU({
		maxSize: 5,
		maxAge: 10,
		onEviction(key, value) {
			evicted.push([key, value]);
			// The item is already gone, so these must not re-enter the eviction path.
			assert.ok(!(lru.has(key)));
			assert.equal(lru.peek(key), undefined);
			assert.equal(lru.get(key), undefined);
		},
	});

	lru.set('a', 1);
	t.mock.timers.tick(100);

	lru.has('a');

	assert.deepEqual(evicted, [['a', 1]]);
});

test('`onEviction` can read the cache while items expire during iteration', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	let calls = 0;
	const lru = new QuickLRU({
		maxSize: 5,
		maxAge: 10,
		onEviction() {
			calls++;
			// Iterating from inside the callback must not restart the eviction walk.
			assert.deepEqual([...lru.keys()], []);
		},
	});

	lru.set('a', 1);
	t.mock.timers.tick(100);

	assert.deepEqual([...lru.keys()], []);

	// Without this the callback never runs and the rest of the test proves nothing.
	assert.equal(calls, 1);
	assert.equal(lru.size, 0);
});

test('`onEviction` is called after `maxSize` is exceeded', () => {
	const expectedKey = '1';
	const expectedValue = 1;
	let isEvictionCalled = false;
	let actualKey;
	let actualValue;

	const onEviction = (key, value) => {
		actualKey = key;
		actualValue = value;
		isEvictionCalled = true;
	};

	const lru = new QuickLRU({maxSize: 1, onEviction});
	lru.set(expectedKey, expectedValue);
	lru.set('2', 2);
	assert.equal(actualKey, expectedKey);
	assert.equal(actualValue, expectedValue);
	assert.ok(isEvictionCalled);
});

test('set(maxAge): an item can have a custom expiration', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 10});
	lru.set('1', 'test', {maxAge: 100});
	t.mock.timers.tick(200);
	assert.ok(!(lru.has('1')));
});

test('set(maxAge): items without expiration never expire', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 10});
	lru.set('1', 'test', {maxAge: 100});
	lru.set('2', 'boo');
	t.mock.timers.tick(200);
	assert.ok(!(lru.has('1')));
	t.mock.timers.tick(200);
	assert.ok(lru.has('2'));
});

test('set(maxAge): ignores non-numeric maxAge option', () => {
	const lru = new QuickLRU({maxSize: 10});
	lru.set('1', 'test', 'string');
	lru.set('2', 'boo');
	// Neither an ignored third argument nor a missing `maxAge` means the items live forever, so there is nothing to wait for.
	assert.ok(lru.has('1'));
	assert.equal(lru.get('1'), 'test');
	assert.ok(lru.has('2'));
	assert.equal(lru.expiresIn('1'), Infinity);
});

test('an expiry of zero is still an expiry', () => {
	// A per-item `maxAge` of `0` or less is accepted, and this value cancels the clock closely, so the stored expiry is `0`. That is falsy, so a truthiness check read it as "no expiration" while the numeric comparison read it as expired, and the methods disagreed: `get()` returned the value, `has()` said it was gone, and calling `has()` first made the next `get()` return `undefined`.

	// A fresh cache per method, so whichever runs first does not remove the item before the others can see it.
	const fresh = () => {
		const cache = new QuickLRU({maxSize: 5});
		cache.set('a', 1, {maxAge: -Date.now()});
		return cache;
	};

	// It expired the instant it was written, and every method must say so.
	assert.equal(fresh().get('a'), undefined, 'get');
	assert.equal(fresh().peek('a'), undefined, 'peek');
	assert.equal(fresh().has('a'), false, 'has');

	// `size` is a pure read, so it still counts the item until something removes it.
	const untouched = fresh();
	assert.equal(untouched.size, 1, 'size');
	assert.equal(untouched.get('a'), undefined, 'and reading it clears the count');
	assert.equal(untouched.size, 0);

	// Before anything touches it, the expiry is already in the past.
	assert.equal(fresh().expiresIn('a') <= 0, true);
	assert.equal(fresh().get('a'), undefined, 'and reading it does not resurrect it');
});

test('an expiry that is not a number means no expiration', () => {
	const lru = new QuickLRU({maxSize: 5});
	// `maxAge: NaN` is a number, so it does reach `Date.now() + NaN` and stores a `NaN` expiry, which never passes the numeric comparison. A non-numeric `maxAge` never reaches the addition at all and stores no expiry.
	lru.set('a', 1, {maxAge: NaN});
	lru.set('b', 2, {maxAge: '100'});

	assert.equal(lru.expiresIn('a'), Infinity);
	assert.ok(lru.has('a'));
	assert.equal(lru.get('a'), 1);
	// Same for a value that is not a number at all.
	assert.equal(lru.expiresIn('b'), Infinity);
	assert.ok(lru.has('b'));
	assert.equal(lru.get('b'), 2);
});

test('set(maxAge): `NaN` never expires, like a non-numeric value', () => {
	// `NaN` is `typeof 'number'`, so the expiry is computed as `Date.now() + NaN`, and `hasExpiry` treats that as "no expiration" rather than an expired item.
	const lru = new QuickLRU({maxSize: 10});
	lru.set('nan', 'value', {maxAge: NaN});

	assert.ok(lru.has('nan'));
	assert.equal(lru.expiresIn('nan'), Infinity);
});

test('set(maxAge): a value of 0 or less expires the item immediately', () => {
	// Unlike the `maxAge` option, which rejects these, a per-item value is accepted.
	const lru = new QuickLRU({maxSize: 10});
	lru.set('zero', 1, {maxAge: 0});
	lru.set('negative', 2, {maxAge: -100});

	// Counted until the first read, which expires and removes them.
	assert.equal(lru.size, 2);
	assert.equal(lru.get('zero'), undefined);
	assert.ok(!(lru.has('negative')));
	assert.deepEqual([...lru], []);
});

test('set(maxAge): per-item maxAge overrides global maxAge', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 10, maxAge: 2000});
	lru.set('1', 'test', {maxAge: 100});
	lru.set('2', 'boo');
	t.mock.timers.tick(400);
	assert.ok(!(lru.has('1')));
	t.mock.timers.tick(400);
	assert.ok(lru.has('2'));
});

test('set(maxAge): setting the same key refreshes expiration', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 10, maxAge: 100});
	lru.set('1', 'test');
	t.mock.timers.tick(200); // Outlives the 100ms TTL.
	assert.ok(!(lru.has('1')), 'expired');

	lru.set('1', 'test');
	assert.ok(lru.has('1'), 'back after a refresh');
});

test('set(maxAge): is returned by getter', () => {
	const maxAge = 100;
	const lru = new QuickLRU({maxSize: 1, maxAge});
	assert.equal(lru.maxAge, maxAge);
});

test('maxAge: get() removes an expired item', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 10, maxAge: 90});
	lru.set('1', 'test');
	t.mock.timers.tick(200);
	assert.equal(lru.get('1'), undefined);
});

test('maxAge: non-recent items can also expire', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', 'test1');
	lru.set('2', 'test2');
	lru.set('3', 'test4');
	t.mock.timers.tick(200);
	assert.equal(lru.get('1'), undefined);
});

test('maxAge: setting the same key refreshes expiration', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', 'test');
	t.mock.timers.tick(200); // Outlives the 100ms TTL.
	assert.equal(lru.get('1'), undefined, 'expired');

	lru.set('1', 'test2');
	assert.equal(lru.get('1'), 'test2', 'back after a refresh');
});

test('maxAge: setting an item with a local expiration', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', 'test');
	lru.set('2', 'test2', {maxAge: 5000});
	t.mock.timers.tick(200); // Outlives the global TTL, so the override is what keeps it alive.
	assert.ok(lru.has('2'), 'the per-item maxAge overrode the global one');
	assert.ok(!(lru.has('1')), 'the global maxAge still applies to the other item');
});

test('maxAge: empty options object uses global maxAge', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', 'test');
	lru.set('2', 'test2', {});
	t.mock.timers.tick(200);
	assert.ok(!(lru.has('2')));
});

test('maxAge: calls onEviction for expired recent item', {timeout: 1000}, t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const expectedKey = '1';
	const expectedValue = 'test';

	let isEvictionCalled = false;
	let actualKey;
	let actualValue;
	const onEviction = (key, value) => {
		isEvictionCalled = true;
		actualKey = key;
		actualValue = value;
	};

	const lru = new QuickLRU({
		maxSize: 2,
		maxAge: 100,
		onEviction,
	});

	lru.set(expectedKey, expectedValue);

	t.mock.timers.tick(200);

	assert.equal(lru.get('1'), undefined);
	assert.ok(isEvictionCalled);
	assert.equal(actualKey, expectedKey);
	assert.equal(actualValue, expectedValue);
});

test('maxAge: calls onEviction for expired non-recent items', {timeout: 1000}, t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const expectedKeys = ['1', '2'];
	const expectedValues = ['test', 'test2'];

	let isEvictionCalled = false;
	const actualKeys = [];
	const actualValues = [];
	const onEviction = (key, value) => {
		isEvictionCalled = true;
		actualKeys.push(key);
		actualValues.push(value);
	};

	const lru = new QuickLRU({
		maxSize: 2,
		maxAge: 100,
		onEviction,
	});

	lru.set('1', 'test');
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	lru.set('4', 'test4');
	lru.set('5', 'test5');

	t.mock.timers.tick(200);

	assert.equal(lru.get('1'), undefined);
	assert.ok(isEvictionCalled);
	assert.deepEqual(actualKeys, expectedKeys);
	assert.deepEqual(actualValues, expectedValues);
});

test('maxAge: evicts expired items on resize', {timeout: 1000}, t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const expectedKeys = ['1', '2', '3'];
	const expectedValues = ['test', 'test2', 'test3'];

	let isEvictionCalled = false;
	const actualKeys = [];
	const actualValues = [];
	const onEviction = (key, value) => {
		isEvictionCalled = true;
		actualKeys.push(key);
		actualValues.push(value);
	};

	const lru = new QuickLRU({
		maxSize: 3,
		maxAge: 100,
		onEviction,
	});

	lru.set('1', 'test');
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	lru.set('4', 'test4');
	lru.set('5', 'test5');

	lru.resize(2);

	t.mock.timers.tick(200);

	assert.ok(!(lru.has('1')));
	assert.ok(isEvictionCalled);
	assert.deepEqual(actualKeys, expectedKeys);
	assert.deepEqual(actualValues, expectedValues);
});

test('maxAge: peek() returns non-expired items', () => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 1000});
	lru.set('1', 'test');
	// A second TTL, so the item is plainly alive without waiting for it.
	assert.equal(lru.peek('1'), 'test');
	assert.equal(lru.peek('missing'), undefined);
});

test('maxAge: peek() lazily removes expired recent items', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 10, maxAge: 100});
	lru.set('1', 'test');
	t.mock.timers.tick(200);
	assert.equal(lru.peek('1'), undefined);
});

test('maxAge: peek() lazily removes expired non-recent items', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', 'test');
	lru.set('2', 'test');
	lru.set('3', 'test');
	t.mock.timers.tick(200);
	assert.equal(lru.peek('1'), undefined);
});

test('maxAge: non-recent items not expired are valid', () => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 1000});
	lru.set('1', 'test');
	lru.set('2', 'test2');
	lru.set('3', 'test4');
	// `1` is only in the old cache and its TTL is a second away, so no waiting is needed for it to still be valid.
	assert.equal(lru.get('1'), 'test');
});

test('maxAge: has() deletes expired items and returns false', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 4, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test');
	lru.set('3', 'test');
	t.mock.timers.tick(200);
	assert.ok(!(lru.has('1')));
});

test('maxAge: has() returns true when not expired', () => {
	const lru = new QuickLRU({maxSize: 4, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test');
	lru.set('3', 'test');
	assert.ok(lru.has('1'));
});

test('maxAge: has() returns true for undefined values with expiration', () => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test');
	lru.set('3', 'test');
	assert.ok(lru.has('1'));
});

test('maxAge: keys() returns only non-expired keys', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	t.mock.timers.tick(200);
	lru.set('4', 'loco');

	assert.deepEqual([...lru.keys()], ['4']);
});

test('maxAge: keys() returns empty when all items expired', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	t.mock.timers.tick(200);

	assert.deepEqual([...lru.keys()], []);
});

test('maxAge: values() returns empty when all items expired', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	t.mock.timers.tick(200);

	assert.deepEqual([...lru.values()], []);
});

test('maxAge: values() returns only non-expired values', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	t.mock.timers.tick(200);
	lru.set('5', 'loco');

	assert.deepEqual([...lru.values()], ['loco']);
});

test('maxAge: entriesDescending() excludes expired entries', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 10, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	t.mock.timers.tick(200);
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	assert.deepEqual([...lru.entriesDescending()], [['5', 'loco'], ['4', 'coco']]);
});

test('maxAge: entriesDescending() excludes expired entries from old cache', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	t.mock.timers.tick(200);
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	assert.deepEqual([...lru.entriesDescending()], [['5', 'loco'], ['4', 'coco']]);
});

test('maxAge: entriesDescending() returns all non-expired entries in order', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 10, maxAge: 5000});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	t.mock.timers.tick(200);
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	assert.deepEqual([...lru.entriesDescending()], [['5', 'loco'], ['4', 'coco'], ['3', 'test3'], ['2', 'test2'], ['1', undefined]]);
});

test('maxAge: entriesAscending() excludes expired entries', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 5, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	t.mock.timers.tick(200);
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	assert.deepEqual([...lru.entriesAscending()], [['4', 'coco'], ['5', 'loco']]);
});

test('maxAge: entriesAscending() excludes expired non-recent entries', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 3, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	t.mock.timers.tick(200);
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	assert.deepEqual([...lru.entriesAscending()], [['4', 'coco'], ['5', 'loco']]);
});

test('maxAge: entriesAscending() returns only non-expired entries', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 10, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	t.mock.timers.tick(200);
	lru.set('3', 'test3');
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	assert.deepEqual([...lru.entriesAscending()], [['3', 'test3'], ['4', 'coco'], ['5', 'loco']]);
});

test('maxAge: entries() returns only non-expired entries', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 10, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	t.mock.timers.tick(200);
	lru.set('3', 'test3');
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	assert.deepEqual([...lru.entries()], [['3', 'test3'], ['4', 'coco'], ['5', 'loco']]);
});

test('maxAge: forEach() excludes expired entries', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 5, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	t.mock.timers.tick(200);
	lru.set('4', 'coco');
	lru.set('5', 'loco');
	const entries = Array.from(lru.entries(), ([key, value]) => [key, value]);

	assert.deepEqual(entries, [['4', 'coco'], ['5', 'loco']]);
});

test('maxAge: iterator excludes expired items', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('key', 'value');
	lru.set('key3', 1);
	t.mock.timers.tick(200);
	lru.set('key4', 2);

	assert.deepEqual([...lru], [['key4', 2]]);
});

test('maxAge: iterator excludes expired items from old cache', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 1, maxAge: 100});
	lru.set('keyunique', 'value');
	lru.set('key3unique', 1);
	lru.set('key4unique', 2);
	t.mock.timers.tick(200);

	assert.deepEqual([...lru], []);
});

test('entriesAscending enumerates cache items oldest-first', () => {
	const lru = new QuickLRU({maxSize: 3});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	lru.set('3', 7);
	lru.set('2', 8);
	assert.deepEqual([...lru.entriesAscending()], [['1', 1], ['3', 7], ['2', 8]]);
});

test('entriesDescending enumerates cache items newest-first', () => {
	const lru = new QuickLRU({maxSize: 3});
	lru.set('t', 1);
	lru.set('q', 2);
	lru.set('a', 8);
	lru.set('t', 4);
	lru.set('v', 3);
	assert.deepEqual([...lru.entriesDescending()], [['v', 3], ['t', 4], ['a', 8], ['q', 2]]);
});

test('entries enumerates cache items oldest-first', () => {
	const lru = new QuickLRU({maxSize: 3});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	lru.set('3', 7);
	lru.set('2', 8);
	assert.deepEqual([...lru.entries()], [['1', 1], ['3', 7], ['2', 8]]);
});

// `forEach` is `Map.prototype.forEach`, so it is not array iteration.
test('forEach calls the cb function for each cache item oldest-first', () => {
	const lru = new QuickLRU({maxSize: 3});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	lru.set('3', 7);
	lru.set('2', 8);
	const entries = [];

	lru.forEach((value, key) => {
		entries.push([key, value]);
	});

	assert.deepEqual(entries, [['1', 1], ['3', 7], ['2', 8]]);
});

test('forEach passes the instance and an explicit `this` argument', () => {
	const lru = new QuickLRU({maxSize: 3});
	lru.set('1', 1);
	const contexts = [];

	lru.forEach(function (value, key, map) {
		contexts.push([this === lru, map === lru]);
	});

	const receiver = {name: 'receiver'};
	lru.forEach(function () {
		contexts.push(this === receiver);
	}, receiver);

	assert.deepEqual(contexts, [[true, true], true]);
});

test('forEach returns undefined like `Map`', () => {
	const lru = new QuickLRU({maxSize: 3});
	lru.set('1', 1);
	assert.equal(lru.forEach(() => {}), undefined);
});

test('resize removes older items', () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	lru.resize(1);
	assert.equal(lru.peek('1'), undefined);
	assert.equal(lru.peek('3'), 3);
	lru.set('3', 4);
	assert.equal(lru.peek('3'), 4);
	lru.set('4', 5);
	assert.equal(lru.peek('4'), 5);
	assert.equal(lru.peek('2'), undefined);
});

test('resize triggers evictions', () => {
	const calls = [];
	const onEviction = (...args) => {
		calls.push(args);
	};

	const lru = new QuickLRU({maxSize: 2, onEviction});

	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	lru.resize(1);
	assert.ok(calls.length > 0);
	assert.ok(calls.some(([key]) => key === '1'));
});

test('resize increases capacity', () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.resize(3);
	lru.set('3', 3);
	lru.set('4', 4);
	lru.set('5', 5);
	assert.deepEqual([...lru.entriesAscending()], [['1', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5]]);
});

test('resize does not conflict with the same number of items', () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	lru.resize(3);
	lru.set('4', 4);
	lru.set('5', 5);
	assert.deepEqual([...lru.entriesAscending()], [['1', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5]]);
});

test('resize checks parameter bounds', () => {
	const lru = new QuickLRU({maxSize: 2});
	assert.throws(() => {
		lru.resize(-1);
	}, {message: /maxSize/v});
});

test('resize throws on a non-number', () => {
	// The comparison coerces, so these were accepted and leaked back out of the `maxSize` getter.
	for (const newSize of ['5', true, [5]]) {
		const lru = new QuickLRU({maxSize: 2});
		assert.throws(() => {
			lru.resize(newSize);
		}, {message: /maxSize/v}, `resize(${String(newSize)})`);
		assert.equal(lru.maxSize, 2);
	}
});

test('resize throws on a negative, `NaN` or zero value', () => {
	for (const newSize of [0, -1, NaN, -0.5]) {
		const lru = new QuickLRU({maxSize: 2});
		assert.throws(() => {
			lru.resize(newSize);
		}, {message: /maxSize/v}, `resize(${newSize})`);
		assert.equal(lru.maxSize, 2);
	}
});

test('function value', () => {
	const lru = new QuickLRU({maxSize: 1});
	let isCalled = false;

	lru.set('fn', () => {
		isCalled = true;
	});

	lru.get('fn')();
	assert.ok(isCalled);
});

test('`util.inspect` prints the same as `toString()`', () => {
	const lru = new QuickLRU({maxSize: 5});
	lru.set('a', 1);
	lru.set('b', 2);

	assert.equal(inspect(lru), 'QuickLRU(2/5)');
	assert.equal(inspect(lru, {depth: 0}), 'QuickLRU(2/5)');
	assert.equal(lru[Symbol.for('nodejs.util.inspect.custom')](), lru.toString());
});

test('`util.inspect` survives a circular value', () => {
	const first = {name: 'first'};
	const second = {name: 'second'};
	first.ref = second;
	second.ref = first;

	const lru = new QuickLRU({maxSize: 2});
	lru.set('first', first);
	lru.set('second', second);

	// The custom hook returns a string, so the value is never walked.
	assert.equal(inspect(lru), 'QuickLRU(2/2)');
	inspect(lru, {depth: 0});
});

test('[Symbol.toStringTag] output', () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	assert.equal(lru[Symbol.toStringTag], 'QuickLRU');
});

test('toString() works as expected', () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	assert.equal(lru.toString(), 'QuickLRU(2/2)');
});

test('non-primitive key', () => {
	const lru = new QuickLRU({maxSize: 99});
	const key = ['foo', 'bar'];
	const isValue = true;
	lru.set(key, isValue);
	assert.ok(lru.has(key));
	assert.equal(lru.get(key), isValue);
});

test('handles circular references gracefully', () => {
	const lru = new QuickLRU({maxSize: 2});

	const object1 = {name: 'object1'};
	const object2 = {name: 'object2'};
	object1.ref = object2;
	object2.ref = object1;

	lru.set('key1', object1);
	lru.set('key2', object2);

	String(lru);

	assert.equal(lru.toString(), 'QuickLRU(2/2)');
	assert.equal(Object.prototype.toString.call(lru), '[object QuickLRU]');
});

test('.evict() removes least recently used items', () => {
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);
	lru.set('d', 4);
	lru.set('e', 5);

	// Evict 2 least recently used items
	lru.evict(2);

	assert.equal(lru.size, 3);
	assert.ok(!(lru.has('a')));
	assert.ok(!(lru.has('b')));
	assert.ok(lru.has('c'));
	assert.ok(lru.has('d'));
	assert.ok(lru.has('e'));
});

test('.evict() with accessed items changes order', () => {
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);
	lru.set('d', 4);
	lru.set('e', 5);

	// Access 'a' and 'b' to make them recently used
	lru.get('a');
	lru.get('b');

	// Should evict 'c' and 'd' (now the oldest)
	lru.evict(2);

	assert.equal(lru.size, 3);
	assert.ok(lru.has('a'));
	assert.ok(lru.has('b'));
	assert.ok(!(lru.has('c')));
	assert.ok(!(lru.has('d')));
	assert.ok(lru.has('e'));
});

test('.evict() keeps at least one item', () => {
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);

	// Try to evict all items (should keep the most recent)
	lru.evict(10);

	assert.equal(lru.size, 1);
	assert.ok(lru.has('c'));
});

test('.evict() triggers onEviction callback', () => {
	const evicted = [];
	const lru = new QuickLRU({
		maxSize: 5,
		onEviction(key, value) {
			evicted.push({key, value});
		},
	});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);

	lru.evict(2);

	assert.equal(evicted.length, 2);
	assert.deepEqual(evicted[0], {key: 'a', value: 1});
	assert.deepEqual(evicted[1], {key: 'b', value: 2});
});

test('.evict() stays bounded across `maxSize` values', () => {
	// Unique keys, and evicting more often than the recent cache fills. The keys must outnumber `maxSize`, otherwise there is nothing for the old cache to accumulate.
	for (const maxSize of [3, 5, 10]) {
		const lru = new QuickLRU({maxSize});
		for (let index = 0; index < 2000; index++) {
			lru.set(`key${index}`, index);
			if (index % 2 === 0) {
				lru.evict(1);
			}
		}

		assert.ok([...lru].length <= (2 * maxSize) - 1, `maxSize ${maxSize}: stored ${[...lru].length}`);
	}
});

test('.evict() stays bounded while `maxSize` is resized', () => {
	const lru = new QuickLRU({maxSize: 5});
	for (let index = 0; index < 2000; index++) {
		lru.set(`key${index}`, index);
		if (index % 97 === 0) {
			lru.resize(1 + (index % 12));
		}

		if (index % 2 === 0) {
			lru.evict(1);
		}
	}

	assert.ok([...lru].length <= (2 * lru.maxSize) - 1, `stored ${[...lru].length}, maxSize ${lru.maxSize}`);
});

test('.evict() does not stop the cache from staying bounded', () => {
	const lru = new QuickLRU({maxSize: 10});

	// Evicting more often than the recent cache fills must not defer the rotation that discards the old cache, or the old cache grows without limit.
	for (let index = 0; index < 1000; index++) {
		lru.set(`key${index}`, index);
		if (index % 7 === 0) {
			lru.evict(1);
		}
	}

	assert.ok([...lru].length <= (2 * lru.maxSize) - 1, `stored ${[...lru].length}`);
});

test('.evict() default count is 1', () => {
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);

	// Evict without parameter (should default to 1)
	lru.evict();

	assert.equal(lru.size, 2);
	assert.ok(!(lru.has('a')));
	assert.ok(lru.has('b'));
	assert.ok(lru.has('c'));
});

test('.evict() accepts a `BigInt` count', () => {
	// `Math.trunc` cannot convert a `BigInt`, so this only works because the count is coerced with `Number()` first.
	const lru = new QuickLRU({maxSize: 20});
	for (let index = 0; index < 15; index++) {
		lru.set(`key${index}`, index);
	}

	lru.evict(10n);
	assert.equal([...lru].length, 5);
	assert.equal(lru.size, 5);
	assert.deepEqual([...lru.keys()], ['key10', 'key11', 'key12', 'key13', 'key14']);
});

test('.evict() with a non-numeric count does not expire anything', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	// Coerced to `NaN`, which is not a usable count, so the call returns before the walk.
	const evicted = [];
	const lru = new QuickLRU({
		maxSize: 5,
		maxAge: 20,
		onEviction(key) {
			evicted.push(key);
		},
	});
	lru.set('a', 1);
	lru.set('b', 2);
	t.mock.timers.tick(100);

	for (const count of ['abc', {}, [2, 3], NaN]) {
		lru.evict(count);
	}

	assert.deepEqual(evicted, []);
	assert.equal(lru.size, 2);
});

test('.evict() with a negative count does not expire anything', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	// The size check in the sibling test cannot see this: without the guard `evict()` still walks the cache, which expires every item it passes.
	const evicted = [];
	const lru = new QuickLRU({
		maxSize: 5,
		maxAge: 20,
		onEviction(key) {
			evicted.push(key);
		},
	});
	lru.set('a', 1);
	lru.set('b', 2);
	t.mock.timers.tick(100);

	lru.evict(-5);
	assert.deepEqual(evicted, [], 'no eviction, so no notification');
	assert.equal(lru.size, 2, 'still counted');
	assert.equal(lru.expiresIn('a') <= 0, true, 'still expired, but untouched');
});

test('.evict() with zero or negative count does nothing', () => {
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1);
	lru.set('b', 2);

	const initialSize = lru.size;

	lru.evict(0);
	assert.equal(lru.size, initialSize);

	lru.evict(-5);
	assert.equal(lru.size, initialSize);
});

test('.evict() on empty cache does nothing', () => {
	const lru = new QuickLRU({maxSize: 5});

	lru.evict(5);

	assert.equal(lru.size, 0);
});

test('.evict() respects maxSize after eviction', () => {
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);
	lru.set('d', 4);
	lru.set('e', 5);

	// Evict 2 items
	lru.evict(2);
	assert.equal(lru.size, 3);

	// Can still add up to maxSize
	lru.set('f', 6);
	lru.set('g', 7);
	assert.equal(lru.size, 5);

	// Adding more triggers normal LRU eviction
	lru.set('h', 8);
	lru.set('i', 9);
	assert.equal(lru.size, 5);
});

test('.evict() coerces its count', () => {
	// The count is declared as a number, but `evict()` runs it through `Number()` so anything convertible is usable. The tests above cover the counts that are *not* usable; this is the other half.
	for (const [count, evicted] of [
		[NaN, 0],
		[false, 0],
		[true, 1],
		['1', 1],
		['  2  ', 2],
		[undefined, 1], // The default.
		[[1], 1],
		[{valueOf: () => 1}, 1],
		[Number.MAX_SAFE_INTEGER, 4], // Clamped, so the last item stays.
	]) {
		// A fresh cache per case, so the keep-one rule cannot swallow the ones after it.
		const lru = new QuickLRU({maxSize: 5});
		for (const key of ['a', 'b', 'c', 'd', 'e']) {
			lru.set(key, key);
		}

		lru.evict(count);
		assert.deepEqual([...lru.keys()], ['a', 'b', 'c', 'd', 'e'].slice(evicted), `evict(${String(count)})`);
	}
});

test('.evict() keeps at least one item with expired entries', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1, {maxAge: 1}); // Will expire
	lru.set('b', 2, {maxAge: 1}); // Will expire
	lru.set('c', 3); // Will not expire

	// Wait for expiration
	t.mock.timers.tick(10);

	// Try to evict everything - should keep the one live item
	lru.evict(Infinity);

	assert.equal(lru.size, 1);
	assert.ok(!(lru.has('a'))); // Expired
	assert.ok(!(lru.has('b'))); // Expired
	assert.ok(lru.has('c')); // Only live item left
});

test('.evict() handles all items expired gracefully', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1, {maxAge: 1}); // Will expire
	lru.set('b', 2, {maxAge: 1}); // Will expire
	lru.set('c', 3, {maxAge: 1}); // Will expire

	// Wait for all to expire
	t.mock.timers.tick(10);

	// When all items are expired, evict should be a no-op
	lru.evict(1);

	assert.equal(lru.size, 0);
});

test('.evict() with mixed expiry and access patterns', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 5});

	lru.set('fast1', 1, {maxAge: 5}); // Expires quickly
	lru.set('slow1', 2, {maxAge: 1000}); // Expires slowly
	lru.set('fast2', 3, {maxAge: 5}); // Expires quickly
	lru.set('slow2', 4, {maxAge: 1000}); // Expires slowly

	// Wait for fast items to expire
	t.mock.timers.tick(10);

	// Access remaining items to change order
	lru.get('slow1');
	lru.get('slow2');

	// Should evict the oldest remaining live item
	lru.evict(1);

	assert.equal(lru.size, 1);
	assert.ok(!(lru.has('fast1'))); // Expired
	assert.ok(!(lru.has('fast2'))); // Expired
	assert.ok(!(lru.has('slow1'))); // Evicted (was oldest live)
	assert.ok(lru.has('slow2')); // Remaining
});

test('.evict() works with complex object values', () => {
	const evicted = [];
	const lru = new QuickLRU({
		maxSize: 4,
		onEviction(key, value) {
			evicted.push({key, value});
		},
	});

	const object1 = {data: 'test1', nested: {value: 1}};
	const object2 = {data: 'test2', nested: {value: 2}};
	const array1 = [1, 2, {nested: true}];
	const array2 = [4, 5, {nested: false}];

	lru.set('obj1', object1);
	lru.set('obj2', object2);
	lru.set('arr1', array1);
	lru.set('arr2', array2);

	lru.evict(2);

	assert.equal(lru.size, 2);
	assert.equal(evicted.length, 2);
	assert.deepEqual(evicted[0], {key: 'obj1', value: object1});
	assert.deepEqual(evicted[1], {key: 'obj2', value: object2});
	assert.ok(lru.has('arr1'));
	assert.ok(lru.has('arr2'));
});

test('.evict() with WeakMap/WeakSet values', () => {
	const lru = new QuickLRU({maxSize: 3});

	const weakMap = new WeakMap();
	const weakSet = new WeakSet();
	const object = {};

	lru.set('weakmap', weakMap);
	lru.set('weakset', weakSet);
	lru.set('object', object);

	lru.evict(1);

	assert.equal(lru.size, 2);
	assert.ok(!(lru.has('weakmap')));
	assert.ok(lru.has('weakset'));
	assert.ok(lru.has('object'));
});

test('.evict() maintains cache integrity after multiple operations', () => {
	const lru = new QuickLRU({maxSize: 10});

	// Fill cache
	for (let i = 0; i < 8; i++) {
		lru.set(i, i);
	}

	// Mix of operations
	lru.delete(3);
	lru.get(1);
	lru.set(9, 9);
	lru.peek(5);
	lru.evict(3);

	// Verify cache is still functional
	assert.ok(lru.size > 0);

	// Test all methods still work
	lru.set('new', 'value');
	assert.ok(lru.has('new'));
	assert.equal(lru.get('new'), 'value');

	const keys = [...lru.keys()];
	const values = [...lru.values()];
	const entries = [...lru.entries()];

	assert.equal(keys.length, lru.size);
	assert.equal(values.length, lru.size);
	assert.equal(entries.length, lru.size);
});

test('.evict() with maxSize of 1', () => {
	const lru = new QuickLRU({maxSize: 1});

	lru.set('only', 'item');
	assert.equal(lru.size, 1);

	// Should keep the one item
	lru.evict(1);
	assert.equal(lru.size, 1);
	assert.ok(lru.has('only'));

	// Evict 0 should be no-op
	lru.evict(0);
	assert.equal(lru.size, 1);
	assert.ok(lru.has('only'));

	// Even large numbers should keep the one item
	lru.evict(999_999);
	assert.equal(lru.size, 1);
	assert.ok(lru.has('only'));
});

test('.evict() during iteration maintains stability', () => {
	const lru = new QuickLRU({maxSize: 5});

	for (let i = 0; i < 5; i++) {
		lru.set(i, i);
	}

	const keys = [];
	let iterationCount = 0;

	for (const [key] of lru) {
		keys.push(key);
		if (iterationCount === 2) {
			// Evict during iteration
			lru.evict(2);
		}

		iterationCount++;
		// Safety check to prevent infinite loop
		if (iterationCount > 10) {
			break;
		}
	}

	// Should have completed iteration
	assert.equal(keys.length, 5);
	assert.equal(lru.size, 3);
});

test('.evict() rapid successive calls', () => {
	const evicted = [];
	const lru = new QuickLRU({
		maxSize: 10,
		onEviction(key, value) {
			evicted.push({key, value});
		},
	});

	for (let i = 0; i < 10; i++) {
		lru.set(i, i);
	}

	// Multiple rapid evictions
	lru.evict(1);
	lru.evict(1);
	lru.evict(1);
	lru.evict(2);

	assert.equal(lru.size, 5);
	assert.equal(evicted.length, 5);

	// Verify eviction order (should be 0, 1, 2, 3, 4)
	for (let i = 0; i < 5; i++) {
		assert.equal(evicted[i].key, i);
		assert.equal(evicted[i].value, i);
	}
});

test('.evict() with circular references', () => {
	const lru = new QuickLRU({maxSize: 3});

	const circular1 = {name: 'obj1'};
	circular1.self = circular1;

	const circular2 = {name: 'obj2', ref: circular1};
	circular1.ref = circular2;

	lru.set('circular1', circular1);
	lru.set('circular2', circular2);
	lru.set('normal', 'value');

	// Should handle circular references without issues
	lru.evict(1);

	assert.equal(lru.size, 2);
});

test('.evict() with symbols as keys', () => {
	const lru = new QuickLRU({maxSize: 4});

	const sym1 = Symbol('first');
	const sym2 = Symbol('second');
	const sym3 = Symbol('third');
	const sym4 = Symbol('fourth');

	lru.set(sym1, 'value1');
	lru.set(sym2, 'value2');
	lru.set(sym3, 'value3');
	lru.set(sym4, 'value4');

	lru.evict(2);

	assert.equal(lru.size, 2);
	assert.ok(!(lru.has(sym1)));
	assert.ok(!(lru.has(sym2)));
	assert.ok(lru.has(sym3));
	assert.ok(lru.has(sym4));
});

test('.evict() interaction with resize method', () => {
	const evicted = [];
	const lru = new QuickLRU({
		maxSize: 10,
		onEviction(key, value) {
			evicted.push({key, value});
		},
	});

	for (let i = 0; i < 10; i++) {
		lru.set(i, i);
	}

	// First resize down
	lru.resize(6);
	assert.equal(lru.size, 6);
	assert.equal(evicted.length, 4);

	// Then evict more
	lru.evict(3);
	assert.equal(lru.size, 3);
	assert.equal(evicted.length, 7);

	// Resize back up
	lru.resize(8);
	assert.equal(lru.maxSize, 8);
	assert.equal(lru.size, 3);

	// Add more items
	lru.set('new1', 'val1');
	lru.set('new2', 'val2');
	assert.equal(lru.size, 5);
});

test('.evict() with custom object toString methods', () => {
	const lru = new QuickLRU({maxSize: 3});

	const customObject = {
		value: 42,
		toString() {
			return 'CustomStringRepresentation';
		},
	};

	const anotherObject = {
		data: 'test',
		toString() {
			throw new Error('toString should not be called during eviction');
		},
	};

	lru.set('custom', customObject);
	lru.set('another', anotherObject);
	lru.set('normal', 'normalValue');

	// Should not call toString during eviction
	lru.evict(1);

	assert.equal(lru.size, 2);
});

test('.evict() stress test with many items', () => {
	const lru = new QuickLRU({maxSize: 1000});

	// Fill with many items
	for (let i = 0; i < 1000; i++) {
		lru.set(i, `value${i}`);
	}

	assert.equal(lru.size, 1000);

	// Evict large batch
	lru.evict(500);

	assert.equal(lru.size, 500);

	// Verify remaining items are the most recent
	for (let i = 500; i < 1000; i++) {
		assert.ok(lru.has(i));
	}

	for (let i = 0; i < 500; i++) {
		assert.ok(!(lru.has(i)));
	}
});

test('.evict() with alternating get/set/evict operations', () => {
	const lru = new QuickLRU({maxSize: 5});

	// Complex sequence of operations
	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);

	lru.get('a'); // Make 'a' recent (but still moves to recent cache)
	lru.evict(1); // Should evict oldest, which is 'a' (the get moved it but it's still oldest in the recent cache)

	assert.ok(!(lru.has('a')));
	assert.ok(lru.has('b'));
	assert.ok(lru.has('c'));

	lru.set('d', 4);
	lru.set('e', 5);
	lru.peek('c'); // Peek doesn't change order
	lru.evict(2); // Should evict 'b' and 'c' (oldest)

	assert.ok(!(lru.has('b')));
	assert.ok(!(lru.has('c')));
	assert.ok(lru.has('d'));
	assert.ok(lru.has('e'));
});

test('.evict() with fractional and edge numeric values', () => {
	const lru = new QuickLRU({maxSize: 5});

	for (let i = 0; i < 5; i++) {
		lru.set(i, i);
	}

	// Fractional values
	lru.evict(2.7); // Should truncate to 2
	assert.equal(lru.size, 3);

	lru.set(10, 10);
	lru.set(11, 11);

	// Negative infinity
	lru.evict(-Infinity);
	assert.equal(lru.size, 5); // Should be no-op

	// Very small positive number
	lru.evict(0.1); // Should truncate to 0, no-op
	assert.equal(lru.size, 5);

	// Scientific notation
	lru.evict(2e2); // 200, should evict all but one
	assert.equal(lru.size, 1);
});

test('.evict() callback execution order and state', () => {
	const events = [];
	const lru = new QuickLRU({
		maxSize: 5,
		onEviction(key, value) {
			// Record the state when callback is called
			events.push({
				type: 'eviction',
				key,
				value,
				cacheSize: lru.size, // The cache is rebuilt before the callback runs
				cacheHasKey: lru.has(key), // The item is already gone
			});
		},
	});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);

	lru.evict(2);

	// The cache is rebuilt before the callback runs, so the item is already gone.
	assert.equal(events.length, 2);
	assert.deepEqual(events[0], {
		type: 'eviction',
		key: 'a',
		value: 1,
		cacheSize: 1, // Size after eviction
		cacheHasKey: false, // Item already removed during callback
	});
	assert.deepEqual(events[1], {
		type: 'eviction',
		key: 'b',
		value: 2,
		cacheSize: 1,
		cacheHasKey: false,
	});

	// After eviction, items should be gone
	assert.ok(!(lru.has('a')));
	assert.ok(!(lru.has('b')));
	assert.ok(lru.has('c'));
});

test('`evict()` reports the value it removed, not the one the walk captured', () => {
	// The callback fires for items that expire while `evict()` is collecting, so it can replace a value that is about to be dropped. Reporting the captured one would hand the caller a value other than the one it lost, which for an object URL means revoking the wrong one.
	const seen = [];
	const lru = new QuickLRU({
		maxSize: 10,
		onEviction(key, value) {
			seen.push([key, value]);
			if (key === 'expired') {
				lru.set('a', 100);
			}
		},
	});
	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('expired', 0, {maxAge: -1});

	lru.evict(2);

	assert.deepEqual(seen, [['expired', 0], ['a', 100]]);
	assert.ok(!(lru.has('a')));
	assert.ok(lru.has('b'));
});

test('`evict()` drops by the recency order the walk started with', () => {
	// Promoting a key from the callback is a write, and `evict()` has collected the whole order by the time the callback runs, so it drops the key that was oldest when the walk began rather than the one that is oldest afterwards. Documented, and pinned here so that changing it is a deliberate decision.
	const lru = new QuickLRU({
		maxSize: 4,
		onEviction() {
			lru.get('a');
		},
	});
	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);
	lru.set('d', 4);
	lru.set('e', 5); // Rotates, so `a` to `d` become the old cache.
	lru.delete('d');
	lru.set('expired', 0, {maxAge: -1}); // Reported, which is what promotes `a`.

	lru.evict(1);

	// `a` is the most recently used item by then, and `b` the oldest.
	assert.deepEqual([...lru.keys()], ['b', 'c', 'e']);
});

test('`resize()` keeps a key the callback promoted out of the old cache', () => {
	// The walk snapshots both key lists, so a key promoted while it runs is in neither of them as it now stands. Skipping it destroyed it: `resize()` rebuilds both caches from what the walk collected, so the item was gone with no `onEviction` to say so.
	const reported = [];
	const lru = new QuickLRU({
		maxSize: 3,
		onEviction(key) {
			reported.push(key);
			if (key === 'a') {
				lru.get('b');
			}
		},
	});
	lru.set('a', 'A', {maxAge: -1});
	lru.set('b', 'B');
	lru.set('c', 'C');
	lru.set('d', 'D');

	lru.resize(3);

	assert.ok(lru.has('b'), 'the promoted key survives a resize that keeps everything');
	assert.deepEqual([...lru.keys()], ['b', 'c', 'd']);
	assert.deepEqual(reported, ['a']);
});

test('iteration visits an old-cache key that is overwritten mid-walk', () => {
	const lru = new QuickLRU({maxSize: 3});
	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);
	lru.set('d', 4); // Rotating, so `a` to `c` are in the old cache.

	const seen = [];
	for (const [key, value] of lru) {
		seen.push([key, value]);
		if (key === 'a') {
			// Mutating during iteration is what this test is about.
			// eslint-disable-next-line unicorn/no-loop-iterable-mutation
			lru.set('b', 99);
		}
	}

	// The documented rule is that an overwritten key is still visited, carrying its new value. That held for a key in the recent cache and silently skipped an old one.
	assert.deepEqual(seen, [['a', 1], ['b', 99], ['c', 3], ['d', 4]]);
});

test('a rotation reports the expired items in the old cache', () => {
	// An operation on another key is documented to leave an expired item alone. Rotating is the exception: it discards the old cache whole, expired items included, so a write to a different key is what finally reports them.
	const evicted = [];
	const lru = new QuickLRU({
		maxSize: 2,
		onEviction(key, value) {
			evicted.push([key, value]);
		},
	});

	lru.set('a', 1, {maxAge: -1});
	lru.set('b', 2, {maxAge: -1});
	assert.deepEqual(evicted, [], 'the first rotation only drops an empty old cache');

	// These two writes rotate again, discarding `a` and `b` without anything reading them.
	lru.set('c', 3);
	lru.set('d', 4);

	assert.deepEqual(evicted, [['a', 1], ['b', 2]]);
	assert.ok(!(lru.has('a')));
	assert.ok(!(lru.has('b')));
	assert.deepEqual([...lru.keys()], ['c', 'd']);
});

test('`set()` of an expired key replaces it without reporting it', () => {
	// `set()` never reports an overwrite, and an expired item is overwritten like any other, so its value is dropped with no `onEviction` to act on it.
	const evicted = [];
	const lru = new QuickLRU({
		maxSize: 5,
		onEviction(key, value) {
			evicted.push([key, value]);
		},
	});

	lru.set('a', 'old', {maxAge: -1});
	lru.set('a', 'new');

	assert.deepEqual(evicted, [], 'the replaced value was never reported');
	assert.equal(lru.get('a'), 'new');
	assert.equal(lru.size, 1);
});

test('`onEviction` may read, evict and resize the cache', () => {
	// Each of these rebuilds or re-reads the cache from inside the callback and must still leave it consistent.
	const seen = [];
	const observed = [];
	const lru = new QuickLRU({
		maxSize: 5,
		onEviction(key) {
			seen.push(key);
			// The item is already gone, so these are all reads of a consistent cache.
			observed.push([lru.get(key), lru.has(key), lru.peek(key), lru.size, [...lru.keys()].length]);
			lru.evict(1);
			lru.resize(5);
		},
	});
	for (let index = 1; index <= 5; index++) {
		lru.set(String(index), index);
	}

	lru.set('x', 0);
	lru.set('y', 0);
	lru.evict(1);

	// The cache is still coherent: every key it reports is really there.
	assert.ok(seen.length > 0, 'the callback ran');
	assert.ok(observed.every(([value, has, peeked, size, keyCount]) => value === undefined && !has && peeked === undefined && size <= lru.maxSize && keyCount >= 0), 'every read saw a consistent cache');
	for (const [key, value] of lru) {
		assert.ok(lru.has(key));
		assert.equal(lru.get(key), value);
	}

	assert.ok(lru.size > 0, 'evict() keeps at least one item');
	assert.equal(lru.__oldCache.has('1'), false);
});

test('`evict()` keeps writes made from `onEviction`', () => {
	// The caches are rebuilt before the callback runs, so a write from the callback is not wiped out by the rebuild.
	const lru = new QuickLRU({
		maxSize: 4,
		onEviction() {
			lru.set('from-callback', 1);
		},
	});
	lru.set('a', 'A');
	lru.set('b', 'B');
	lru.set('c', 'C');
	lru.set('d', 'D');

	lru.evict(1);
	assert.ok(lru.has('from-callback'));
	assert.deepEqual([...lru.keys()], ['b', 'c', 'd', 'from-callback']);
});

test('`resize()` keeps writes made from `onEviction`', () => {
	const lru = new QuickLRU({
		maxSize: 4,
		onEviction() {
			lru.set('from-callback', 1);
		},
	});
	lru.set('a', 'A');
	lru.set('b', 'B');
	lru.set('c', 'C');
	lru.set('d', 'D');

	lru.resize(2);
	assert.ok(lru.has('from-callback'));
	assert.deepEqual([...lru.keys()], ['c', 'd', 'from-callback']);
});

test('a throwing `onEviction` does not undo `evict()` or report it twice', () => {
	const evicted = [];
	let isArmed = true;
	const lru = new QuickLRU({
		maxSize: 4,
		onEviction(key, value) {
			evicted.push([key, value]);
			if (!isArmed) {
				return;
			}

			isArmed = false;
			throw new Error('eviction failed');
		},
	});
	lru.set('a', 'A');
	lru.set('b', 'B');
	lru.set('c', 'C');
	lru.set('d', 'D');

	assert.throws(() => {
		lru.evict(2);
	}, {message: 'eviction failed'});

	// The eviction completed, so nothing is reported a second time. The throw stopped the remaining notifications, so `b` is gone but was not reported.
	assert.deepEqual([...lru.keys()], ['c', 'd']);
	assert.deepEqual(evicted, [['a', 'A']]);

	lru.evict(1);
	assert.deepEqual([...lru.keys()], ['d']);
	assert.deepEqual(evicted, [['a', 'A'], ['c', 'C']]);
});

test('a throwing `onEviction` does not undo `resize()`', () => {
	const lru = new QuickLRU({
		maxSize: 4,
		onEviction() {
			throw new Error('eviction failed');
		},
	});
	lru.set('a', 'A');
	lru.set('b', 'B');
	lru.set('c', 'C');
	lru.set('d', 'D');

	assert.throws(() => {
		lru.resize(2);
	}, {message: 'eviction failed'});

	assert.equal(lru.maxSize, 2);
	assert.deepEqual([...lru.keys()], ['c', 'd']);
});

test('.evict() interaction with all iterator methods', () => {
	const lru = new QuickLRU({maxSize: 6});

	for (let i = 0; i < 6; i++) {
		lru.set(i, `value${i}`);
	}

	// Test with keys()
	const keysBeforeEvict = [...lru.keys()];
	lru.evict(2);
	const keysAfterEvict = [...lru.keys()];

	assert.equal(keysBeforeEvict.length, 6);
	assert.equal(keysAfterEvict.length, 4);
	assert.ok(!(keysAfterEvict.includes(0)));
	assert.ok(!(keysAfterEvict.includes(1)));

	// Test with values()
	const values = [...lru.values()];
	assert.equal(values.length, 4);
	assert.ok(values.includes('value2'));
	assert.ok(values.includes('value5'));

	// Test with entries()
	const entries = [...lru.entries()];
	assert.equal(entries.length, 4);
	assert.deepEqual(entries[0], [2, 'value2']);

	// Test with entriesAscending()
	const ascending = [...lru.entriesAscending()];
	assert.equal(ascending.length, 4);
	assert.deepEqual(ascending[0], [2, 'value2']);

	// Test with entriesDescending()
	const descending = [...lru.entriesDescending()];
	assert.equal(descending.length, 4);
	assert.deepEqual(descending[0], [5, 'value5']);
});

test('.evict() with forEach method interaction', () => {
	const lru = new QuickLRU({maxSize: 5});

	for (let i = 0; i < 5; i++) {
		lru.set(i, i * 10);
	}

	lru.evict(2);

	const seen = [];
	lru.forEach((value, key) => {
		seen.push([key, value]);
	});

	assert.deepEqual(seen, [[2, 20], [3, 30], [4, 40]]);
});

test('.evict() concurrent with cache capacity triggers', () => {
	const evicted = [];
	const lru = new QuickLRU({
		maxSize: 3,
		onEviction(key, value) {
			evicted.push({key, value});
		},
	});

	// Fill cache
	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);

	// Manual evict
	lru.evict(1);

	// Should have one manual eviction
	assert.equal(evicted.length, 1);

	// Add more items - these won't trigger auto-eviction since cache isn't at capacity
	lru.set('d', 4);
	assert.equal(lru.size, 3); // Still at capacity
	assert.equal(evicted.length, 1); // No new evictions

	// Force auto-eviction by filling beyond maxSize
	lru.set('e', 5);
	lru.set('f', 6); // This should trigger auto-eviction

	// Should now have more evictions from auto-eviction
	assert.ok(evicted.length > 1);
});

test('.evict() with peek interactions preserves LRU order', () => {
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);
	lru.set('d', 4);
	lru.set('e', 5);

	// Peek doesn't change LRU order
	assert.equal(lru.peek('a'), 1);
	assert.equal(lru.peek('b'), 2);

	// Evict should still remove 'a' first (oldest)
	lru.evict(1);

	assert.ok(!(lru.has('a')));
	assert.ok(lru.has('b'));
	assert.ok(lru.has('c'));
	assert.ok(lru.has('d'));
	assert.ok(lru.has('e'));
});

test('.evict() maintains consistency with size property', () => {
	const lru = new QuickLRU({maxSize: 10});

	// Fill with varying operations
	for (let i = 0; i < 8; i++) {
		lru.set(i, i);
	}

	lru.delete(3);
	lru.delete(5);
	assert.equal(lru.size, 6);

	lru.evict(3);
	assert.equal(lru.size, 3);

	// Add items back
	lru.set('new1', 'val1');
	lru.set('new2', 'val2');
	assert.equal(lru.size, 5);

	// Size should always match actual iteration count
	const iterationCount = [...lru].length;
	assert.equal(lru.size, iterationCount);
});

test('.evict() edge case: exactly maxSize items with expiry', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 3});

	// Fill exactly to maxSize with mixed expiry
	lru.set('temp1', 1, {maxAge: 5}); // Will expire
	lru.set('temp2', 2, {maxAge: 5}); // Will expire
	lru.set('perm', 3); // Will not expire

	t.mock.timers.tick(10);

	// All temp items expired, only perm remains. But cache thinks it has 3 items (size property)
	lru.evict(1);

	// Should handle gracefully
	assert.ok(lru.size <= 1);
	assert.ok(lru.has('perm'));
});

test('.evict() walks past many expired items', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 100});

	// Add many items with short expiry
	for (let i = 0; i < 50; i++) {
		lru.set(`expired${i}`, i, {maxAge: 1});
	}

	// Add some permanent items
	for (let i = 0; i < 10; i++) {
		lru.set(`perm${i}`, i);
	}

	t.mock.timers.tick(10); // Let expired items expire

	lru.evict(5);

	assert.ok(lru.size <= 10); // Should have evicted some permanent items too
});

test('.evict() boundary: evict count equals live items minus one', () => {
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);

	// Evict exactly size - 1 (should leave 1 item)
	lru.evict(2);

	assert.equal(lru.size, 1);
	assert.ok(lru.has('c')); // Most recent should remain
});

test('.evict() with custom maxAge and global maxAge interaction', t => {
	t.mock.timers.enable({apis: ['Date'], now: Date.now()});
	const lru = new QuickLRU({maxSize: 5, maxAge: 1000}); // Global maxAge

	lru.set('global1', 1); // Uses global maxAge
	lru.set('custom1', 2, {maxAge: 5}); // Custom short maxAge
	lru.set('global2', 3); // Uses global maxAge
	lru.set('custom2', 4, {maxAge: 5}); // Custom short maxAge
	lru.set('noglobal', 5); // Uses global maxAge

	t.mock.timers.tick(10); // Custom items expire

	lru.evict(2);

	// Should evict oldest live items
	assert.equal(lru.size, 1);
	assert.ok(lru.has('noglobal')); // Most recent should remain
});
