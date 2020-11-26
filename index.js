'use strict';

class QuickLRU {
	constructor(options = {}) {
		if (!(options.maxSize && options.maxSize > 0)) {
			throw new TypeError('`maxSize` must be a number greater than 0');
		}

		if (typeof options.maxAge === 'number' && options.maxAge === 0) {
			throw new TypeError('`maxAge` must be a number greater than 0');
		}

		this.maxSize = options.maxSize;
		this.maxAge = options.maxAge || 0;
		this.onEviction = options.onEviction;
		this.cache = new Map();
		this.oldCache = new Map();
		this._size = 0;
	}

	_emitEvictions(cache) {
		if (typeof this.onEviction !== 'function') {
			return;
		}

		for (const [key, item] of cache) {
			this.onEviction(key, this.maxAge > 0 ? item.value : item);
		}
	}

	_deleteIfExpired(key, item) {
		if (item.expiry <= Date.now()) {
			if (typeof this.onEviction === 'function') {
				this.onEviction(key, item.value);
			}

			return this.delete(key);
		}

		return false;
	}

	_getOrDeleteIfExpired(key, item) {
		if (this._deleteIfExpired(key, item)) {
			return;
		}

		return item.value;
	}

	_set(key, value, updateValue = false, expiry = Date.now() + this.maxAge) {
		this.cache.set(key, this.maxAge > 0 ? {
			value,
			expiry
		} : value);

		if (updateValue === false) {
			this._size++;

			if (this._size >= this.maxSize) {
				this._size = 0;
				this._emitEvictions(this.oldCache);

				this.oldCache = this.cache;
				this.cache = new Map();
			}
		}
	}

	_peek(key, cache) {
		const item = cache.get(key);

		if (this.maxAge > 0) {
			return this._getOrDeleteIfExpired(key, item);
		}

		return item;
	}

	_moveToRecent(key, value, expiry) {
		this.oldCache.delete(key);
		this._set(key, value, false, expiry);
	}

	get(key) {
		if (this.cache.has(key)) {
			const item = this.cache.get(key);

			return this.maxAge > 0 ? this._getOrDeleteIfExpired(key, item) : item;
		}

		if (this.oldCache.has(key)) {
			const item = this.oldCache.get(key);
			if (this.maxAge > 0) {
				if (!this._deleteIfExpired(key, item)) {
					_moveToRecent(key, item.value, item.expiry);
					return item.value;
				}

				return;
			}

			_moveToRecent(key, item.value, item.expiry);
			return item;
		}
	}

	set(key, value) {
		this._set(key, value, this.cache.has(key));
		return this;
	}

	has(key) {
		if (this.maxAge > 0) {
			const item = this.cache.get(key) || this.oldCache.get(key);

			return !this._deleteIfExpired(
				key,
				item
			);
		}

		return this.cache.has(key) || this.oldCache.has(key);
	}

	peek(key) {
		if (this.cache.has(key)) {
			return this._peek(key, this.cache);
		}

		if (this.oldCache.has(key)) {
			return this._peek(key, this.oldCache);
		}
	}

	delete(key) {
		const deleted = this.cache.delete(key);
		if (deleted) {
			this._size--;
		}

		return this.oldCache.delete(key) || deleted;
	}

	clear() {
		this.cache.clear();
		this.oldCache.clear();
		this._size = 0;
	}

	resize(newSize) {
		if (!(newSize && newSize > 0)) {
			throw new TypeError('`maxSize` must be a number greater than 0');
		}

		const items = [...this.entriesAscending()];
		const removeCount = items.length - newSize;
		if (removeCount < 0) {
			this.cache = new Map(items);
			this.oldCache = new Map();
			this._size = items.length;
		} else {
			if (removeCount > 0) {
				this._emitEvictions(items.slice(0, removeCount));
			}

			this.oldCache = new Map(items.slice(removeCount));
			this.cache = new Map();
			this._size = 0;
		}

		this.maxSize = newSize;
	}

	* keys() {
		for (const [key] of this) {
			yield key;
		}
	}

	* values() {
		for (const [, value] of this) {
			yield value;
		}
	}

	* [Symbol.iterator]() {
		yield * this.cache;

		for (const item of this.oldCache) {
			const [key] = item;
			if (!this.cache.has(key)) {
				yield item;
			}
		}
	}

	* entriesDescending() {
		let items = [...this.cache];
		for (let i = items.length - 1; i >= 0; --i) {
			yield items[i];
		}

		items = [...this.oldCache];
		for (let i = items.length - 1; i >= 0; --i) {
			const item = items[i];
			const [key] = item;
			if (!this.cache.has(key)) {
				yield item;
			}
		}
	}

	* entriesAscending() {
		for (const item of this.oldCache) {
			const [key] = item;
			if (!this.cache.has(key)) {
				yield item;
			}
		}

		yield * this.cache;
	}

	get size() {
		if (!this._size) {
			return this.oldCache.size;
		}

		let oldCacheSize = 0;
		for (const key of this.oldCache.keys()) {
			if (!this.cache.has(key)) {
				oldCacheSize++;
			}
		}

		return Math.min(this._size + oldCacheSize, this.maxSize);
	}
}

module.exports = QuickLRU;
