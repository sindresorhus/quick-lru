import test from 'ava';
import QuickLRU from '.';

const lruWithDuplicates = () => {
	const lru = new QuickLRU({maxSize: 2});
	lru.set('key', 'value');
	lru.set('keyDupe', 1);
	lru.set('keyDupe', 2);
	return lru;
};

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

test('main', t => {
	t.throws(() => {
		new QuickLRU(); // eslint-disable-line no-new
	}, /maxSize/);
});

test('wrong max age', t => {
	t.throws(() => {
		new QuickLRU({maxSize: 10, maxAge: 0}); // eslint-disable-line no-new
	}, /maxAge/);
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
	t.deepEqual([...lru].sort(), [
		['1', 1],
		['2', 2],
		['3', 3]
	]);
});

test('.[Symbol.iterator]() - accounts for duplicates', t => {
	const lru = lruWithDuplicates();
	t.deepEqual([...lru].sort(), [
		['key', 'value'],
		['keyDupe', 2]
	]);
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

test('max age should remove the item on get it again', async t => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 10});
	lru.set('1', 'test');
	await sleep(50);
	t.is(lru.get('1'), null);
});

test('a non recent item can also expire', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 10});
	lru.set('1', 'test');
	lru.set('2', 'test2');
	lru.set('3', 'test4');
	await sleep(50);
	t.is(lru.get('1'), null);
});

test('set the item again should refresh the expiration time', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 10});
	lru.set('1', 'test');
	await sleep(5);
	lru.set('1', 'test2');
	await sleep(5);
	t.is(lru.get('1'), 'test2');
});

test('once an item expires the eviction function should be called', async t => {
	t.timeout(1000);
	const lru = new QuickLRU({
		maxSize: 2,
		maxAge: 10,
		onEviction() {
			t.pass('Test passed');
		}
	});
	lru.set('1', 'test');
	await sleep(20);
	t.is(lru.get('1'), null);
});

test('peek the item should also remove the item if has expired', async t => {
	const lru = new QuickLRU({maxSize: 10, maxAge: 10});
	lru.set('1', 'test');
	await sleep(50);
	t.is(lru.peek('1'), null);
});

test('peek the item should also remove expired items that are not recent', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 10});
	lru.set('1', 'test');
	lru.set('2', 'test');
	lru.set('3', 'test');
	await sleep(50);
	t.is(lru.peek('1'), null);
});

test('non recent items that are not exipred are also valid', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 10});
	lru.set('1', 'test');
	lru.set('2', 'test2');
	lru.set('3', 'test4');
	await sleep(5);
	t.is(lru.get('1'), 'test');
});

test('has the item should also remove expired items', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 10});
	lru.set('1', 'test');
	await sleep(50);
	t.is(lru.has('1'), false);
});

test('has the item should also remove expired items that are not recent', async t => {
	const lru = new QuickLRU({maxSize: 2, maxAge: 10});
	lru.set('1', 'test');
	lru.set('2', 'test');
	lru.set('3', 'test');
	await sleep(50);
	t.is(lru.has('1'), false);
});
