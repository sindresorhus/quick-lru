import {setTimeout as delay} from 'node:timers/promises';
import test from 'ava';
import QuickLRU from './index.js';

const lruWithDuplicates = () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('key', 'value');
	lru.set('keyDupe', 1);
	lru.set('keyDupe', 2);
	return lru;
};

test('main', t => {
	t.throws(() => {
		new QuickLRU(); // eslint-disable-line no-new
	}, {message: /maxSize/});
});

test('maxAge: throws on invalid value', t => {
	t.throws(() => {
		new QuickLRU({maxSize: 10, maxAge: 0}); // eslint-disable-line no-new
	}, {message: /maxAge/});
});

test('.get() / .set()', t => {
	const lru = new QuickLRU({maxSize: 100});
	lru.set('foo', 1);
	const setReturnValue = lru.set('bar', 2);
	t.is(setReturnValue, lru);
	t.is(lru.get('foo'), 1);
	t.is(lru.size, 2);
});

test('.get() - limit', t => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	t.is(lru.get('1'), 1);
	t.is(lru.get('3'), undefined);
	lru.set('3', 3);
	lru.get('1');
	lru.set('4', 4);
	lru.get('1');
	lru.set('5', 5);
	t.true(lru.has('1'));
});

test('.set() - limit', t => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('foo', 1);
	lru.set('bar', 2);
	t.is(lru.get('foo'), 1);
	t.is(lru.get('bar'), 2);
	lru.set('baz', 3);
	lru.set('faz', 4);
	t.false(lru.has('foo'));
	t.false(lru.has('bar'));
	t.true(lru.has('baz'));
	t.true(lru.has('faz'));
	t.is(lru.size, 2);
});

test('.set() - update item', t => {
	const lru = new QuickLRU({maxSize: 100});
	lru.set('foo', 1);
	t.is(lru.get('foo'), 1);
	lru.set('foo', 2);
	t.is(lru.get('foo'), 2);
	t.is(lru.size, 1);
});

test('.has()', t => {
	const lru = new QuickLRU({maxSize: 100});
	lru.set('foo', 1);
	t.true(lru.has('foo'));
});

test('.peek()', t => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	t.is(lru.peek('1'), 1);
	lru.set('2', 2);
	t.is(lru.peek('1'), 1);
	t.is(lru.peek('3'), undefined);
	lru.set('3', 3);
	lru.set('4', 4);
	t.false(lru.has('1'));
});

test('expiresIn() returns undefined for missing key', t => {
	const lru = new QuickLRU({maxSize: 100});
	t.is(lru.expiresIn('nope'), undefined);
});

test('expiresIn() returns Infinity when no maxAge', t => {
	const lru = new QuickLRU({maxSize: 100});
	lru.set('infinity', 'no ttl given');
	t.is(lru.expiresIn('infinity'), Number.POSITIVE_INFINITY);
});

test('expiresIn() returns remaining ms for expiring item', async t => {
	const lru = new QuickLRU({maxSize: 100});
	lru.set('100ms', 'ttl given', {maxAge: 100});
	t.is(lru.expiresIn('100ms'), 100);
	await delay(50);
	const remainingMs = lru.expiresIn('100ms');
	t.true(remainingMs > 40 && remainingMs < 60);
});

test('expiresIn() returns <= 0 when expired and does not evict', async t => {
	const lru = new QuickLRU({maxSize: 100});
	lru.set('short', 'value', {maxAge: 20});
	await delay(30);
	const remainingMs = lru.expiresIn('short');
	t.true(remainingMs <= 0);
});

test('.delete()', t => {
	const lru = new QuickLRU({maxSize: 100});
	lru.set('foo', 1);
	lru.set('bar', 2);
	t.true(lru.delete('foo'));
	t.false(lru.has('foo'));
	t.true(lru.has('bar'));
	t.false(lru.delete('foo'));
	t.is(lru.size, 1);
});

test('.delete() - limit', t => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('foo', 1);
	lru.set('bar', 2);
	t.is(lru.size, 2);
	t.true(lru.delete('foo'));
	t.false(lru.has('foo'));
	t.true(lru.has('bar'));
	lru.delete('bar');
	t.is(lru.size, 0);
});

test('.clear()', t => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('foo', 1);
	lru.set('bar', 2);
	lru.set('baz', 3);
	lru.clear();
	t.is(lru.size, 0);
});

test('.keys()', t => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	t.deepEqual([...lru.keys()].sort(), ['1', '2', '3']);
});

test('.keys() - accounts for duplicates', t => {
	const lru = lruWithDuplicates();
	t.deepEqual([...lru.keys()].sort(), ['key', 'keyDupe']);
});

test('.values()', t => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	t.deepEqual([...lru.values()].sort(), [1, 2, 3]);
});

