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

test('.maxAge', t => {
	const lru = new QuickLRU({maxSize: 1});
	t.is(lru.maxAge, Number.POSITIVE_INFINITY);
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

test('set(maxAge): is returned by getter', t => {
	const maxAge = 100;
	const lru = new QuickLRU({maxSize: 1, maxAge});
	t.is(lru.maxAge, maxAge);
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

test('.evict() removes least recently used items', t => {
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);
	lru.set('d', 4);
	lru.set('e', 5);

	// Evict 2 least recently used items
	lru.evict(2);

	t.is(lru.size, 3);
	t.false(lru.has('a'));
	t.false(lru.has('b'));
	t.true(lru.has('c'));
	t.true(lru.has('d'));
	t.true(lru.has('e'));
});

test('.evict() with accessed items changes order', t => {
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

	t.is(lru.size, 3);
	t.true(lru.has('a'));
	t.true(lru.has('b'));
	t.false(lru.has('c'));
	t.false(lru.has('d'));
	t.true(lru.has('e'));
});

test('.evict() keeps at least one item', t => {
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);

	// Try to evict all items (should keep the most recent)
	lru.evict(10);

	t.is(lru.size, 1);
	t.true(lru.has('c'));
});

test('.evict() triggers onEviction callback', t => {
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

	t.is(evicted.length, 2);
	t.deepEqual(evicted[0], {key: 'a', value: 1});
	t.deepEqual(evicted[1], {key: 'b', value: 2});
});

test('.evict() default count is 1', t => {
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);

	// Evict without parameter (should default to 1)
	lru.evict();

	t.is(lru.size, 2);
	t.false(lru.has('a'));
	t.true(lru.has('b'));
	t.true(lru.has('c'));
});

test('.evict() with zero or negative count does nothing', t => {
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1);
	lru.set('b', 2);

	const initialSize = lru.size;

	lru.evict(0);
	t.is(lru.size, initialSize);

	lru.evict(-5);
	t.is(lru.size, initialSize);
});

test('.evict() on empty cache does nothing', t => {
	const lru = new QuickLRU({maxSize: 5});

	t.notThrows(() => {
		lru.evict(5);
	});

	t.is(lru.size, 0);
});

test('.evict() respects maxSize after eviction', t => {
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);
	lru.set('d', 4);
	lru.set('e', 5);

	// Evict 2 items
	lru.evict(2);
	t.is(lru.size, 3);

	// Can still add up to maxSize
	lru.set('f', 6);
	lru.set('g', 7);
	t.is(lru.size, 5);

	// Adding more triggers normal LRU eviction
	lru.set('h', 8);
	lru.set('i', 9);
	t.is(lru.size, 5);
});

test('.evict() handles edge case inputs', t => {
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);

	// NaN should do nothing
	lru.evict(Number.NaN);
	t.is(lru.size, 3);

	// String "1" should be coerced to number 1
	lru.evict('1');
	t.is(lru.size, 2);

	// Undefined should use default of 1
	lru.evict(undefined);
	t.is(lru.size, 1);
	t.true(lru.has('c'));
});

test('.evict() keeps at least one item with expired entries', async t => {
	const {setTimeout: delay} = await import('node:timers/promises');
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1, {maxAge: 1}); // Will expire
	lru.set('b', 2, {maxAge: 1}); // Will expire
	lru.set('c', 3); // Will not expire

	// Wait for expiration
	await delay(10);

	// Try to evict everything - should keep the one live item
	lru.evict(Number.POSITIVE_INFINITY);

	t.is(lru.size, 1);
	t.false(lru.has('a')); // Expired
	t.false(lru.has('b')); // Expired
	t.true(lru.has('c')); // Only live item left
});

test('.evict() handles all items expired gracefully', async t => {
	const {setTimeout: delay} = await import('node:timers/promises');
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1, {maxAge: 1}); // Will expire
	lru.set('b', 2, {maxAge: 1}); // Will expire
	lru.set('c', 3, {maxAge: 1}); // Will expire

	// Wait for all to expire
	await delay(10);

	// When all items are expired, evict should be a no-op
	lru.evict(1);

	t.is(lru.size, 0);
});

