import {expectTypeOf, expectError} from 'nz';
import QuickLRU, {type Options} from './index.js';

const lru = new QuickLRU<string, number>({maxSize: 1000, maxAge: 200});

expectTypeOf(lru.set('🦄', 1).set('🌈', 2)).toBe<QuickLRU<string, number>>();
expectTypeOf(lru.set('🦄', 1, {maxAge: 100})).toBe<QuickLRU<string, number>>();
expectTypeOf(lru.get('🦄')).toBe<number | undefined>();
expectTypeOf(lru.has('🦄')).toBe<boolean>();
expectTypeOf(lru.peek('🦄')).toBe<number | undefined>();
expectTypeOf(lru.expiresIn('🦄')).toBe<number | undefined>();
expectTypeOf(lru.delete('🦄')).toBe<boolean>();
expectTypeOf(lru.size).toBe<number>();
expectTypeOf(lru.maxAge).toBe<number>();
expectTypeOf(lru.maxSize).toBe<number>();
expectTypeOf(lru.clear()).toBe<void>();
expectTypeOf(lru.resize(10)).toBe<void>();
expectTypeOf(lru.evict()).toBe<void>();
expectTypeOf(lru.evict(3)).toBe<void>();

expectTypeOf(lru.getOrInsert('🦄', 1)).toBe<number>();
expectTypeOf(lru.getOrInsertComputed('🦄', () => 1)).toBe<number>();
expectTypeOf(lru.getOrInsertComputed('🦄', key => key.length)).toBe<number>();

for (const [key, value] of lru) {
	expectTypeOf(key).toBe<string>();
	expectTypeOf(value).toBe<number>();
}

for (const key of lru.keys()) {
	expectTypeOf(key).toBe<string>();
}

for (const value of lru.values()) {
	expectTypeOf(value).toBe<number>();
}

for (const [key, value] of lru.entries()) {
	expectTypeOf(key).toBe<string>();
	expectTypeOf(value).toBe<number>();
}

for (const [key, value] of lru.entriesAscending()) {
	expectTypeOf(key).toBe<string>();
	expectTypeOf(value).toBe<number>();
}

for (const [key, value] of lru.entriesDescending()) {
	expectTypeOf(key).toBe<string>();
	expectTypeOf(value).toBe<number>();
}

lru.forEach((value, key) => {
	expectTypeOf(value).toBe<number>();
	expectTypeOf(key).toBe<string>();
});

// The third argument is the instance, not a `Map`, so its own methods are usable.
lru.forEach((value, key, map) => {
	expectTypeOf(value).toBe<number>();
	expectTypeOf(key).toBe<string>();
	expectTypeOf(map).toBe<QuickLRU<string, number>>();
	expectTypeOf(map.entriesAscending()).toBe<ReturnType<Map<string, number>['entries']>>();
});

expectError(lru.size = 10);
expectError(lru.maxSize = 10);
expectError(lru.maxAge = 10);

expectError(new QuickLRU<string, number>());
expectError(new QuickLRU<string, number>({}));

expectTypeOf(lru).toBeAssignableTo<Map<string, number>>();
expectTypeOf(lru).toBeAssignableTo<Iterable<[string, number]>>();

const optionalLru = new QuickLRU<string, number | undefined>({maxSize: 10});
expectTypeOf(optionalLru.get('🦄')).toBe<number | undefined>();
expectTypeOf(optionalLru.set('🦄', undefined)).toBe<QuickLRU<string, number | undefined>>();
expectTypeOf(optionalLru.getOrInsert('🦄', undefined)).toBe<number | undefined>();
expectTypeOf(optionalLru.getOrInsertComputed('🦄', () => undefined)).toBe<number | undefined>();

const evictingLru = new QuickLRU<string, number>({
	maxSize: 10,
	onEviction(key, value) {
		expectTypeOf(key).toBe<string>();
		expectTypeOf(value).toBe<number>();
	},
});
expectTypeOf(evictingLru.set('a', 1)).toBe<QuickLRU<string, number>>();

// Every method that takes a key or a value must reject the wrong type, so a signature cannot quietly widen to `any`. The callback must be synchronous, so an `async` one is rejected here rather than at runtime, where an unhandled rejection would terminate the process.
expectError(lru.set(1, 1));
expectError(lru.set('🦄', '🌈'));
expectError(lru.get(1));
expectError(lru.has(1));
expectError(lru.peek(1));
expectError(lru.delete(1));
expectError(lru.expiresIn(1));
expectError(lru.resize('10'));
expectError(lru.evict('1'));
expectError(lru.getOrInsert(1, 1));
expectError(lru.getOrInsert('🦄', '🌈'));
expectError(lru.getOrInsertComputed(1, () => 1));
expectError(lru.getOrInsertComputed('🦄', () => '🌈'));
expectError(lru.getOrInsertComputed('🦄', key => key.toUpperCase()));
expectError(lru.getOrInsertComputed('🦄', async () => 1));

// The iterator return types, written the same way the declarations are, so they hold whichever type the TypeScript in use gives `Map`: `IterableIterator` on an older compiler, `MapIterator` on a newer one. These catch a member that diverges from `Map`; a deleted declaration is not caught here, because `Map` already supplies it.
expectTypeOf(lru.keys()).toBe<ReturnType<Map<string, number>['keys']>>();
expectTypeOf(lru.values()).toBe<ReturnType<Map<string, number>['values']>>();
expectTypeOf(lru.entries()).toBe<ReturnType<Map<string, number>['entries']>>();
expectTypeOf(lru[Symbol.iterator]()).toBe<ReturnType<Map<string, number>[typeof Symbol.iterator]>>();
expectTypeOf(lru.entriesAscending()).toBe<ReturnType<Map<string, number>['entries']>>();
expectTypeOf(lru.entriesDescending()).toBe<ReturnType<Map<string, number>['entries']>>();

// The exported options type, named with and without type arguments, which is only possible because both default to `unknown`.
const options: Options<string, number> = {maxSize: 1};
new QuickLRU(options); // eslint-disable-line no-new
const bareOptions: Options = {maxSize: 1};
new QuickLRU(bareOptions); // eslint-disable-line no-new

// The per-item `maxAge` option is a number, and the computed callback has to return the value type, or the declared return of `getOrInsertComputed()` is a lie.
expectError(lru.set('🦄', 1, {maxAge: '100'}));
expectError(lru.getOrInsertComputed('🦄', () => undefined));

// A differently parameterized instance keeps its own types.
const numbers = new QuickLRU<number, string>({maxSize: 5});
expectTypeOf(numbers.get(1)).toBe<string | undefined>();
expectError(numbers.get('🦄'));
expectTypeOf(numbers.size).toBe<number>();
expectTypeOf(numbers.keys()).toBe<ReturnType<Map<number, string>['keys']>>();
expectTypeOf(numbers.values()).toBe<ReturnType<Map<number, string>['values']>>();