test('.values() - accounts for duplicates', t => {
	const lru = lruWithDuplicates();
	t.deepEqual([...lru.values()].sort(), [2, 'value']);
});

test('.[Symbol.iterator]()', t => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	t.deepEqual([...lru].sort(), [['1', 1], ['2', 2], ['3', 3]]);
});

test('.[Symbol.iterator]() - accounts for duplicates', t => {
	const lru = lruWithDuplicates();
	t.deepEqual([...lru].sort(), [['key', 'value'], ['keyDupe', 2]]);
});

test('.size', t => {
	const lru = new QuickLRU({maxSize: 100});
	lru.set('1', 1);
	lru.set('2', 2);
	t.is(lru.size, 2);
	lru.delete('1');
	t.is(lru.size, 1);
	lru.set('3', 3);
	t.is(lru.size, 2);
});

test('.size - accounts for duplicates', t => {
	const lru = lruWithDuplicates();
	t.is(lru.size, 2);
});

test('max size', t => {
	const lru = new QuickLRU({maxSize: 3});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	t.is(lru.size, 3);
	lru.set('4', 4);
	t.is(lru.size, 3);
});

test('.maxSize', t => {
	const maxSize = 100;
	const lru = new QuickLRU({maxSize});
	t.is(lru.maxSize, maxSize);
});

test('checks total cache size does not exceed `maxSize`', t => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.get('1');
	t.is(lru.__oldCache.has('1'), false);
});

test('`onEviction` is called after `maxSize` is exceeded', t => {
	const expectedKey = '1';
	const expectedValue = 1;
	let evictionCalled = false;
	let actualKey;
	let actualValue;

	const onEviction = (key, value) => {
		actualKey = key;
		actualValue = value;
		evictionCalled = true;
	};

	const lru = new QuickLRU({maxSize: 1, onEviction});
	lru.set(expectedKey, expectedValue);
	lru.set('2', 2);
	t.is(actualKey, expectedKey);
	t.is(actualValue, expectedValue);
	t.true(evictionCalled);
});

test('set(maxAge): an item can have a custom expiration', async t => {
	const lru = new QuickLRU({maxSize: 10});
	lru.set('1', 'test', {maxAge: 100});
	await delay(200);
	t.false(lru.has('1'));
});

test('set(maxAge): items without expiration never expire', async t => {
	const lru = new QuickLRU({maxSize: 10});
	lru.set('1', 'test', {maxAge: 100});
	lru.set('2', 'boo');
	await delay(200);
	t.false(lru.has('1'));
	await delay(200);
	t.true(lru.has('2'));
});

test('set(maxAge): ignores non-numeric maxAge option', async t => {
	const lru = new QuickLRU({maxSize: 10});
	lru.set('1', 'test', 'string');
	lru.set('2', 'boo');
	await delay(200);
	t.true(lru.has('1'));
	await delay(200);
	t.true(lru.has('2'));
});

test('set(maxAge): per-item maxAge overrides global maxAge', async t => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 1000});
	lru.set('1', 'test', {maxAge: 100});
	lru.set('2', 'boo');
	await delay(300);
	t.false(lru.has('1'));
	await delay(200);
	t.true(lru.has('2'));
});

test('set(maxAge): setting the same key refreshes expiration', async t => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 150});
	lru.set('1', 'test');
	await delay(100);
	lru.set('1', 'test');
	await delay(100);
	t.true(lru.has('1'));
});

test('maxAge: get() removes an expired item', async t => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 90});
	lru.set('1', 'test');
	await delay(200);
	t.is(lru.get('1'), undefined);
});

test('maxAge: non-recent items can also expire', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', 'test1');
	lru.set('2', 'test2');
	lru.set('3', 'test4');
	await delay(200);
	t.is(lru.get('1'), undefined);
});

test('maxAge: setting the same key refreshes expiration', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', 'test');
	await delay(50);
	lru.set('1', 'test2');
	await delay(50);
	t.is(lru.get('1'), 'test2');
});

test('maxAge: setting an item with a local expiration', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', 'test');
	lru.set('2', 'test2', {maxAge: 500});
	await delay(200);
	t.true(lru.has('2'));
	await delay(300);
	t.false(lru.has('2'));
});

test('maxAge: empty options object uses global maxAge', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', 'test');
	lru.set('2', 'test2', {});
	await delay(200);
	t.false(lru.has('2'));
});

test('maxAge: calls onEviction for expired recent item', async t => {
	t.timeout(1000);
	const expectedKey = '1';
	const expectedValue = 'test';

	let evictionCalled = false;
	let actualKey;
	let actualValue;
	const onEviction = (key, value) => {
		evictionCalled = true;
		actualKey = key;
		actualValue = value;
	};

	const lru = new QuickLRU({
		maxSize: 2,
		maxAge: 100,
		onEviction,
	});

	lru.set(expectedKey, expectedValue);

	await delay(200);

	t.is(lru.get('1'), undefined);
	t.true(evictionCalled);
	t.is(actualKey, expectedKey);
	t.is(actualValue, expectedValue);
});

