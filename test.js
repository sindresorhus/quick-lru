import test from 'ava';
import QuickLRU from './index.js';

const lruWithDuplicates = () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('key', 'value');
	lru.set('keyDupe', 1);
	lru.set('keyDupe', 2);
	return lru;
};

// TODO: Use `import {setTimeout as delay} from 'timers/promises';` when targeting Node.js 16.
const delay = ms =>
	new Promise(resolve => {
		setTimeout(resolve, ms);
	});

test('main', t => {
	t.throws(() => {
		new QuickLRU(); // eslint-disable-line no-new
	}, {message: /maxSize/});
});

test('max age - incorrect value', t => {
	t.throws(() => {
		new QuickLRU({maxSize: 10, maxAge: 0}); // eslint-disable-line no-new
	}, {message: /maxAge/});
});

test('.get() / .set()', t => {
	const lru = new QuickLRU({maxSize: 100});
	lru.set('foo', 1);
	lru.set('bar', 2);
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

test('checks total cache size does not exceed `maxSize`', t => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.get('1');
	t.is(lru.oldCache.has('1'), false);
});

test('`onEviction` option method is called after `maxSize` is exceeded', t => {
	const expectKey = '1';
	const expectValue = 1;
	let isCalled = false;
	let actualKey;
	let actualValue;

	const onEviction = (key, value) => {
		actualKey = key;
		actualValue = value;
		isCalled = true;
	};

	const lru = new QuickLRU({maxSize: 1, onEviction});
	lru.set(expectKey, expectValue);
	lru.set('2', 2);
	t.is(actualKey, expectKey);
	t.is(actualValue, expectValue);
	t.true(isCalled);
});

test('set(expiry) - an individual item could have custom expiration', async t => {
	const lru = new QuickLRU({maxSize: 10});
	lru.set('1', 'test', {maxAge: Date.now() + 100});
	await delay(200);
	t.false(lru.has('1'));
});

test('set(expiry) - items without expiration will never expired', async t => {
	const lru = new QuickLRU({maxSize: 10});
	lru.set('1', 'test', {maxAge: Date.now() + 100});
	lru.set('2', 'boo');
	await delay(200);
	t.false(lru.has('1'));
	await delay(200);
	t.true(lru.has('2'));
});

test('set(expiry) - not a number expires should not be take in account', async t => {
	const lru = new QuickLRU({maxSize: 10});
	lru.set('1', 'test', 'string');
	lru.set('2', 'boo');
	await delay(200);
	t.true(lru.has('1'));
	await delay(200);
	t.true(lru.has('2'));
});

test('set(expiry) - local expires prevails over the global maxAge', async t => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 1000});
	lru.set('1', 'test', {maxAge: Date.now() + 100});
	lru.set('2', 'boo');
	await delay(300);
	t.false(lru.has('1'));
	await delay(200);
	t.true(lru.has('2'));
});

test('max age - should remove the item if has expired on call `get()` method upon the same key', async t => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 90});
	lru.set('1', 'test');
	await delay(200);
	t.is(lru.get('1'), undefined);
});

test('max age - a non-recent item can also expire', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', 'test1');
	lru.set('2', 'test2');
	lru.set('3', 'test4');
	await delay(200);
	t.is(lru.get('1'), undefined);
});

test('max age - setting the item again should refresh the expiration time', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', 'test');
	await delay(50);
	lru.set('1', 'test2');
	await delay(50);
	t.is(lru.get('1'), 'test2');
});

test('max age - setting an item with a local expiration date', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', 'test');
	lru.set('2', 'test2', {maxAge: Date.now() + 500});
	await delay(200);
	t.true(lru.has('2'));
	await delay(300);
	t.false(lru.has('2'));
});

test('max age - setting an item with a empty object as options parameter must use the global maxAge', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', 'test');
	lru.set('2', 'test2', {});
	await delay(200);
	t.false(lru.has('2'));
});

test('max age - once an item expires, the eviction function should be called', async t => {
	t.timeout(1000);
	const expectKey = '1';
	const expectValue = 'test';

	let isCalled = false;
	let actualKey;
	let actualValue;
	const onEviction = (key, value) => {
		isCalled = true;
		actualKey = key;
		actualValue = value;
	};

	const lru = new QuickLRU({
		maxSize: 2,
		maxAge: 100,
		onEviction
	});

	lru.set(expectKey, expectValue);

	await delay(200);

	t.is(lru.get('1'), undefined);
	t.true(isCalled);
	t.is(actualKey, expectKey);
	t.is(actualValue, expectValue);
});

test('max age - once an non-recent item expires, the eviction function should be called', async t => {
	t.timeout(1000);
	const expectKeys = ['1', '2'];
	const expectValues = ['test', 'test2'];

	let isCalled = false;
	const actualKeys = [];
	const actualValues = [];
	const onEviction = (key, value) => {
		isCalled = true;
		actualKeys.push(key);
		actualValues.push(value);
	};

	const lru = new QuickLRU({
		maxSize: 2,
		maxAge: 100,
		onEviction
	});

	lru.set('1', 'test');
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	lru.set('4', 'test4');
	lru.set('5', 'test5');

	await delay(200);

	t.is(lru.get('1'), undefined);
	t.true(isCalled);
	t.deepEqual(actualKeys, expectKeys);
	t.deepEqual(actualValues, expectValues);
});