test('.evict() with mixed expiry and access patterns', async t => {
	const {setTimeout: delay} = await import('node:timers/promises');
	const lru = new QuickLRU({maxSize: 5});

	lru.set('fast1', 1, {maxAge: 5}); // Expires quickly
	lru.set('slow1', 2, {maxAge: 100}); // Expires slowly
	lru.set('fast2', 3, {maxAge: 5}); // Expires quickly
	lru.set('slow2', 4, {maxAge: 100}); // Expires slowly

	// Wait for fast items to expire
	await delay(10);

	// Access remaining items to change order
	lru.get('slow1');
	lru.get('slow2');

	// Should evict the oldest remaining live item
	lru.evict(1);

	t.is(lru.size, 1);
	t.false(lru.has('fast1')); // Expired
	t.false(lru.has('fast2')); // Expired
	t.false(lru.has('slow1')); // Evicted (was oldest live)
	t.true(lru.has('slow2')); // Remaining
});

test('.evict() with extremely large count values', t => {
	const lru = new QuickLRU({maxSize: 3});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);

	// MAX_SAFE_INTEGER should work
	lru.evict(Number.MAX_SAFE_INTEGER);

	t.is(lru.size, 1);
	t.true(lru.has('c')); // Most recent item kept
});

test('.evict() works with complex object values', t => {
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

	t.is(lru.size, 2);
	t.is(evicted.length, 2);
	t.deepEqual(evicted[0], {key: 'obj1', value: object1});
	t.deepEqual(evicted[1], {key: 'obj2', value: object2});
	t.true(lru.has('arr1'));
	t.true(lru.has('arr2'));
});

test('.evict() with WeakMap/WeakSet values', t => {
	const lru = new QuickLRU({maxSize: 3});

	const weakMap = new WeakMap();
	const weakSet = new WeakSet();
	const object = {};

	lru.set('weakmap', weakMap);
	lru.set('weakset', weakSet);
	lru.set('object', object);

	lru.evict(1);

	t.is(lru.size, 2);
	t.false(lru.has('weakmap'));
	t.true(lru.has('weakset'));
	t.true(lru.has('object'));
});

test('.evict() maintains cache integrity after multiple operations', t => {
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
	t.true(lru.size > 0);

	// Test all methods still work
	lru.set('new', 'value');
	t.true(lru.has('new'));
	t.is(lru.get('new'), 'value');

	const keys = [...lru.keys()];
	const values = [...lru.values()];
	const entries = [...lru.entries()];

	t.is(keys.length, lru.size);
	t.is(values.length, lru.size);
	t.is(entries.length, lru.size);
});

test('.evict() with non-integer count coercion edge cases', t => {
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);
	lru.set('d', 4);

	// Test various coercion cases
	const initialSize = lru.size;

	// Boolean true -> 1
	lru.evict(true);
	t.is(lru.size, initialSize - 1);

	// Boolean false -> 0 (no-op)
	lru.evict(false);
	t.is(lru.size, initialSize - 1);

	// String with spaces
	lru.evict('  2  ');
	t.is(lru.size, 1);

	// Should keep at least one
	t.true(lru.size > 0);
});

test('.evict() with maxSize of 1', t => {
	const lru = new QuickLRU({maxSize: 1});

	lru.set('only', 'item');
	t.is(lru.size, 1);

	// Should keep the one item
	lru.evict(1);
	t.is(lru.size, 1);
	t.true(lru.has('only'));

	// Evict 0 should be no-op
	lru.evict(0);
	t.is(lru.size, 1);
	t.true(lru.has('only'));

	// Even large numbers should keep the one item
	lru.evict(999_999);
	t.is(lru.size, 1);
	t.true(lru.has('only'));
});

