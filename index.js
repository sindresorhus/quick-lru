'use strict';

class QuickLRU {
	constructor(options = {}) {
		if (!(options.maxSize && options.maxSize > 0)) {
			throw new TypeError('`maxSize` must be a number greater than 0');
		}

		if (typeof options.maxAge === 'number' && options.maxAge === 0) {
			throw new TypeError('`maxAge` must be a number greater than 0');
		}

		this.maxAge = options.maxAge || 0;
		this.maxSize = options.maxSize;
		this.onEviction = options.onEviction;
		this.cache = new Map();
		this.oldCache = new Map();
		this._size = 0;
	}

	_hasExpired(key, item) {
		if (item.expiry <= Date.now()) {
			if (typeof this.onEviction === 'function') {
				this.onEviction(key, item.value);
			}

			this.delete(key);
			return;
		}

		return item.value;
	}

	_set(key, value, expiry) {
		if (this.maxAge > 0) {
			this.cache.set(key, {
				value,
				expiry: expiry || Date.now() + this.maxAge
			});
		} else {
			this.cache.set(key, value);
		}

		this._size++;

		if (this._size >= this.maxSize) {
			this._size = 0;

			if (typeof this.onEviction === 'function') {
				for (const [key, value] of this.oldCache.entries()) {
					this.onEviction(key, value);
				}
			}

			this.oldCache = this.cache;
			this.cache = new Map();
		}
	}

	get(key) {
		if (this.cache.has(key)) {
			if (this.maxAge > 0) {
				const item = this.cache.get(key);
				return this._hasExpired(key, item);
			}

			return this.cache.get(key);
		}

		if (this.oldCache.has(key)) {
			const item = this.oldCache.get(key);
			this.oldCache.delete(key);
			if (this.maxAge > 0) {
				const value = this._hasExpired(key, item);

				if (value) {
					this._set(key, value, item.expiry);
				}

				return value;
			}

			this._set(key, item);
			return item;
		}
	}

	set(key, value) {
		if (this.cache.has(key)) {
			if (this.maxAge > 0) {
				this.cache.set(key, {
					value,
					expiry: Date.now() + this.maxAge
				});
			} else {
				this.cache.set(key, value);
			}
		} else {
			this._set(key, value);
		}

		return this;
	}

	has(key) {
		if (this.maxAge > 0) {
			return Boolean(this._hasExpired(
				key,
				this.cache.get(key) || this.oldCache.get(key)
			));
		}

		return this.cache.has(key) || this.oldCache.has(key);
	}

	peek(key) {
		if (this.cache.has(key)) {
			if (this.maxAge > 0) {
				return this._hasExpired(key, this.cache.get(key));
			}

			return this.cache.get(key);
		}

		if (this.oldCache.has(key)) {
			if (this.maxAge > 0) {
				return this._hasExpired(key, this.oldCache.get(key));
			}

			return this.oldCache.get(key);
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
		for (const item of this.cache) {
			yield item;
		}

		for (const item of this.oldCache) {
			const [key] = item;
			if (!this.cache.has(key)) {
				yield item;
			}
		}
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