test('max age - on resize, max aged items should also be evicted', async t => {
	t.timeout(1000);
	const expectKeys = ['1', '2', '3'];
	const expectValues = ['test', 'test2', 'test3'];

	let isCalled = false;
	const actualKeys = [];
	const actualValues = [];
	const onEviction = (key, value) => {
		isCalled = true;
		actualKeys.push(key);
		actualValues.push(value);
	};

	const lru = new QuickLRU({
		maxSize: 3,
		maxAge: 100,
		onEviction
	});

	lru.set('1', 'test');
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	lru.set('4', 'test4');
	lru.set('5', 'test5');

	lru.resize(2);

	await delay(200);

	t.false(lru.has('1'));
	t.true(isCalled);
	t.deepEqual(actualKeys, expectKeys);
	t.deepEqual(actualValues, expectValues);
});

test('max age - an item that is not expired can also be peek', async t => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 400});
	lru.set('1', 'test');
	await delay(200);
	t.is(lru.peek('1'), 'test');
});

test('max age - peeking the item should also remove the item if it has expired', async t => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 100});
	lru.set('1', 'test');
	await delay(200);
	t.is(lru.peek('1'), undefined);
});

test('max age - peeking the item should also remove expired items that are not recent', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', 'test');
	lru.set('2', 'test');
	lru.set('3', 'test');
	await delay(200);
	t.is(lru.peek('1'), undefined);
});

test('max age - non-recent items that are not expired are also valid', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 200});
	lru.set('1', 'test');
	lru.set('2', 'test2');
	lru.set('3', 'test4');
	await delay(100);
	t.is(lru.get('1'), 'test');
});

test('max age - has method should delete the item if expired and return false', async t => {
	const lru = new QuickLRU({maxSize: 4, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test');
	lru.set('3', 'test');
	await delay(200);
	t.false(lru.has('1'));
});

test('max age - has method should return the item if is not expired', t => {
	const lru = new QuickLRU({maxSize: 4, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test');
	lru.set('3', 'test');
	t.true(lru.has('1'));
});

test('max age - has method should return true for undefined value that has expiration time', t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test');
	lru.set('3', 'test');
	t.true(lru.has('1'));
});

test('max age - `.keys()` should return keys that are not expirated', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);
	lru.set('4', 'loco');

	t.deepEqual([...lru.keys()].sort(), ['4']);
});

test('max age - `.keys()` should return an empty list if all items has expired', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);

	t.deepEqual([...lru.keys()].sort(), []);
});

test('max age - `.values()` should return an empty if all items has expired', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);

	t.deepEqual([...lru.values()].sort(), []);
});

test('max age - `.values()` should return the values that are not expired', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);
	lru.set('5', 'loco');

	t.deepEqual([...lru.values()].sort(), ['loco']);
});

test('max age - `entriesDescending()` should not return expired entries', async t => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	t.deepEqual([...lru.entriesDescending()], [['5', 'loco'], ['4', 'coco']]);
});

test('max age - `entriesDescending()` should not return expired entries from old cache', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	t.deepEqual([...lru.entriesDescending()], [['5', 'loco'], ['4', 'coco']]);
});

test('max age - `entriesDescending()` should return all entries in desc order if are not expired', async t => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 5000});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	t.deepEqual([...lru.entriesDescending()], [['5', 'loco'], ['4', 'coco'], ['3', 'test3'], ['2', 'test2'], ['1', undefined]]);
});

test('max age - `entriesAscending()` should not return expired entries', async t => {
	const lru = new QuickLRU({maxSize: 5, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	t.deepEqual([...lru.entriesAscending()], [['4', 'coco'], ['5', 'loco']]);
});

test('max age - `entriesAscending() should not return expired entries even if are not recent', async t => {
	const lru = new QuickLRU({maxSize: 3, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	lru.set('3', 'test3');
	await delay(200);
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	t.deepEqual([...lru.entriesAscending()], [['4', 'coco'], ['5', 'loco']]);
});

test('max age - `entriesAscending()` should return the entries that are not expired', async t => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 100});
	lru.set('1', undefined);
	lru.set('2', 'test2');
	await delay(200);
	lru.set('3', 'test3');
	lru.set('4', 'coco');
	lru.set('5', 'loco');

	t.deepEqual([...lru.entriesAscending()], [['3', 'test3'], ['4', 'coco'], ['5', 'loco']]);
});

test('max age - `.[Symbol.iterator]()` should not return expired items', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 100});
	lru.set('key', 'value');
	lru.set('key3', 1);
	await delay(200);
	lru.set('key4', 2);

	t.deepEqual([...lru].sort(), [['key4', 2]]);
});

test('max age - `.[Symbol.iterator]()` should not return expired items that are old', async t => {
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
