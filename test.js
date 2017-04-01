import test from 'ava';
import M from '.';

test('main', t => {
	t.throws(() => {
		new M(); // eslint-disable-line no-new
	}, /maxSize/);
});

test('.get() / .set()', t => {
	const lru = new M({maxSize: 100});
	lru.set('foo', 1);
	lru.set('bar', 2);
	t.is(lru.get('foo'), 1);
	t.is(lru.size, 2);
});

test('.get() - limit', t => {
	const lru = new M({maxSize: 2});
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
	const lru = new M({maxSize: 2});
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
	const lru = new M({maxSize: 100});
	lru.set('foo', 1);
	t.is(lru.get('foo'), 1);
	lru.set('foo', 2);
	t.is(lru.get('foo'), 2);
	t.is(lru.size, 1);
});

test('.has()', t => {
	const lru = new M({maxSize: 100});
	lru.set('foo', 1);
	t.true(lru.has('foo'));
});

test('.peek()', t => {
	const lru = new M({maxSize: 2});
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
	const lru = new M({maxSize: 100});
	lru.set('foo', 1);
	lru.set('bar', 2);
	lru.delete('foo');
	t.false(lru.has('foo'));
	t.true(lru.has('bar'));
	t.is(lru.size, 1);
});

test('.delete() - limit', t => {
	const lru = new M({maxSize: 2});
	lru.set('foo', 1);
	lru.set('bar', 2);
	t.is(lru.size, 2);
	lru.delete('foo');
	t.false(lru.has('foo'));
	t.true(lru.has('bar'));
	lru.delete('bar');
	t.is(lru.size, 0);
});

test('.clear()', t => {
	const lru = new M({maxSize: 2});
	lru.set('foo', 1);
	lru.set('bar', 2);
	lru.set('baz', 3);
	lru.clear();
	t.is(lru.size, 0);
});

test('.keys()', t => {
	const lru = new M({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	t.deepEqual([...lru.keys()].sort(), ['1', '2', '3']);
});

test('.values()', t => {
	const lru = new M({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	t.deepEqual([...lru.values()].sort(), [1, 2, 3]);
});

test('.[Symbol.iterator]()', t => {
	const lru = new M({maxSize: 2});
	lru.set('1', 1);
	lru.set('2', 2);
	lru.set('3', 3);
	t.deepEqual([...lru].sort(), [['1', 1], ['2', 2], ['3', 3]]);
});

test('.size', t => {
	const lru = new M({maxSize: 100});
	lru.set('1', 1);
	lru.set('2', 2);
	t.is(lru.size, 2);
	lru.delete('1');
	t.is(lru.size, 1);
	lru.set('3', 3);
	t.is(lru.size, 2);
});