test('.evict() during iteration maintains stability', t => {
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
	t.is(keys.length, 5);
	t.is(lru.size, 3);
});

test('.evict() rapid successive calls', t => {
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

	t.is(lru.size, 5);
	t.is(evicted.length, 5);

	// Verify eviction order (should be 0, 1, 2, 3, 4)
	for (let i = 0; i < 5; i++) {
		t.is(evicted[i].key, i);
		t.is(evicted[i].value, i);
	}
});

test('.evict() with circular references', t => {
	const lru = new QuickLRU({maxSize: 3});

	const circular1 = {name: 'obj1'};
	circular1.self = circular1;

	const circular2 = {name: 'obj2'};
	circular2.ref = circular1;
	circular1.ref = circular2;

	lru.set('circular1', circular1);
	lru.set('circular2', circular2);
	lru.set('normal', 'value');

	// Should handle circular references without issues
	t.notThrows(() => {
		lru.evict(1);
	});

	t.is(lru.size, 2);
});

test('.evict() with symbols as keys', t => {
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

	t.is(lru.size, 2);
	t.false(lru.has(sym1));
	t.false(lru.has(sym2));
	t.true(lru.has(sym3));
	t.true(lru.has(sym4));
});

test('.evict() interaction with resize method', t => {
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
	t.is(lru.size, 6);
	t.is(evicted.length, 4);

	// Then evict more
	lru.evict(3);
	t.is(lru.size, 3);
	t.is(evicted.length, 7);

	// Resize back up
	lru.resize(8);
	t.is(lru.maxSize, 8);
	t.is(lru.size, 3);

	// Add more items
	lru.set('new1', 'val1');
	lru.set('new2', 'val2');
	t.is(lru.size, 5);
});

test('.evict() with custom object toString methods', t => {
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
	t.notThrows(() => {
		lru.evict(1);
	});

	t.is(lru.size, 2);
});

test('.evict() stress test with many items', t => {
	const lru = new QuickLRU({maxSize: 1000});

	// Fill with many items
	for (let i = 0; i < 1000; i++) {
		lru.set(i, `value${i}`);
	}

	t.is(lru.size, 1000);

	// Evict large batch
	const start = Date.now();
	lru.evict(500);
	const duration = Date.now() - start;

	t.is(lru.size, 500);
	t.true(duration < 100); // Should be fast (< 100ms)

	// Verify remaining items are the most recent
	for (let i = 500; i < 1000; i++) {
		t.true(lru.has(i));
	}

	for (let i = 0; i < 500; i++) {
		t.false(lru.has(i));
	}
});

test('.evict() with alternating get/set/evict operations', t => {
	const lru = new QuickLRU({maxSize: 5});

	// Complex sequence of operations
	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);

	lru.get('a'); // Make 'a' recent (but still moves to recent cache)
	lru.evict(1); // Should evict oldest, which is 'a' (the get moved it but it's still oldest in the recent cache)

	t.false(lru.has('a'));
	t.true(lru.has('b'));
	t.true(lru.has('c'));

	lru.set('d', 4);
	lru.set('e', 5);
	lru.peek('c'); // Peek doesn't change order
	lru.evict(2); // Should evict 'b' and 'c' (oldest)

	t.false(lru.has('b'));
	t.false(lru.has('c'));
	t.true(lru.has('d'));
	t.true(lru.has('e'));
});

test('.evict() with fractional and edge numeric values', t => {
	const lru = new QuickLRU({maxSize: 5});

	for (let i = 0; i < 5; i++) {
		lru.set(i, i);
	}

	// Fractional values
	lru.evict(2.7); // Should truncate to 2
	t.is(lru.size, 3);

	lru.set(10, 10);
	lru.set(11, 11);

	// Negative infinity
	lru.evict(Number.NEGATIVE_INFINITY);
	t.is(lru.size, 5); // Should be no-op

	// Very small positive number
	lru.evict(0.1); // Should truncate to 0, no-op
	t.is(lru.size, 5);

	// Scientific notation
	lru.evict(2e2); // 200, should evict all but one
	t.is(lru.size, 1);
});