test('maxAge: calls onEviction for expired non-recent items', async t => {
	t.timeout(1000);
	const expectedKeys = ['1', '2'];
	const expectedValues = ['test', 'test2'];

	let evictionCalled = false;
	const actualKeys = [];
	const actualValues = [];
	const onEviction = (key, value) => {
		evictionCalled = true;
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

	await delay(200);

	t.is(lru.get('1'), undefined);
	t.true(evictionCalled);
	t.deepEqual(actualKeys, expectedKeys);
	t.deepEqual(actualValues, expectedValues);
});

test('maxAge: evicts expired items on resize', async t => {
	t.timeout(1000);
	const expectedKeys = ['1', '2', '3'];
	const expectedValues = ['test', 'test2', 'test3'];

	let evictionCalled = false;
	const actualKeys = [];
	const actualValues = [];
	const onEviction = (key, value) => {
		evictionCalled = true;
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

	await delay(200);

	t.false(lru.has('1'));
	t.true(evictionCalled);
	t.deepEqual(actualKeys, expectedKeys);
	t.deepEqual(actualValues, expectedValues);
});

test('maxAge: peek() returns non-expired items', async t => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 400});
	lru.set('1', 'test');
	await delay(200);
	t.is(lru.peek('1'), 'test');
});

test('maxAge: peek() lazily removes expired recent items', async t => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 100});
	lru.set('1', 'test');
	await delay(200);
	t.is(lru.peek('1'), undefined);
});

test('maxAge: peek() lazily removes expired non-recent items', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', 'test');
	lru.set('2', 'test');
	lru.set('3', 'test');
	await delay(200);
	t.is(lru.peek('1'), undefined);
});

test('maxAge: non-recent items not expired are valid', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 200});
	lru.set('1', 'test');
	lru.set('2', 'test2');
	lru.set('3', 'test4');
	await delay(100);
	t.is(lru.get('1'), 'test');
});

test('maxAge: has() deletes expired items and returns false', async t => {
	const lru = new QuickLRU({maxSize: 4, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test');
	lru.set('3', 'test');
	await delay(200);
	t.false(lru.has('1'));
});

test('maxAge: has() returns true when not expired', t => {
	const lru = new QuickLRU({maxSize: 4, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test');
	lru.set('3', 'test');
	t.true(lru.has('1'));
});

test('maxAge: has() returns true for undefined values with expiration', t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test');
	lru.set('3', 'test');
	t.true(lru.has('1'));
});

test('maxAge: keys() returns only non-expired keys', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);
	lru.set('4', 'loco');

	t.deepEqual([...lru.keys()].sort(), ['4']);
});

test('maxAge: keys() returns empty when all items expired', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);

	t.deepEqual([...lru.keys()].sort(), []);
});

test('maxAge: values() returns empty when all items expired', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);

	t.deepEqual([...lru.values()].sort(), []);
});

test('maxAge: values() returns only non-expired values', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);
	lru.set('5', 'loco');

	t.deepEqual([...lru.values()].sort(), ['loco']);
});

test('maxAge: entriesDescending() excludes expired entries', async t => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	t.deepEqual([...lru.entriesDescending()], [['5', 'loco'], ['4', 'coco']]);
});

test('maxAge: entriesDescending() excludes expired entries from old cache', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	t.deepEqual([...lru.entriesDescending()], [['5', 'loco'], ['4', 'coco']]);
});

test('maxAge: entriesDescending() returns all non-expired entries in order', async t => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 5000});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	t.deepEqual([...lru.entriesDescending()], [['5', 'loco'], ['4', 'coco'], ['3', 'test3'], ['2', 'test2'], ['1', undefined]]);
});

