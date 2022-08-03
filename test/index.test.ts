import { describe, expect, it, beforeEach } from 'vitest';
import cacheManager from 'cache-manager';
import { redisStore, RedisCache } from '../src';

let redisCache: RedisCache;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let customRedisCache: RedisCache;

const config = {
  url: 'redis://localhost:6379',
  ttl: 0,
};

beforeEach(async () => {
  redisCache = cacheManager.caching({
    store: await redisStore(config),
    ...config,
  }) as RedisCache;

  const conf = {
    ...config,
    isCacheableValue: (val: unknown) => {
      if (val === undefined) {
        // allow undefined
        return true;
      } else if (val === 'FooBarString') {
        // disallow FooBarString
        return false;
      }
      return redisCache.store.isCacheableValue(val);
    },
  };
  customRedisCache = cacheManager.caching({
    store: await redisStore(conf),
    ...conf,
  }) as RedisCache;
});

describe('set', () => {
  it('should store a value without ttl', async () => {
    expect(await redisCache.set('foo', 'bar')).toEqual('bar');
  });

  it('should store a value with a specific ttl', () =>
    expect(redisCache.set('foo', 'bar', config.ttl)).resolves.toEqual('bar'));

  it('should store a value with a infinite ttl', () =>
    expect(redisCache.set('foo', 'bar', { ttl: 0 })).resolves.toEqual('bar'));

  it('should not be able to store a null value (not cacheable)', () =>
    expect(redisCache.set('foo2', null)).rejects.toBeDefined());

  it('should store a value without callback', async () => {
    const value = 'baz';
    await redisCache.set('foo', value);
    await expect(redisCache.get('foo')).resolves.toEqual(value);
  });

  it('should not store an invalid value', () =>
    expect(redisCache.set('foo1', undefined)).rejects.toStrictEqual(
      new Error('"undefined" is not a cacheable value'),
    ));

  it('should store an undefined value if permitted by isCacheableValue', async () => {
    expect(customRedisCache.store.isCacheableValue(undefined)).toBe(true);
    await customRedisCache.set('foo3', undefined);
  });

  it('should not store a value disallowed by isCacheableValue', async () => {
    expect(customRedisCache.store.isCacheableValue('FooBarString')).toBe(false);
    await expect(
      customRedisCache.set('foobar', 'FooBarString'),
    ).rejects.toBeDefined();
  });

  it('should return an error if there is an error acquiring a connection', async () => {
    await redisCache.store.getClient().disconnect();
    await expect(redisCache.set('foo', 'bar')).rejects.toBeDefined();
  });
});

describe('mset', () => {
  it('should store a value without ttl', () =>
    redisCache.store.mset([
      ['foo', 'bar'],
      ['foo2', 'bar2'],
    ]));

  it(
    'should store a value with a specific ttl',
    () =>
      redisCache.store.mset(
        [
          ['foo', 'bar'],
          ['foo2', 'bar2'],
        ],
        60,
      ),
    100000,
  );

  it('should store a value with a infinite ttl', async () => {
    await redisCache.store.mset([
      ['foo', 'bar'],
      ['foo2', 'bar2'],
    ]);
    await expect(redisCache.store.ttl('foo')).resolves.toEqual(-1);
  });

  it('should not be able to store a null value (not cacheable)', () =>
    expect(redisCache.store.mset([['foo2', null]])).rejects.toBeDefined());

  it('should store a value without callback', async () => {
    await redisCache.store.mset([
      ['foo', 'baz'],
      ['foo2', 'baz2'],
    ]);
    await expect(redisCache.store.mget('foo', 'foo2')).resolves.toStrictEqual([
      'baz',
      'baz2',
    ]);
  });

  it('should not store an invalid value', () =>
    expect(redisCache.store.mset([['foo1', undefined]])).rejects.toBeDefined());

  it('should store an undefined value if permitted by isCacheableValue', async () => {
    expect(customRedisCache.store.isCacheableValue(undefined)).toBe(true);
    await customRedisCache.store.mset([
      ['foo3', undefined],
      ['foo4', undefined],
    ]);
    await expect(
      customRedisCache.store.mget('foo3', 'foo4'),
    ).resolves.toStrictEqual(['undefined', 'undefined']);
  });

  it('should not store a value disallowed by isCacheableValue', async () => {
    expect(customRedisCache.store.isCacheableValue('FooBarString')).toBe(false);
    await expect(
      customRedisCache.store.mset([['foobar', 'FooBarString']]),
    ).rejects.toBeDefined();
  });

  it('should return an error if there is an error acquiring a connection', async () => {
    await redisCache.store.getClient().disconnect();
    await expect(redisCache.store.mset([['foo', 'bar']])).rejects.toBeDefined();
  });
});