test('.evict() callback execution order and state', t => {
	const events = [];
	const lru = new QuickLRU({
		maxSize: 5,
		onEviction(key, value) {
			// Record the state when callback is called
			events.push({
				type: 'eviction',
				key,
				value,
				cacheSize: lru.size, // This should be the OLD size
				cacheHasKey: lru.has(key), // Should still exist during callback
			});
		},
	});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);

	lru.evict(2);

	t.is(events.length, 2);
	t.deepEqual(events[0], {
		type: 'eviction',
		key: 'a',
		value: 1,
		cacheSize: 3, // Size before eviction
		cacheHasKey: true, // Item still exists during callback
	});
	t.deepEqual(events[1], {
		type: 'eviction',
		key: 'b',
		value: 2,
		cacheSize: 3,
		cacheHasKey: true,
	});

	// After eviction, items should be gone
	t.false(lru.has('a'));
	t.false(lru.has('b'));
	t.true(lru.has('c'));
});

test('.evict() interaction with all iterator methods', t => {
	const lru = new QuickLRU({maxSize: 6});

	for (let i = 0; i < 6; i++) {
		lru.set(i, `value${i}`);
	}

	// Test with keys()
	const keysBeforeEvict = [...lru.keys()];
	lru.evict(2);
	const keysAfterEvict = [...lru.keys()];

	t.is(keysBeforeEvict.length, 6);
	t.is(keysAfterEvict.length, 4);
	t.false(keysAfterEvict.includes(0));
	t.false(keysAfterEvict.includes(1));

	// Test with values()
	const values = [...lru.values()];
	t.is(values.length, 4);
	t.true(values.includes('value2'));
	t.true(values.includes('value5'));

	// Test with entries()
	const entries = [...lru.entries()];
	t.is(entries.length, 4);
	t.deepEqual(entries[0], [2, 'value2']);

	// Test with entriesAscending()
	const ascending = [...lru.entriesAscending()];
	t.is(ascending.length, 4);
	t.deepEqual(ascending[0], [2, 'value2']);

	// Test with entriesDescending()
	const descending = [...lru.entriesDescending()];
	t.is(descending.length, 4);
	t.deepEqual(descending[0], [5, 'value5']);
});

test('.evict() with forEach method interaction', t => {
	const lru = new QuickLRU({maxSize: 5});

	for (let i = 0; i < 5; i++) {
		lru.set(i, i * 10);
	}

	lru.evict(2);

	const forEachResults = [];
	for (const [key, value] of lru) {
		forEachResults.push({key, value, isThisCorrect: true});
	}

	t.is(forEachResults.length, 3);
	t.deepEqual(forEachResults[0], {key: 2, value: 20, isThisCorrect: true});
	t.deepEqual(forEachResults[1], {key: 3, value: 30, isThisCorrect: true});
	t.deepEqual(forEachResults[2], {key: 4, value: 40, isThisCorrect: true});
});

test('.evict() concurrent with cache capacity triggers', t => {
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
	t.is(evicted.length, 1);

	// Add more items - these won't trigger auto-eviction since cache isn't at capacity
	lru.set('d', 4);
	t.is(lru.size, 3); // Still at capacity
	t.is(evicted.length, 1); // No new evictions

	// Force auto-eviction by filling beyond maxSize
	lru.set('e', 5);
	lru.set('f', 6); // This should trigger auto-eviction

	// Should now have more evictions from auto-eviction
	t.true(evicted.length > 1);
});

test('.evict() with peek interactions preserves LRU order', t => {
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);
	lru.set('d', 4);
	lru.set('e', 5);

	// Peek doesn't change LRU order
	t.is(lru.peek('a'), 1);
	t.is(lru.peek('b'), 2);

	// Evict should still remove 'a' first (oldest)
	lru.evict(1);

	t.false(lru.has('a'));
	t.true(lru.has('b'));
	t.true(lru.has('c'));
	t.true(lru.has('d'));
	t.true(lru.has('e'));
});