test('maxAge: entriesAscending() excludes expired entries', async t => {
	const lru = new QuickLRU({maxSize: 5, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	t.deepEqual([...lru.entriesAscending()], [['4', 'coco'], ['5', 'loco']]);
});

test('maxAge: entriesAscending() excludes expired non-recent entries', async t => {
	const lru = new QuickLRU({maxSize: 3, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	t.deepEqual([...lru.entriesAscending()], [['4', 'coco'], ['5', 'loco']]);
});

test('maxAge: entriesAscending() returns only non-expired entries', async t => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	await delay(200);
	lru.set('3', 'test3');
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	t.deepEqual([...lru.entriesAscending()], [['3', 'test3'], ['4', 'coco'], ['5', 'loco']]);
});

test('maxAge: entries() returns only non-expired entries', async t => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	await delay(200);
	lru.set('3', 'test3');
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	t.deepEqual([...lru.entries()], [['3', 'test3'], ['4', 'coco'], ['5', 'loco']]);
});

test('maxAge: forEach() excludes expired entries', async t => {
	const lru = new QuickLRU({maxSize: 5, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);
	lru.set('4', 'coco');
	lru.set('5', 'loco');
	const entries = [];

	for (const [key, value] of lru.entries()) {
		entries.push([key, value]);
	}

	t.deepEqual(entries, [['4', 'coco'], ['5', 'loco']]);
});

test('maxAge: iterator excludes expired items', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('key', 'value');
	lru.set('key3', 1);
	await delay(200);
	lru.set('key4', 2);

	t.deepEqual([...lru].sort(), [['key4', 2]]);
});

test('maxAge: iterator excludes expired items from old cache', async t => {
	const lru = new QuickLRU({maxSize: 1, maxAge: 100});
	lru.set('keyunique', 'value');
	lru.set('key3unique', 1);
	lru.set('key4unique', 2);
	await delay(200);

	t.deepEqual([...lru].sort(), []);
});

test('entriesAscending enumerates cache items oldest-first', t => {
	const lru = new QuickLRU({maxSize: 3});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	lru.set('3', 7);
	lru.set('2', 8);
	t.deepEqual([...lru.entriesAscending()], [['1', 1], ['3', 7], ['2', 8]]);
});

test('entriesDescending enumerates cache items newest-first', t => {
	const lru = new QuickLRU({maxSize: 3});
	lru.set('t', 1);
	lru.set('q', 2);
	lru.set('a', 8);
	lru.set('t', 4);
	lru.set('v', 3);
	t.deepEqual([...lru.entriesDescending()], [['v', 3], ['t', 4], ['a', 8], ['q', 2]]);
});

test('entries enumerates cache items oldest-first', t => {
	const lru = new QuickLRU({maxSize: 3});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	lru.set('3', 7);
	lru.set('2', 8);
	t.deepEqual([...lru.entries()], [['1', 1], ['3', 7], ['2', 8]]);
});

test('forEach calls the cb function for each cache item oldest-first', t => {
	const lru = new QuickLRU({maxSize: 3});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	lru.set('3', 7);
	lru.set('2', 8);
	const entries = [];

	for (const [key, value] of lru.entries()) {
		entries.push([key, value]);
	}

	t.deepEqual(entries, [['1', 1], ['3', 7], ['2', 8]]);
});

test('resize removes older items', t => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	lru.resize(1);
	t.is(lru.peek('1'), undefined);
	t.is(lru.peek('3'), 3);
	lru.set('3', 4);
	t.is(lru.peek('3'), 4);
	lru.set('4', 5);
	t.is(lru.peek('4'), 5);
	t.is(lru.peek('2'), undefined);
});

test('resize omits evictions', t => {
	const calls = [];
	const onEviction = (...args) => calls.push(args);
	const lru = new QuickLRU({maxSize: 2, onEviction});

	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	lru.resize(1);
	t.true(calls.length > 0);
	t.true(calls.some(([key]) => key === '1'));
});

test('resize increases capacity', t => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.resize(3);
	lru.set('3', 3);
	lru.set('4', 4);
	lru.set('5', 5);
	t.deepEqual([...lru.entriesAscending()], [['1', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5]]);
});

test('resize does not conflict with the same number of items', t => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	lru.resize(3);
	lru.set('4', 4);
	lru.set('5', 5);
	t.deepEqual([...lru.entriesAscending()], [['1', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5]]);
});

test('resize checks parameter bounds', t => {
	const lru = new QuickLRU({maxSize: 2});
	t.throws(() => {
		lru.resize(-1);
	}, {message: /maxSize/});
});

test('function value', t => {
	const lru = new QuickLRU({maxSize: 1});
	let isCalled = false;

	lru.set('fn', () => {
		isCalled = true;
	});

	lru.get('fn')();
	t.true(isCalled);
});

test('[Symbol.toStringTag] output', t => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	t.is(lru[Symbol.toStringTag], 'QuickLRU');
});

test('toString() works as expected', t => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	t.is(lru.toString(), 'QuickLRU(2/2)');
});

test('non-primitive key', t => {
	const lru = new QuickLRU({maxSize: 99});
	const key = ['foo', 'bar'];
	const value = true;
	lru.set(key, value);
	t.true(lru.has(key));
	t.is(lru.get(key), value);
});

test('handles circular references gracefully', t => {
	const lru = new QuickLRU({maxSize: 2});

	const object1 = {name: 'object1'};
	const object2 = {name: 'object2'};
	object1.ref = object2;
	object2.ref = object1;

	lru.set('key1', object1);
	lru.set('key2', object2);

	t.notThrows(() => {
		String(lru);
	});

	t.is(lru.toString(), 'QuickLRU(2/2)');
	t.is(Object.prototype.toString.call(lru), '[object QuickLRU]');
});
