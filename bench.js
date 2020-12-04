var Stats = require("statistics/mutate");
var LRU = require("./");

//simple benchmarks, and measure standard deviation

function run(N, op, init) {
	var stats = null,
		value;
	for (var j = 0; j < 100; j++) {
		if (init) value = init(j);
		var start = Date.now();
		for (var i = 0; i < N; i++) op(value, i);
		stats = Stats(stats, N / (Date.now() - start));
	}
	return stats;
}

//set 1000 random items, then read 10000 items.
//since they are random, there will be misses as well as hits
console.log(
	"GET",
	run(
		100000,
		function(lru, n) {
			lru.get(~~(Math.random() * 1000));
			//  lru.set(n, Math.random())
		},
		function() {
			var lru = new LRU({ maxSize: 1000 });
			for (var i = 0; i++; i < 1000)
				lru.set(~~(Math.random() * 1000), Math.random());
			return lru;
		}
	)
);

//set 100000 random values into LRU for 1000 values.
//this means 99/100 should be evictions
console.log(
	"SET",
	run(
		100000,
		function(lru, n) {
			lru.set(~~(Math.random() * 100000), Math.random());
		},
		function() {
			return new LRU({ maxSize: 1000 });
		}
	)
);