test('.evict() maintains consistency with size property', t => {
	const lru = new QuickLRU({maxSize: 10});

	// Fill with varying operations
	for (let i = 0; i < 8; i++) {
		lru.set(i, i);
	}

	lru.delete(3);
	lru.delete(5);
	t.is(lru.size, 6);

	lru.evict(3);
	t.is(lru.size, 3);

	// Add items back
	lru.set('new1', 'val1');
	lru.set('new2', 'val2');
	t.is(lru.size, 5);

	// Size should always match actual iteration count
	const iterationCount = [...lru].length;
	t.is(lru.size, iterationCount);
});

test('.evict() edge case: exactly maxSize items with expiry', async t => {
	const {setTimeout: delay} = await import('node:timers/promises');
	const lru = new QuickLRU({maxSize: 3});

	// Fill exactly to maxSize with mixed expiry
	lru.set('temp1', 1, {maxAge: 5}); // Will expire
	lru.set('temp2', 2, {maxAge: 5}); // Will expire
	lru.set('perm', 3); // Will not expire

	await delay(10);

	// All temp items expired, only perm remains
	// But cache thinks it has 3 items (size property)
	lru.evict(1);

	// Should handle gracefully
	t.true(lru.size <= 1);
	t.true(lru.has('perm'));
});

test('.evict() type coercion with special objects', t => {
	const lru = new QuickLRU({maxSize: 5});

	for (let i = 0; i < 5; i++) {
		lru.set(i, i);
	}

	// Test with Date object - Number(new Date(2)) is 2
	lru.evict(new Date(2)); // Should coerce to 2
	t.is(lru.size, 3);

	// Test with object with valueOf
	const customObject = {
		valueOf() {
			return 1;
		},
	};
	lru.evict(customObject); // Should coerce to 1
	t.is(lru.size, 2);

	// Test with array
	lru.evict([1]); // Should coerce to 1
	t.is(lru.size, 1);
});

test('.evict() performance with large maxAge and many expired items', async t => {
	const {setTimeout: delay} = await import('node:timers/promises');
	const lru = new QuickLRU({maxSize: 100});

	// Add many items with short expiry
	for (let i = 0; i < 50; i++) {
		lru.set(`expired${i}`, i, {maxAge: 1});
	}

	// Add some permanent items
	for (let i = 0; i < 10; i++) {
		lru.set(`perm${i}`, i);
	}

	await delay(10); // Let expired items expire

	// Performance test: should be fast even with many expired items
	const start = Date.now();
	lru.evict(5);
	const duration = Date.now() - start;

	t.true(duration < 50); // Should be very fast
	t.true(lru.size <= 10); // Should have evicted some permanent items too
});

test('.evict() boundary: evict count equals live items minus one', t => {
	const lru = new QuickLRU({maxSize: 5});

	lru.set('a', 1);
	lru.set('b', 2);
	lru.set('c', 3);

	// Evict exactly size - 1 (should leave 1 item)
	lru.evict(2);

	t.is(lru.size, 1);
	t.true(lru.has('c')); // Most recent should remain
});

test('.evict() with custom maxAge and global maxAge interaction', async t => {
	const {setTimeout: delay} = await import('node:timers/promises');
	const lru = new QuickLRU({maxSize: 5, maxAge: 100}); // Global maxAge

	lru.set('global1', 1); // Uses global maxAge
	lru.set('custom1', 2, {maxAge: 5}); // Custom short maxAge
	lru.set('global2', 3); // Uses global maxAge
	lru.set('custom2', 4, {maxAge: 5}); // Custom short maxAge
	lru.set('noglobal', 5); // Uses global maxAge

	await delay(10); // Custom items expire

	lru.evict(2);

	// Should evict oldest live items
	t.is(lru.size, 1);
	t.true(lru.has('noglobal')); // Most recent should remain
});