// describe('get', () => {
//   it('should return a promise', (done) => {
//     expect(redisCache.get('foo')).toBeInstanceOf(Promise);
//     done();
//   });
//
//   it('should resolve promise on success', (done) => {
//     redisCache.set('foo', 'bar')
//       .then(() => redisCache.get('foo'))
//       .then(result => {
//         expect(result).toEqual('bar');
//         done();
//       });
//   });
//
//   it('should reject promise on error', (done) => {
//     const client = redisCache.store.getClient();
//     client.get = (key, cb) => cb(new Error('Something went wrong'));
//
//     redisCache.get('foo')
//       .catch((err) => {
//         expect(err.message).toEqual('Something went wrong');
//         done();
//       })
//   });
//
//   it('should retrieve a value for a given key', (done) => {
//     const value = 'bar';
//     redisCache.set('foo', value, () => {
//       redisCache.get('foo', (err, result) => {
//         expect(err).toEqual(null);
//         expect(result).toEqual(value);
//         done();
//       });
//     });
//   });
//
//   it('should retrieve a value for a given key if options provided', (done) => {
//     const value = 'bar';
//     redisCache.set('foo', value, () => {
//       redisCache.get('foo', {}, (err, result) => {
//         expect(err).toEqual(null);
//         expect(result).toEqual(value);
//         done();
//       });
//     });
//   });
//
//   it('should return null when the key is invalid', (done) => {
//     redisCache.get('invalidKey', (err, result) => {
//       expect(err).toEqual(null);
//       expect(result).toEqual(null);
//       done();
//     });
//   });
//
//   it('should return an error if there is an error acquiring a connection', (done) => {
//     redisCache.store.getClient().end(true);
//     redisCache.get('foo', (err) => {
//       expect(err).not.toEqual(null);
//       done();
//     });
//   });
// });
//
// describe('mget', () => {
//   it('should return a promise', () => {
//     expect(redisCache.mget('foo', 'foo2')).toBeInstanceOf(Promise);
//   });
//
//   it('should resolve promise on success', (done) => {
//     redisCache.mset('foo', 'bar')
//       .then(() => redisCache.mget('foo'))
//       .then(result => {
//         expect(result).toEqual(['bar']);
//         done();
//       });
//   });
//
//   it('should reject promise on error', (done) => {
//     const client = redisCache.store.getClient();
//     client.mget = (key, cb) => cb(new Error('Something went wrong'));
//
//     redisCache.mget('foo')
//       .catch((err) => {
//         expect(err.message).toEqual('Something went wrong');
//         done();
//       })
//   });
//
//   it('should retrieve a value for a given key', (done) => {
//     const value = 'bar';
//     const value2 = 'bar2';
//     redisCache.mset('foo', value, 'foo2', value2, () => {
//       redisCache.mget('foo', 'foo2', (err, result) => {
//         expect(err).toEqual(null);
//         expect(result[0]).toEqual(value);
//         expect(result[1]).toEqual(value2);
//         done();
//       });
//     });
//   });
//
//   it('should retrieve a value for a given key if options provided', (done) => {
//     const value = 'bar';
//     redisCache.mset('foo', value, () => {
//       redisCache.mget('foo', { someConfig: true }, (err, result) => {
//         expect(err).toEqual(null);
//         expect(result).toEqual([value]);
//         done();
//       });
//     });
//   });
//
//   it('should return null when the key is invalid', (done) => {
//     redisCache.mget('invalidKey', 'otherInvalidKey', (err, result) => {
//       expect(err).toEqual(null);
//       expect(result[0]).toEqual(null);
//       expect(result[1]).toEqual(null);
//       done();
//     });
//   });
//
//   it('should return an error if there is an error acquiring a connection', (done) => {
//     redisCache.store.getClient().end(true);
//     redisCache.mget('foo', (err) => {
//       expect(err).not.toEqual(null);
//       done();
//     });
//   });
// });
//
// describe('del', () => {
//   it('should return a promise', (done) => {
//     expect(redisCache.del('foo')).toBeInstanceOf(Promise);
//     done();
//   });
//
//   it('should delete a value for a given key', (done) => {
//     redisCache.set('foo', 'bar', () => {
//       redisCache.del('foo', (err) => {
//         expect(err).toEqual(null);
//         redisCache.get('foo', (err, result) => {
//           expect(result).toEqual(null);
//           done();
//         });
//       });
//     });
//   });
//
//   it('should delete a unlimited number of keys', (done) => {
//     redisCache.mset('foo', 'bar', 'foo2', 'bar2', () => {
//       redisCache.del('foo', 'foo2', (err) => {
//         expect(err).toEqual(null);
//         redisCache.mget('foo', 'foo2', (err, result) => {
//           expect(result[0]).toEqual(null);
//           expect(result[1]).toEqual(null);
//           done();
//         });
//       });
//     });
//   });
//
//   it('should delete an Array of keys', (done) => {
//     redisCache.mset('foo', 'bar', 'foo2', 'bar2', () => {
//       redisCache.del(['foo', 'foo2'], (err) => {
//         expect(err).toEqual(null);
//         redisCache.mget('foo', 'foo2', (err, result) => {
//           expect(result[0]).toEqual(null);
//           expect(result[1]).toEqual(null);
//           done();
//         });
//       });
//     });
//   });
//
//   it('should delete a value for a given key without callback', (done) => {
//     redisCache.set('foo', 'bar', () => {
//       redisCache.del('foo');
//       done();
//     });
//   });
//
//   it('should return an error if there is an error acquiring a connection', (done) => {
//     redisCache.store.getClient().end(true);
//     redisCache.del('foo', (err) => {
//       expect(err).not.toEqual(null);
//       done();
//     });
//   });
// });
//
// describe('reset', () => {
//   it('should return a promise', (done) => {
//     expect(redisCache.reset()).toBeInstanceOf(Promise);
//     done();
//   });
//
//   it('should flush underlying db', (done) => {
//     redisCache.reset((err) => {
//       expect(err).toEqual(null);
//       done();
//     });
//   });
//
//   it('should flush underlying db without callback', (done) => {
//     redisCache.reset();
//     done();
//   });
//
//   it('should return an error if there is an error acquiring a connection', (done) => {
//     redisCache.store.getClient().end(true);
//     redisCache.reset((err) => {
//       expect(err).not.toEqual(null);
//       done();
//     });
//   });
// });
//
// describe('ttl', () => {
//   it('should return a promise', (done) => {
//     expect(redisCache.ttl('foo')).toBeInstanceOf(Promise);
//     done();
//   });
//
//   it('should retrieve ttl for a given key', (done) => {
//     redisCache.set('foo', 'bar', () => {
//       redisCache.ttl('foo', (err, ttl) => {
//         expect(err).toEqual(null);
//         expect(ttl).toEqual(config.ttl);
//         done();
//       });
//     });
//   });
//
//   it('should retrieve ttl for an invalid key', (done) => {
//     redisCache.ttl('invalidKey', (err, ttl) => {
//       expect(err).toEqual(null);
//       expect(ttl).not.toEqual(null);
//       done();
//     });
//   });
//
//   it('should return an error if there is an error acquiring a connection', (done) => {
//     redisCache.store.getClient().end(true);
//     redisCache.ttl('foo', (err) => {
//       expect(err).not.toEqual(null);
//       done();
//     });
//   });
// });
//
// describe('keys', () => {
//   it('should return a promise', (done) => {
//     expect(redisCache.keys('foo')).toBeInstanceOf(Promise);
//     done();
//   });
//
//   it('should resolve promise on success', (done) => {
//     redisCache.set('foo', 'bar')
//       .then(() => redisCache.keys('f*'))
//       .then(result => {
//         expect(result).toEqual(['foo']);
//         done();
//       });
//   });
//
//   it('should reject promise on error', (done) => {
//     const client = redisCache.store.getClient();
//     client.keys = (key, cb) => cb(new Error('Something went wrong'));
//
//     redisCache.keys('f*')
//       .catch((err) => {
//         expect(err.message).toEqual('Something went wrong');
//         done();
//       })
//   });
//
//   it('should return an array of keys for the given pattern', (done) => {
//     redisCache.set('foo', 'bar', () => {
//       redisCache.keys('f*', (err, arrayOfKeys) => {
//         expect(err).toEqual(null);
//         expect(arrayOfKeys).not.toEqual(null);
//         expect(arrayOfKeys.indexOf('foo')).not.toEqual(-1);
//         done();
//       });
//     });
//   });
//
//   it('should return an array of all keys if called without a pattern', (done) => {
//     redisCache.mset('foo', 'bar', 'foo2', 'bar2', 'foo3', 'bar3')
//       .then(() => redisCache.keys())
//       .then(result => {
//         expect(result).toHaveLength(3);
//         done();
//       });
//   });
//
//   it('should return an array of keys without pattern', (done) => {
//     redisCache.set('foo', 'bar', () => {
//       redisCache.keys((err, arrayOfKeys) => {
//         expect(err).toEqual(null);
//         expect(arrayOfKeys).not.toEqual(null);
//         expect(arrayOfKeys.indexOf('foo')).not.toEqual(-1);
//         done();
//       });
//     });
//   });
//
//   it('should return an error if there is an error acquiring a connection', (done) => {
//     redisCache.store.getClient().end(true);
//     redisCache.keys('foo', (err) => {
//       expect(err).not.toEqual(null);
//       done();
//     });
//   });
// });
//
// describe('isCacheableValue', () => {
//   it('should return true when the value is not undefined', (done) => {
//     expect(redisCache.store.isCacheableValue(0)).toBe(true);
//     expect(redisCache.store.isCacheableValue(100)).toBe(true);
//     expect(redisCache.store.isCacheableValue('')).toBe(true);
//     expect(redisCache.store.isCacheableValue('test')).toBe(true);
//     done();
//   });
//
//   it('should return false when the value is undefined', (done) => {
//     expect(redisCache.store.isCacheableValue(undefined)).toBe(false);
//     done();
//   });
//
//   it('should return false when the value is null', (done) => {
//     expect(redisCache.store.isCacheableValue(null)).toBe(false);
//     done();
//   });
// });
//
// describe('redis error event', () => {
//   it('should return an error when the redis server is unavailable', (done) => {
//     redisCache.store.getClient().on('error', (err) => {
//       expect(err).not.toEqual(null);
//       done();
//     });
//     redisCache.store.getClient().emit('error', 'Something unexpected');
//   });
// });
//
// describe('overridable isCacheableValue function', () => {
//   let redisCache2;
//
//   beforeEach(() => {
//     redisCache2 = cacheManager.caching({
//       store: redisStore,
//       auth_pass: config.auth_pass,
//       isCacheableValue: () => {
//         return 'I was overridden';
//       }
//     });
//   });
//
//   it('should return its return value instead of the built-in function', (done) => {
//     expect(redisCache2.store.isCacheableValue(0)).toEqual('I was overridden');
//     done();
//   });
// });
//
// describe('defaults are set by redis itself', () => {
//   let redisCache2;
//
//   beforeEach(() => {
//     redisCache2 = cacheManager.caching({
//       store: redisStore,
//       auth_pass: config.auth_pass,
//     });
//   });
//
//   it('should default the host to `127.0.0.1`', () => {
//     expect(redisCache2.store.getClient().connection_options.host).toEqual('127.0.0.1');
//   });
//
//   it('should default the port to 6379', () => {
//     expect(redisCache2.store.getClient().connection_options.port).toEqual(6379);
//   });
// });
//
// describe('wrap function', () => {
//   // Simulate retrieving a user from a database
//   function getUser(id, cb) {
//     setTimeout(() => {
//       cb(null, { id: id });
//     }, 100);
//   }
//
//   // Simulate retrieving a user from a database with Promise
//   function getUserPromise(id) {
//     return new Promise((resolve) => {
//       setTimeout(() => {
//         resolve({ id: id });
//       }, 100);
//     });
//   }
//
//   it('should be able to cache objects', (done) => {
//     const userId = 123;
//
//     // First call to wrap should run the code
//     redisCache.wrap('wrap-user', (cb) => {
//       getUser(userId, cb);
//     }, (err, user) => {
//       expect(user.id).toEqual(userId);
//
//       // Second call to wrap should retrieve from cache
//       redisCache.wrap('wrap-user', (cb) => {
//         getUser(userId + 1, cb);
//       }, (err, user) => {
//         expect(user.id).toEqual(userId);
//         done();
//       });
//     });
//   });
//
//   it('should work with promises', () => {
//     const userId = 123;
//
//     // First call to wrap should run the code
//     return redisCache
//       .wrap(
//         'wrap-promise',
//         () => getUserPromise(userId),
//       )
//       .then((user) => {
//         expect(user.id).toEqual(userId);
//
//         // Second call to wrap should retrieve from cache
//         return redisCache.wrap(
//           'wrap-promise',
//           () => getUserPromise(userId + 1),
//         )
//           .then((user) => expect(user.id).toEqual(userId));
//       });
//   });
// });