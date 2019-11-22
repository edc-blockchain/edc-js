"use strict";

var _bluebird = require("bluebird");

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Immutable = require("immutable");

var _require = require("edc-ws-js"),
    Apis = _require.Apis;

var _require2 = require("./ChainTypes"),
    object_type = _require2.object_type,
    impl_object_type = _require2.impl_object_type;

var ChainValidation = require("./ChainValidation");
var BigInteger = require("bigi");
var moment = require('moment');
var ee = require("./EmitterInstance");

var emitter = ee.emitter();
var op_history = parseInt(object_type.operation_history, 10);
var limit_order = parseInt(object_type.limit_order, 10);
var call_order = parseInt(object_type.call_order, 10);
var proposal = parseInt(object_type.proposal, 10);
var balance_type = parseInt(object_type.balance, 10);
var vesting_balance_type = parseInt(object_type.vesting_balance, 10);
var witness_object_type = parseInt(object_type.witness, 10);
var worker_object_type = parseInt(object_type.worker, 10);
var committee_member_object_type = parseInt(object_type.committee_member, 10);
var account_object_type = parseInt(object_type.account, 10);
var asset_object_type = parseInt(object_type.asset, 10);

var order_prefix = "1." + limit_order + ".";
var call_order_prefix = "1." + call_order + ".";
var proposal_prefix = "1." + proposal + ".";
var balance_prefix = "2." + parseInt(impl_object_type.account_balance, 10) + ".";
var account_stats_prefix = "2." + parseInt(impl_object_type.account_statistics, 10) + ".";
var asset_dynamic_data_prefix = "2." + parseInt(impl_object_type.asset_dynamic_data, 10) + ".";
var bitasset_data_prefix = "2." + parseInt(impl_object_type.asset_bitasset_data, 10) + ".";
var vesting_balance_prefix = "1." + vesting_balance_type + ".";
var witness_prefix = "1." + witness_object_type + ".";
var worker_prefix = "1." + worker_object_type + ".";
var committee_prefix = "1." + committee_member_object_type + ".";
var asset_prefix = "1." + asset_object_type + ".";
var account_prefix = "1." + account_object_type + ".";

var DEBUG = JSON.parse(process.env.npm_config__graphene_chain_chain_debug || false);

/**
 *  @brief maintains a local cache of blockchain state
 *
 *  The ChainStore maintains a local cache of blockchain state and exposes
 *  an API that makes it easy to query objects and receive updates when
 *  objects are available.
 */

var ChainStore = function () {
	function ChainStore() {
		_classCallCheck(this, ChainStore);

		/** tracks everyone who wants to receive updates when the cache changes */
		this.subscribers = new Set();
		this.subscribed = false;
		this.clearCache();
		this.progress = 0;
		// this.chain_time_offset is used to estimate the blockchain time
		this.chain_time_offset = [];
		this.dispatchFrequency = 40;
	}

	/**
  * Clears all cached state.  This should be called any time the network connection is
  * reset.
  */


	_createClass(ChainStore, [{
		key: "clearCache",
		value: function clearCache() {
			this.objects_by_id = Immutable.Map();
			this.accounts_by_name = Immutable.Map();
			this.accounts_by_address = Immutable.Map();
			this.assets_by_symbol = Immutable.Map();
			this.account_ids_by_key = Immutable.Map();
			this.balance_objects_by_address = Immutable.Map();
			this.get_account_refs_of_keys_calls = Immutable.Set();
			this.account_history_requests = new Map(); ///< tracks pending history requests
			this.witness_by_account_id = new Map();
			this.committee_by_account_id = new Map();
			this.objects_by_vote_id = new Map();
			this.fetching_get_full_accounts = new Map();
			this.fetching_by_address = new Map();
			this.account_sum_transfers_by_asset = Immutable.Map();
			this.is_actual_history = new Map();
			this.get_asset_await = Immutable.Map();
			this.get_asset_by_symbol_promise = {};
			this.get_asset_by_id_promise = {};
			this.transfers_by_account = Immutable.Map();
			this.all_transfers_by_account = Immutable.Map();
			this.fetching_transfers_by_account = Immutable.Map();
			this.blocks = Immutable.Map();
			this.mining_period_transfers = Immutable.List();
			this.fetching_names_or_ids = new Set();
		}
	}, {
		key: "resetCache",
		value: function resetCache() {
			this.subscribed = false;
			this.clearCache();
			this.head_block_time_string = null;
			this.init().then(function (result) {
				console.log("resetCache init success");
			}).catch(function (err) {
				console.log("resetCache init error:", err);
			});
		}
	}, {
		key: "checkIsInCache",
		value: function checkIsInCache(id) {
			return this.objects_by_id.has(id);
		}
	}, {
		key: "checkIsActualHistory",
		value: function checkIsActualHistory(id) {
			return this.is_actual_history.has(id) && this.is_actual_history.get(id);
		}
	}, {
		key: "setAsActualHistory",
		value: function setAsActualHistory(id) {
			this.is_actual_history = this.is_actual_history.set(id, true);
		}
	}, {
		key: "setDispatchFrequency",
		value: function setDispatchFrequency(freq) {
			this.dispatchFrequency = freq;
		}
	}, {
		key: "init",
		value: function init() {
			var _this = this;

			var reconnectCounter = 0;
			var _init = function _init(resolve, reject) {
				var db_api = Apis.instance().db_api();
				if (!db_api) {
					return reject(new Error("Api not found, please initialize the api instance before calling the ChainStore"));
				}
				return db_api.exec("get_objects", [["2.1.0"]]).then(function (optional_objects) {
					var _loop = function _loop(i) {
						var optional_object = optional_objects[i];
						if (optional_object) {

							_this._updateObject(optional_object, true);

							var head_time = new Date(optional_object.time + "+00:00").getTime();
							_this.head_block_time_string = optional_object.time;
							_this.chain_time_offset.push(new Date().getTime() - timeStringToDate(optional_object.time).getTime());
							var now = new Date().getTime();
							var delta = (now - head_time) / 1000;
							var start = Date.parse('Sep 1, 2015');
							var progress_delta = head_time - start;
							_this.progress = progress_delta / (now - start);

							// if(delta < 60) {
							Apis.instance().db_api().exec("set_subscribe_callback", [_this.onUpdate.bind(_this), true]).then(function (v) {
								// console.log("synced and subscribed, chainstore ready");
								_this.subscribed = true;
								resolve();

								var maintenanceTime = parseInt(moment.utc(optional_object.next_maintenance_time).format('X'));
								var now = parseInt(moment().format('X'));

								// setTimeout(() => {
								// 	console.log('cancel_all_subscriptions');
								// 	Apis.instance().db_api().exec("cancel_all_subscriptions", []).then(() => {
								// 		setTimeout(_init.bind(this, resolve, reject), (Math.floor(Math.random() * (480 - 180)) + 180) * 1000);
								// 	});
								// 	this.account_sum_transfers_by_asset = new Map();
								// }, (maintenanceTime - now - 2) * 1000);
							}).catch(function (error) {
								reject(error);
								console.log("Error: ", error);
							});
							// } else {
							// 	console.log("not yet synced, retrying in 1s");
							// 	reconnectCounter++;
							// 	if(reconnectCounter > 10) {
							// 		throw new Error("ChainStore sync error, please check your system clock");
							// 	}
							// 	setTimeout(_init.bind(this, resolve, reject), 1000);
							// }
						} else {
							setTimeout(_init.bind(_this, resolve, reject), 1000);
						}
					};

					//if(DEBUG) console.log('... optional_objects',optional_objects ? optional_objects[0].id : null)
					for (var i = 0; i < optional_objects.length; i++) {
						_loop(i);
					}
				}).catch(function (error) {
					// in the event of an error clear the pending state for id
					console.log('!!! Chain API error', error);
					_this.objects_by_id = _this.objects_by_id.delete("2.1.0");
					reject(error);
				});
			};

			return new Promise(function (resolve, reject) {
				return _init(resolve, reject);
			});
		}
	}, {
		key: "onUpdate",
		value: function onUpdate(updated_objects) /// map from account id to objects
		{
			for (var a = 0; a < updated_objects.length; ++a) {
				for (var i = 0; i < updated_objects[a].length; ++i) {
					var obj = updated_objects[a][i];

					if (ChainValidation.is_object_id(obj)) {
						/// the object was removed
						// Cancelled limit order, emit event for MarketStore to update it's state
						if (obj.search(order_prefix) == 0) {
							var old_obj = this.objects_by_id.get(obj);
							if (!old_obj) {
								return;
							}
							emitter.emit('cancel-order', old_obj.get("id"));
							var account = this.objects_by_id.get(old_obj.get("seller"));
							if (account && account.has("orders")) {
								var limit_orders = account.get("orders");
								if (account.get("orders").has(obj)) {
									account = account.set("orders", limit_orders.delete(obj));
									this.objects_by_id = this.objects_by_id.set(account.get("id"), account);
								}
							}
						}

						// Update nested call_order inside account object
						if (obj.search(call_order_prefix) == 0) {

							var _old_obj = this.objects_by_id.get(obj);
							if (!_old_obj) {
								return;
							}
							emitter.emit('close-call', _old_obj.get("id"));
							var _account = this.objects_by_id.get(_old_obj.get("borrower"));
							if (_account && _account.has("call_orders")) {
								var call_orders = _account.get("call_orders");
								if (_account.get("call_orders").has(obj)) {
									_account = _account.set("call_orders", call_orders.delete(obj));
									this.objects_by_id = this.objects_by_id.set(_account.get("id"), _account);
								}
							}
						}

						// Remove the object
						this.objects_by_id = this.objects_by_id.set(obj, null);
					} else this._updateObject(obj, false);
				}
			}
			this.notifySubscribers();
		}
	}, {
		key: "notifySubscribers",
		value: function notifySubscribers() {
			var _this2 = this;

			// Dispatch at most only once every x milliseconds
			if (!this.dispatched) {
				this.dispatched = true;
				setTimeout(function () {
					_this2.dispatched = false;
					_this2.subscribers.forEach(function (callback) {
						callback();
					});
				}, this.dispatchFrequency);
			}
		}

		/**
   *  Add a callback that will be called anytime any object in the cache is updated
   */

	}, {
		key: "subscribe",
		value: function subscribe(callback) {
			if (this.subscribers.has(callback)) console.error("Subscribe callback already exists", callback);
			this.subscribers.add(callback);
		}

		/**
   *  Remove a callback that was previously added via subscribe
   */

	}, {
		key: "unsubscribe",
		value: function unsubscribe(callback) {
			if (!this.subscribers.has(callback)) console.error("Unsubscribe callback does not exists", callback);
			this.subscribers.delete(callback);
		}

		/** Clear an object from the cache to force it to be fetched again. This may
   * be useful if a query failed the first time and the wallet has reason to believe
   * it may succeede the second time.
   */

	}, {
		key: "clearObjectCache",
		value: function clearObjectCache(id) {
			this.objects_by_id = this.objects_by_id.delete(id);
		}

		/**
   * There are three states an object id could be in:
   *
   * 1. undefined       - returned if a query is pending
   * 3. defined         - return an object
   * 4. null            - query return null
   *
   */

	}, {
		key: "getObject",
		value: function getObject(id) {
			var force = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

			if (id == '1.2.20') {
				return Immutable.fromJS({
					name: 'edinar',
					id: '1.2.20'
				});
			}
			if (!ChainValidation.is_object_id(id)) throw Error("argument is not an object id: " + JSON.stringify(id));

			var result = this.objects_by_id.get(id);
			if (result === undefined || force) return this.fetchObject(id, force);
			if (result === true) return undefined;

			return result;
		}

		/**
   *  @return undefined if a query is pending
   *  @return null if id_or_symbol has been queired and does not exist
   *  @return object if the id_or_symbol exists
   */

	}, {
		key: "getAsset",
		value: function getAsset(id_or_symbol) {
			var _this3 = this;

			if (!id_or_symbol) return null;

			if (ChainValidation.is_object_id(id_or_symbol)) {
				var asset = this.getObject(id_or_symbol);

				if (asset && asset.get("bitasset") && !asset.getIn(["bitasset", "current_feed"])) {
					return undefined;
				}
				return asset;
			}

			/// TODO: verify id_or_symbol is a valid symbol name

			var asset_id = this.assets_by_symbol.get(id_or_symbol);

			if (ChainValidation.is_object_id(asset_id)) {
				var _asset = this.getObject(asset_id);

				if (_asset && _asset.get("bitasset") && !_asset.getIn(["bitasset", "current_feed"])) {
					return undefined;
				}
				return _asset;
			}

			if (asset_id === null) return null;

			if (asset_id === true) return undefined;

			if (this.get_asset_await.has(id_or_symbol) && this.get_asset_await.get(id_or_symbol)) return undefined;
			this.get_asset_await = this.get_asset_await.set(id_or_symbol, true);
			Apis.instance().db_api().exec("lookup_asset_symbols", [[id_or_symbol]]).then(function (asset_objects) {
				// console.log( "lookup symbol ", id_or_symbol )
				_this3.get_asset_await = _this3.get_asset_await.set(id_or_symbol, false);
				if (asset_objects.length && asset_objects[0]) _this3._updateObject(asset_objects[0], true);else {
					_this3.assets_by_symbol = _this3.assets_by_symbol.set(id_or_symbol, null);
					_this3.notifySubscribers();
				}
			}).catch(function (error) {
				console.log("Error: ", error);
				_this3.assets_by_symbol = _this3.assets_by_symbol.delete(id_or_symbol);
			});

			return undefined;
		}
	}, {
		key: "getAssetBySymbol",
		value: function getAssetBySymbol(symbol) {
			var _this4 = this;

			return new Promise(function (success, fail) {
				if (_this4.get_asset_by_symbol_promise[symbol]) {
					return _this4.get_asset_by_symbol_promise[symbol].push([success, fail]);
				}
				_this4.get_asset_by_symbol_promise[symbol] = [[success, fail]];
				var asset_id = _this4.assets_by_symbol.get(symbol);
				if (asset_id) return _this4.getAssetById(asset_id);

				Apis.instance().db_api().exec("lookup_asset_symbols", [[symbol]]).then(function (asset_objects) {
					if (!asset_objects.length || !asset_objects[0]) {
						_this4.get_asset_by_symbol_promise[symbol].forEach(function (_ref) {
							var _ref2 = _slicedToArray(_ref, 2),
							    s = _ref2[0],
							    f = _ref2[1];

							return s(null);
						});
						return delete _this4.get_asset_by_symbol_promise[symbol];
					}
					_this4.assets_by_symbol = _this4.assets_by_symbol.set(symbol, asset_objects[0].id);

					var asset = asset_objects[0];
					var result = _this4._updateObject(asset, true);
					_this4.get_asset_by_symbol_promise[symbol].forEach(function (_ref3) {
						var _ref4 = _slicedToArray(_ref3, 2),
						    s = _ref4[0],
						    f = _ref4[1];

						return s(result);
					});
					delete _this4.get_asset_by_symbol_promise[symbol];
				}).catch(function (error) {
					_this4.get_asset_by_symbol_promise[symbol].forEach(function (_ref5) {
						var _ref6 = _slicedToArray(_ref5, 2),
						    s = _ref6[0],
						    f = _ref6[1];

						return f(error);
					});
					return delete _this4.get_asset_by_symbol_promise[symbol];
				});
			});
		}
	}, {
		key: "getAssetById",
		value: function getAssetById(asset_id) {
			var _this5 = this;

			return new Promise(function (success, fail) {
				if (_this5.get_asset_by_id_promise[asset_id]) {
					return _this5.get_asset_by_id_promise[asset_id].push([success, fail]);
				}
				_this5.get_asset_by_id_promise[asset_id] = [[success, fail]];
				if (_this5.objects_by_id.get(asset_id)) {
					_this5.get_asset_by_id_promise[asset_id].forEach(function (_ref7) {
						var _ref8 = _slicedToArray(_ref7, 2),
						    s = _ref8[0],
						    f = _ref8[1];

						return s(_this5.objects_by_id.get(asset_id));
					});
					return delete _this5.get_asset_by_id_promise[asset_id];
				}
				Apis.instance().db_api().exec("get_objects", [[asset_id]]).then(function (assets) {
					if (!assets.length || !assets[0]) {
						_this5.get_asset_by_id_promise[asset_id].forEach(function (_ref9) {
							var _ref10 = _slicedToArray(_ref9, 2),
							    s = _ref10[0],
							    f = _ref10[1];

							return s(null);
						});
						return delete _this5.get_asset_by_id_promise[asset_id];
					}
					var asset = assets[0];
					var result = _this5._updateObject(asset, true);
					_this5.get_asset_by_id_promise[asset_id].forEach(function (_ref11) {
						var _ref12 = _slicedToArray(_ref11, 2),
						    s = _ref12[0],
						    f = _ref12[1];

						return s(result);
					});
					delete _this5.get_asset_by_id_promise[asset_id];
				}).catch(function (error) {
					console.error("Error in getAssetById (" + asset_id + ")", error);
					if (_this5.get_asset_by_id_promise[asset_id]) {
						_this5.get_asset_by_id_promise[asset_id].forEach(function (_ref13) {
							var _ref14 = _slicedToArray(_ref13, 2),
							    s = _ref14[0],
							    f = _ref14[1];

							return f(error);
						});
						delete _this5.get_asset_by_id_promise[asset_id];
					}
				});
			});
		}
	}, {
		key: "getAssetAsync",
		value: function getAssetAsync(id_or_symbol) {
			var _this6 = this;

			return new Promise(function (success) {
				var asset = _this6.getAsset(id_or_symbol);
				if (asset !== undefined) {
					return success(asset);
				}
				setTimeout(function () {
					_this6.getAssetAsync(id_or_symbol).then(function (asset) {
						return success(asset);
					});
				}, 200);
			});
		}

		/**
   *  @param the public key to find accounts that reference it
   *
   *  @return Set of account ids that reference the given key
   *  @return a empty Set if no items are found
   *  @return undefined if the result is unknown
   *
   *  If this method returns undefined, then it will send a request to
   *  the server for the current set of accounts after which the
   *  server will notify us of any accounts that reference these keys
   */

	}, {
		key: "getAccountRefsOfKey",
		value: function getAccountRefsOfKey(key) {
			var _this7 = this;

			if (this.get_account_refs_of_keys_calls.has(key)) return this.account_ids_by_key.get(key);else {
				this.get_account_refs_of_keys_calls = this.get_account_refs_of_keys_calls.add(key);
				Apis.instance().db_api().exec('get_key_references', [[key]]).then(function (vec_account_id) {
					var refs = Immutable.Set();
					vec_account_id = vec_account_id[0];
					refs = refs.withMutations(function (r) {
						for (var i = 0; i < vec_account_id.length; ++i) {
							r.add(vec_account_id[i]);
						}
					});
					_this7.account_ids_by_key = _this7.account_ids_by_key.set(key, refs);
					_this7.notifySubscribers();
				}, function (error) {
					_this7.account_ids_by_key = _this7.account_ids_by_key.delete(key);
					_this7.get_account_refs_of_keys_calls = _this7.get_account_refs_of_keys_calls.delete(key);
				});
				return undefined;
			}
		}

		/**
   * @param {Array<strings>} keys - array of public keys
   * @return {Array<string | undefined>} id - [1.11.123213, undefined, undefined]
   */

	}, {
		key: "getAccountsIdByKeys",
		value: function () {
			var _ref15 = (0, _bluebird.coroutine)(function* (keys) {
				var _this8 = this;

				var isAllKeysCached = keys.some(function (key) {
					return _this8.get_account_refs_of_keys_calls.has(key);
				});
				if (isAllKeysCached) {
					var cachedKeys = keys.map(function (key) {
						return _this8.account_ids_by_key.get(key).toJS();
					});
					return cachedKeys;
				}
				var account_ids = yield Apis.instance().db_api().exec('get_key_references', [keys]);
				this.cacheAccountIdsAndRefs(account_ids, keys);
				return account_ids;
			});

			function getAccountsIdByKeys(_x2) {
				return _ref15.apply(this, arguments);
			}

			return getAccountsIdByKeys;
		}()
	}, {
		key: "cacheAccountIdsAndRefs",
		value: function cacheAccountIdsAndRefs(account_ids, pubkeys) {
			var _this9 = this;

			account_ids.forEach(function (id, index) {
				var ref = Immutable.Set(id[0] ? [id[0]] : []);
				if (!_this9.get_account_refs_of_keys_calls.has(pubkeys[index])) {
					_this9.get_account_refs_of_keys_calls = _this9.get_account_refs_of_keys_calls.add(pubkeys[index]);
				}
				_this9.account_ids_by_key = _this9.account_ids_by_key.set(pubkeys[index], ref);
			});
		}
	}, {
		key: "getFirstAccountIdByKeys",
		value: function () {
			var _ref16 = (0, _bluebird.coroutine)(function* (keys) {
				var noNotify = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

				var account_ids = yield this.getAccountsIdByKeys(keys);
				if (!noNotify) {
					this.notifySubscribers();
				}
				return account_ids.find(function (v) {
					return v[0];
				}) && account_ids.find(function (v) {
					return v[0];
				})[0];
			});

			function getFirstAccountIdByKeys(_x4) {
				return _ref16.apply(this, arguments);
			}

			return getFirstAccountIdByKeys;
		}()

		/**
   * @return a Set of balance ids that are claimable with the given address
   * @return undefined if a query is pending and the set is not known at this time
   * @return a empty Set if no items are found
   *
   * If this method returns undefined, then it will send a request to the server for
   * the current state after which it will be subscribed to changes to this set.
   */

	}, {
		key: "getBalanceObjects",
		value: function getBalanceObjects(address) {
			var _this10 = this;

			var current = this.balance_objects_by_address.get(address);
			if (current === undefined) {
				/** because balance objects are simply part of the genesis state, there is no need to worry about
     * having to update them / merge them or index them in updateObject.
     */
				this.balance_objects_by_address = this.balance_objects_by_address.set(address, Immutable.Set());
				Apis.instance().db_api().exec("get_balance_objects", [[address]]).then(function (balance_objects) {
					var set = new Set();
					for (var i = 0; i < balance_objects.length; ++i) {
						_this10._updateObject(balance_objects[i]);
						set.add(balance_objects[i].id);
					}
					_this10.balance_objects_by_address = _this10.balance_objects_by_address.set(address, Immutable.Set(set));
					_this10.notifySubscribers();
				}, function (error) {
					_this10.balance_objects_by_address = _this10.balance_objects_by_address.delete(address);
				});
			}
			return this.balance_objects_by_address.get(address);
		}

		/**
   *  If there is not already a pending request to fetch this object, a new
   *  request will be made.
   *
   *  @return null if the object does not exist,
   *  @return undefined if the object might exist but is not in cache
   *  @return the object if it does exist and is in our cache
   * 	@return false if there is error to stop 'async' fetching (E.g: getObjectAsync)
   */

	}, {
		key: "fetchObject",
		value: function fetchObject(id) {
			var _this11 = this;

			var force = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

			if (typeof id !== 'string') {
				var _result = [];
				for (var i = 0; i < id.length; ++i) {
					_result.push(this.fetchObject(id[i]));
				}return _result;
			}

			if (DEBUG) console.log("!!! fetchObject: ", id, this.subscribed, !this.subscribed && !force);
			if (!this.subscribed && !force) return undefined;

			if (DEBUG) console.log("maybe fetch object: ", id);
			if (!ChainValidation.is_object_id(id)) throw Error("argument is not an object id: " + id);

			if (id.substring(0, 4) == "1.2.") {
				// console.log('fetchObject', id);
				// console.log(id == '1.2.20');
				// if(id == '1.2.20')
				// 	throw new Error();
				return this.fetchFullAccount(id);
			}

			var result = this.objects_by_id.get(id);
			if (result === undefined) {
				// the fetch
				if (DEBUG) console.log("fetching object: ", id);
				this.objects_by_id = this.objects_by_id.set(id, true);
				Apis.instance().db_api().exec("get_objects", [[id]]).then(function (optional_objects) {
					//if(DEBUG) console.log('... optional_objects',optional_objects ? optional_objects[0].id : null)
					for (var _i = 0; _i < optional_objects.length; _i++) {
						var _optional_object = optional_objects[_i];
						if (_optional_object) _this11._updateObject(_optional_object, true);else {
							_this11.objects_by_id = _this11.objects_by_id.set(id, null);
							_this11.notifySubscribers();
						}
					}
				}).catch(function (error) {
					console.log('!!! Chain API error', error);
					_this11.objects_by_id = _this11.objects_by_id.set(id, false);
					if (error && error.message && !error.message.includes("GRAPHENE_DB_MAX_INSTANCE_ID")) {
						setTimeout(function () {
							// in the event of an error clear the pending state for id
							_this11.objects_by_id = _this11.objects_by_id.delete(id);
						}, 1000);
					}
				});
			} else if (result === true) // then we are waiting a response
				return undefined;
			return result; // we have a response, return it
		}

		/**
   *  @return null if no such account exists
   *  @return undefined if such an account may exist, and fetch the the full account if not already pending
   *  @return the account object if it does exist
   */

	}, {
		key: "getAccount",
		value: function getAccount(name_or_id) {
			if (this.fetching_names_or_ids.has(name_or_id)) {
				return undefined; //fetching
			}
			if (!name_or_id) return null;

			if ((typeof name_or_id === "undefined" ? "undefined" : _typeof(name_or_id)) === 'object') {
				if (name_or_id.id) return this.getAccount(name_or_id.id);else if (name_or_id.get) return this.getAccount(name_or_id.get('id'));else return undefined;
			}

			if (ChainValidation.is_object_id(name_or_id)) {
				var account = this.getObject(name_or_id);
				if (account === null) {
					return null;
				}
				if (account === undefined || account.get('name') === undefined) {
					return this.fetchFullAccount(name_or_id);
				}
				return account;
			} else if (ChainValidation.is_address(name_or_id)) {
				var account_id = this.accounts_by_address.get(name_or_id);
				if (account_id === null) return null; // already fetched and it wasn't found
				if (account_id === undefined) // then no query, fetch it
					return this.getAccountByAddress(name_or_id);
				return this.getObject(account_id); // return it
			} else if (ChainValidation.is_account_name(name_or_id, true)) {

				var _account_id = this.accounts_by_name.get(name_or_id);
				if (_account_id === null) return null; // already fetched and it wasn't found
				if (_account_id === undefined) // then no query, fetch it
					return this.fetchFullAccount(name_or_id);

				return this.getObject(_account_id); // return it
			}
			return null;
			// throw Error( `Argument is not an account name or id: ${name_or_id}` )
		}
	}, {
		key: "getAddressByBlockParams",
		value: function () {
			var _ref17 = (0, _bluebird.coroutine)(function* (info) {
				var address = yield Apis.instance().db_api().exec('get_address', [info.block, info.n]);
				info.address = address;
				return info;
			});

			function getAddressByBlockParams(_x6) {
				return _ref17.apply(this, arguments);
			}

			return getAddressByBlockParams;
		}()
	}, {
		key: "getAccountAsync",
		value: function () {
			var _ref18 = (0, _bluebird.coroutine)(function* (name_or_id) {
				var account = this.getAccount(name_or_id);

				if (account !== undefined) {
					return account;
				}
				yield sleep(100);
				return yield this.getAccountAsync(name_or_id);
			});

			function getAccountAsync(_x7) {
				return _ref18.apply(this, arguments);
			}

			return getAccountAsync;
		}()
	}, {
		key: "getAccountByAddress",
		value: function getAccountByAddress(address) {
			var _this12 = this;

			if (!this.fetching_by_address.has(address) || Date.now() - this.fetching_by_address.get(address) > 5000) {
				this.fetching_by_address.set(address, Date.now());
				Apis.instance().db_api().exec("get_address_references", [[address]]).then(function (results) {
					if (results && results.length && results[0].length) {

						var accountID = results[0][0];
						_this12.accounts_by_address = _this12.accounts_by_address.set(address, accountID);
						var account = _this12.getObject(accountID);
						if (account === null) {
							return null;
						}
						if (account === undefined || account.get('name') === undefined) {
							return _this12.fetchFullAccount(accountID);
						}
						return account;
					}
				});
			}
			return undefined;
		}
	}, {
		key: "getAccountPromise",
		value: function getAccountPromise(name_or_id) {
			var _this13 = this;

			return new Promise(function (success, fail) {
				var account = _this13.getAccount(name_or_id);
				if (typeof account == 'undefined') {
					return setTimeout(function () {
						_this13.getAccountPromise(name_or_id).then(function (account) {
							return success(account);
						}).catch(function (err) {
							return fail(err);
						});
					}, 100);
				}
				if (account) return success(account);
				fail("Account not found");
			});
		}

		/**
   * This method will attempt to lookup witness by account_id.
   * If witness doesn't exist it will return null, if witness is found it will return witness object,
   * if it's not fetched yet it will return undefined.
   * @param account_id - account id
   */

	}, {
		key: "getWitnessById",
		value: function getWitnessById(account_id) {
			var witness_id = this.witness_by_account_id.get(account_id);
			if (witness_id === undefined) {
				this.fetchWitnessByAccount(account_id);
				return undefined;
			}
			return witness_id ? this.getObject(witness_id) : null;
		}

		/**
   * This method will attempt to lookup committee member by account_id.
   * If committee member doesn't exist it will return null, if committee member is found it will return committee member object,
   * if it's not fetched yet it will return undefined.
   * @param account_id - account id
   */

	}, {
		key: "getCommitteeMemberById",
		value: function getCommitteeMemberById(account_id) {
			var cm_id = this.committee_by_account_id.get(account_id);
			if (cm_id === undefined) {
				this.fetchCommitteeMemberByAccount(account_id);
				return undefined;
			}
			return cm_id ? this.getObject(cm_id) : null;
		}

		/**
   * Obsolete! Please use getWitnessById
   * This method will attempt to lookup the account, and then query to see whether or not there is
   * a witness for this account.  If the answer is known, it will return the witness_object, otherwise
   * it will attempt to look it up and return null.   Once the lookup has completed on_update will
   * be called.
   *
   * @param id_or_account may either be an account_id, a witness_id, or an account_name
   */

	}, {
		key: "getWitness",
		value: function getWitness(id_or_account) {
			var _this14 = this;

			var account = this.getAccount(id_or_account);
			if (!account) return null;
			var account_id = account.get('id');

			var witness_id = this.witness_by_account_id.get(account_id);
			if (witness_id === undefined) this.fetchWitnessByAccount(account_id);
			return this.getObject(witness_id);

			if (ChainValidation.is_account_name(id_or_account, true) || id_or_account.substring(0, 4) == "1.2.") {
				var _account2 = this.getAccount(id_or_account);
				if (!_account2) {
					this.lookupAccountByName(id_or_account).then(function (account) {
						if (!account) return null;

						var account_id = account.get('id');
						var witness_id = _this14.witness_by_account_id.get(account_id);
						if (ChainValidation.is_object_id(witness_id)) return _this14.getObject(witness_id, on_update);

						if (witness_id == undefined) _this14.fetchWitnessByAccount(account_id).then(function (witness) {
							_this14.witness_by_account_id.set(account_id, witness ? witness.get('id') : null);
							if (witness && on_update) on_update();
						});
					}, function (error) {
						var witness_id = _this14.witness_by_account_id.set(id_or_account, null);
					});
				} else {
					var _account_id2 = _account2.get('id');
					var _witness_id = this.witness_by_account_id.get(_account_id2);
					if (ChainValidation.is_object_id(_witness_id)) return this.getObject(_witness_id, on_update);

					if (_witness_id == undefined) this.fetchWitnessByAccount(_account_id2).then(function (witness) {
						_this14.witness_by_account_id.set(_account_id2, witness ? witness.get('id') : null);
						if (witness && on_update) on_update();
					});
				}
				return null;
			}
			return null;
		}

		// Obsolete! Please use getCommitteeMemberById

	}, {
		key: "getCommitteeMember",
		value: function getCommitteeMember(id_or_account) {
			var _this15 = this;

			var on_update = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

			if (ChainValidation.is_account_name(id_or_account, true) || id_or_account.substring(0, 4) == "1.2.") {
				var account = this.getAccount(id_or_account);

				if (!account) {
					this.lookupAccountByName(id_or_account).then(function (account) {
						var account_id = account.get('id');
						var committee_id = _this15.committee_by_account_id.get(account_id);
						if (ChainValidation.is_object_id(committee_id)) return _this15.getObject(committee_id, on_update);

						if (committee_id == undefined) {
							_this15.fetchCommitteeMemberByAccount(account_id).then(function (committee) {
								_this15.committee_by_account_id.set(account_id, committee ? committee.get('id') : null);
								if (on_update && committee) on_update();
							});
						}
					}, function (error) {
						var witness_id = _this15.committee_by_account_id.set(id_or_account, null);
					});
				} else {
					var account_id = account.get('id');
					var committee_id = this.committee_by_account_id.get(account_id);
					if (ChainValidation.is_object_id(committee_id)) return this.getObject(committee_id, on_update);

					if (committee_id == undefined) {
						this.fetchCommitteeMemberByAccount(account_id).then(function (committee) {
							_this15.committee_by_account_id.set(account_id, committee ? committee.get('id') : null);
							if (on_update && committee) on_update();
						});
					}
				}
			}
			return null;
		}

		/**
   *
   * @return a promise with the witness object
   */

	}, {
		key: "fetchWitnessByAccount",
		value: function fetchWitnessByAccount(account_id) {
			var _this16 = this;

			return new Promise(function (resolve, reject) {
				Apis.instance().db_api().exec("get_witness_by_account", [account_id]).then(function (optional_witness_object) {
					if (optional_witness_object) {
						_this16.witness_by_account_id = _this16.witness_by_account_id.set(optional_witness_object.witness_account, optional_witness_object.id);
						var witness_object = _this16._updateObject(optional_witness_object, true);
						resolve(witness_object);
					} else {
						_this16.witness_by_account_id = _this16.witness_by_account_id.set(account_id, null);
						_this16.notifySubscribers();
						resolve(null);
					}
				}, reject);
			});
		}

		/**
   *
   * @return a promise with the witness object
   */

	}, {
		key: "fetchCommitteeMemberByAccount",
		value: function fetchCommitteeMemberByAccount(account_id) {
			var _this17 = this;

			return new Promise(function (resolve, reject) {
				Apis.instance().db_api().exec("get_committee_member_by_account", [account_id]).then(function (optional_committee_object) {
					if (optional_committee_object) {
						_this17.committee_by_account_id = _this17.committee_by_account_id.set(optional_committee_object.committee_member_account, optional_committee_object.id);
						var committee_object = _this17._updateObject(optional_committee_object, true);
						resolve(committee_object);
					} else {
						_this17.committee_by_account_id = _this17.committee_by_account_id.set(account_id, null);
						_this17.notifySubscribers();
						resolve(null);
					}
				}, reject);
			});
		}

		/**
   *  Fetches an account and all of its associated data in a single query
   *
   *  @param name_or_id account name or account id
   *
   *  @return undefined if the account in question is in the process of being fetched
   *  @return the object if it has already been fetched
   *  @return null if the object has been queried and was not found
   */

	}, {
		key: "fetchFullAccount",
		value: function fetchFullAccount(name_or_id) {
			var _this18 = this;

			if (DEBUG) console.log("Fetch full account: ", name_or_id);

			var fetch_account = false;
			if (ChainValidation.is_object_id(name_or_id)) {
				var current = this.objects_by_id.get(name_or_id);
				fetch_account = current === undefined;
				if (!fetch_account && fetch_account.get('name')) {
					return current;
				}
			} else {
				if (!ChainValidation.is_account_name(name_or_id, true)) throw Error("argument is not an account name: " + name_or_id);

				var account_id = this.accounts_by_name.get(name_or_id);
				if (ChainValidation.is_object_id(account_id)) return this.getAccount(account_id);
			}

			/// only fetch once every 5 seconds if it wasn't found
			if (!this.fetching_get_full_accounts.has(name_or_id) || Date.now() - this.fetching_get_full_accounts.get(name_or_id) > 5000) {
				this.fetching_get_full_accounts.set(name_or_id, Date.now());
				//console.log( "FETCHING FULL ACCOUNT: ", name_or_id )

				this.fetching_names_or_ids.add(name_or_id); //setting fetch status to not do additional requests
				Apis.instance().db_api().exec("get_full_accounts", [[name_or_id], true]).then(function (results) {
					if (results.length === 0) {
						if (ChainValidation.is_object_id(name_or_id)) {
							_this18.objects_by_id = _this18.objects_by_id.set(name_or_id, null);
							_this18.notifySubscribers();
							return;
						}
						_this18.accounts_by_name = _this18.accounts_by_name.set(name_or_id, null);
						return;
					}
					var full_account = results[0][1];
					if (DEBUG) console.log("full_account: ", full_account);

					var account = full_account.account,
					    vesting_balances = full_account.vesting_balances,
					    statistics = full_account.statistics,
					    call_orders = full_account.call_orders,
					    limit_orders = full_account.limit_orders,
					    referrer_name = full_account.referrer_name,
					    registrar_name = full_account.registrar_name,
					    lifetime_referrer_name = full_account.lifetime_referrer_name,
					    votes = full_account.votes,
					    proposals = full_account.proposals;


					_this18.accounts_by_name = _this18.accounts_by_name.set(account.name, account.id);
					account.referrer_name = referrer_name;
					account.lifetime_referrer_name = lifetime_referrer_name;
					account.registrar_name = registrar_name;
					account.balances = {};
					account.orders = new Immutable.Set();
					account.vesting_balances = new Immutable.Set();
					account.balances = new Immutable.Map();
					account.call_orders = new Immutable.Set();
					account.proposals = new Immutable.Set();
					account.vesting_balances = account.vesting_balances.withMutations(function (set) {
						vesting_balances.forEach(function (vb) {
							_this18._updateObject(vb, false);
							set.add(vb.id);
						});
					});

					votes.forEach(function (v) {
						return _this18._updateObject(v, false);
					});

					account.balances = account.balances.withMutations(function (map) {
						full_account.balances.forEach(function (b) {
							_this18._updateObject(b, false);
							map.set(b.asset_type, b.id);
						});
					});

					account.orders = account.orders.withMutations(function (set) {
						limit_orders.forEach(function (order) {
							_this18._updateObject(order, false);
							set.add(order.id);
						});
					});

					account.call_orders = account.call_orders.withMutations(function (set) {
						call_orders.forEach(function (co) {
							_this18._updateObject(co, false);
							set.add(co.id);
						});
					});

					account.proposals = account.proposals.withMutations(function (set) {
						proposals.forEach(function (p) {
							_this18._updateObject(p, false);
							set.add(p.id);
						});
					});

					_this18._updateObject(statistics, false);
					var updated_account = _this18._updateObject(account, false);
					_this18.fetchRecentHistory(updated_account);
					_this18.notifySubscribers();
				}, function (error) {
					console.log("Error: ", error);

					if (ChainValidation.is_object_id(name_or_id)) {
						_this18.objects_by_id = _this18.objects_by_id.set(name_or_id, null);
						_this18.notifySubscribers();
						setTimeout(function () {
							_this18.objects_by_id = _this18.objects_by_id.delete(id);
						}, 300);
						return;
					}
					_this18.accounts_by_name = _this18.accounts_by_name.set(name_or_id, null);
					setTimeout(function () {
						_this18.accounts_by_name = _this18.accounts_by_name.delete(id);
					}, 300);
					return;
				}).finally(function () {
					_this18.fetching_names_or_ids.delete(name_or_id);
				});
			}
			return undefined;
		}
	}, {
		key: "getAccountMemberStatus",
		value: function getAccountMemberStatus(account) {
			if (account === undefined) return undefined;
			if (account === null) return "unknown";
			if (account.get('lifetime_referrer') == account.get('id')) return "lifetime";
			var exp = new Date(account.get('membership_expiration_date')).getTime();
			var now = new Date().getTime();
			if (exp < now) return "basic";
			return "annual";
		}
	}, {
		key: "getAccountBalance",
		value: function getAccountBalance(account, asset_type) {
			var balances = account.get('balances');
			if (!balances) return 0;

			var balance_obj_id = balances.get(asset_type);
			if (balance_obj_id) {
				var bal_obj = this.objects_by_id.get(balance_obj_id);
				if (bal_obj) return bal_obj.get('balance');
			}
			return 0;
		}

		/**
   * There are two ways to extend the account history, add new more
   * recent history, and extend historic hstory. This method will fetch
   * the most recent account history and prepend it to the list of
   * historic operations.
   *
   *  @param account immutable account object
   *  @return a promise with the account history
   */

	}, {
		key: "fetchRecentHistory",
		value: function fetchRecentHistory(account) {
			var _this19 = this;

			var limit = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 100;

			// console.log( "get account history: ", account )
			/// TODO: make sure we do not submit a query if there is already one
			/// in flight...
			var account_id = account;
			if (!ChainValidation.is_object_id(account_id) && account.toJS) account_id = account.get('id');

			if (!ChainValidation.is_object_id(account_id)) return;

			account = this.objects_by_id.get(account_id);
			if (!account) return;

			var pending_request = this.account_history_requests.get(account_id);
			if (pending_request) {
				pending_request.requests++;
				return pending_request.promise;
			} else pending_request = { requests: 0 };

			var most_recent = "1." + op_history + ".0";
			var history = account.get('history');

			if (history && history.size) most_recent = history.first().get('id');

			/// starting at 0 means start at NOW, set this to something other than 0
			/// to skip recent transactions and fetch the tail
			var start = "1." + op_history + ".0";

			pending_request.promise = new Promise(function (resolve, reject) {
				// console.log('account_id', account_id);
				Apis.instance().history_api().exec("get_account_history", [account_id, most_recent, limit, start]).then(function (operations) {

					var current_account = _this19.objects_by_id.get(account_id);
					var current_history = current_account.get('history');
					if (!current_history) current_history = Immutable.List();
					var updated_history = Immutable.fromJS(operations);
					updated_history = updated_history.withMutations(function (list) {
						for (var i = 0; i < current_history.size; ++i) {
							list.push(current_history.get(i));
						}
					});
					var updated_account = current_account.set('history', updated_history);
					_this19.objects_by_id = _this19.objects_by_id.set(account_id, updated_account);

					//if( current_history != updated_history )
					//   this._notifyAccountSubscribers( account_id )

					var pending_request = _this19.account_history_requests.get(account_id);
					_this19.account_history_requests.delete(account_id);
					if (pending_request.requests > 0) {
						// it looks like some more history may have come in while we were
						// waiting on the result, lets fetch anything new before we resolve
						// this query.
						_this19.fetchRecentHistory(updated_account, limit).then(resolve, reject);
					} else resolve(updated_account);
				}); // end then
			});

			this.account_history_requests.set(account_id, pending_request);
			return pending_request.promise;
		}

		//_notifyAccountSubscribers( account_id )
		//{
		//   let sub = this.subscriptions_by_account.get( account_id )
		//   let acnt = this.objects_by_id.get(account_id)
		//   if( !sub ) return
		//   for( let item of sub.subscriptions )
		//      item( acnt )
		//}

		/**
   *  Callback that receives notification of objects that have been
   *  added, remove, or changed and are relevant to account_id
   *
   *  This method updates or removes objects from the main index and
   *  then updates the account object with relevant meta-info depending
   *  upon the type of account
   */
		// _updateAccount( account_id, payload )
		// {
		//    let updates = payload[0]

		//    for( let i = 0; i < updates.length; ++i )
		//    {
		//       let update = updates[i]
		//       if( typeof update  == 'string' )
		//       {
		//          let old_obj = this._removeObject( update )

		//          if( update.search( order_prefix ) == 0 )
		//          {
		//                acnt = acnt.setIn( ['orders'], set => set.delete(update) )
		//          }
		//          else if( update.search( vesting_balance_prefix ) == 0 )
		//          {
		//                acnt = acnt.setIn( ['vesting_balances'], set => set.delete(update) )
		//          }
		//       }
		//       else
		//       {
		//          let updated_obj = this._updateObject( update )
		//          if( update.id.search( balance_prefix ) == 0 )
		//          {
		//             if( update.owner == account_id )
		//                acnt = acnt.setIn( ['balances'], map => map.set(update.asset_type,update.id) )
		//          }
		//          else if( update.id.search( order_prefix ) == 0 )
		//          {
		//             if( update.owner == account_id )
		//                acnt = acnt.setIn( ['orders'], set => set.add(update.id) )
		//          }
		//          else if( update.id.search( vesting_balance_prefix ) == 0 )
		//          {
		//             if( update.owner == account_id )
		//                acnt = acnt.setIn( ['vesting_balances'], set => set.add(update.id) )
		//          }

		//          this.objects_by_id = this.objects_by_id.set( acnt.id, acnt )
		//       }
		//    }
		//    this.fetchRecentHistory( acnt )
		// }

		/**
   *  Updates the object in place by only merging the set
   *  properties of object.
   *
   *  This method will create an immutable object with the given ID if
   *  it does not already exist.
   *
   *  This is a "private" method called when data is received from the
   *  server and should not be used by others.
   *
   *  @pre object.id must be a valid object ID
   *  @return an Immutable constructed from object and deep merged with the current state
   */

	}, {
		key: "_updateObject",
		value: function _updateObject(object, notify_subscribers) {
			var emit = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

			if (!("id" in object)) {
				console.log("object with no id:", object);
				if ("balance" in object && "owner" in object && "settlement_date" in object) {
					// Settle order object
					emitter.emit("settle-order-update", object);
				}
				return;
			}
			// if (!(object.id.split(".")[0] == 2) && !(object.id.split(".")[1] == 6)) {
			//   console.log( "update: ", object )
			// }

			// DYNAMIC GLOBAL OBJECT
			if (object.id == "2.1.0") {
				object.participation = 100 * (BigInteger(object.recent_slots_filled).bitCount() / 128.0);
				this.head_block_time_string = object.time;
				this.chain_time_offset.push(Date.now() - timeStringToDate(object.time).getTime());
				if (this.chain_time_offset.length > 10) this.chain_time_offset.shift(); // remove first
			}

			// NEW BLOCK
			if (object.block_id) {
				this.newBlock(object.block_id);
			}

			var current = this.objects_by_id.get(object.id);
			if (!current) current = Immutable.Map();
			var prior = current;
			if (current === undefined || current === true) {
				this.objects_by_id = this.objects_by_id.set(object.id, current = Immutable.fromJS(object));
			} else {
				this.objects_by_id = this.objects_by_id.set(object.id, current = current.mergeDeep(Immutable.fromJS(object)));
			}

			// BALANCE OBJECT
			if (object.id.substring(0, balance_prefix.length) == balance_prefix) {
				var owner = this.objects_by_id.get(object.owner);
				if (owner === undefined || owner === null) {
					return;
					/*  This prevents the full account from being looked up later
      owner = {id:object.owner, balances:{ } }
      owner.balances[object.asset_type] = object.id
      owner = Immutable.fromJS( owner )
      */
				} else {
					var balances = owner.get("balances");
					if (!balances) owner = owner.set("balances", Immutable.Map());
					owner = owner.setIn(['balances', object.asset_type], object.id);
				}
				this.objects_by_id = this.objects_by_id.set(object.owner, owner);
			}
			// ACCOUNT STATS OBJECT
			else if (object.id.substring(0, account_stats_prefix.length) == account_stats_prefix) {
					// console.log( "HISTORY CHANGED" )
					var prior_most_recent_op = prior ? prior.get('most_recent_op') : "2.9.0";

					if (prior_most_recent_op != object.most_recent_op) {
						this.fetchRecentHistory(object.owner);
					}
					if (this.is_actual_history.get(object.owner)) {
						this.is_actual_history = this.is_actual_history.set(object.owner, false);
					}
					this.addTransaction(object.owner);
				}
				// WITNESS OBJECT
				else if (object.id.substring(0, witness_prefix.length) == witness_prefix) {
						this.witness_by_account_id.set(object.witness_account, object.id);
						this.objects_by_vote_id.set(object.vote_id, object.id);
					}
					// COMMITTEE MEMBER OBJECT
					else if (object.id.substring(0, committee_prefix.length) == committee_prefix) {
							this.committee_by_account_id.set(object.committee_member_account, object.id);
							this.objects_by_vote_id.set(object.vote_id, object.id);
						}
						// ACCOUNT OBJECT
						else if (object.id.substring(0, account_prefix.length) == account_prefix) {
								current = current.set('active', Immutable.fromJS(object.active));
								current = current.set('owner', Immutable.fromJS(object.owner));
								current = current.set('options', Immutable.fromJS(object.options));
								current = current.set('whitelisting_accounts', Immutable.fromJS(object.whitelisting_accounts));
								current = current.set('blacklisting_accounts', Immutable.fromJS(object.blacklisting_accounts));
								current = current.set('whitelisted_accounts', Immutable.fromJS(object.whitelisted_accounts));
								current = current.set('blacklisted_accounts', Immutable.fromJS(object.blacklisted_accounts));
								this.objects_by_id = this.objects_by_id.set(object.id, current);
								// this.accounts_by_name = this.accounts_by_name.set(object.name, object.id);
							}
							// ASSET OBJECT
							else if (object.id.substring(0, asset_prefix.length) == asset_prefix) {
									this.assets_by_symbol = this.assets_by_symbol.set(object.symbol, object.id);
									var dynamic = current.get('dynamic');
									if (!dynamic) {
										var dad = this.getObject(object.dynamic_asset_data_id, true);
										if (!dad) dad = Immutable.Map();
										if (!dad.get('asset_id')) {
											dad = dad.set('asset_id', object.id);
										}
										this.objects_by_id = this.objects_by_id.set(object.dynamic_asset_data_id, dad);

										current = current.set('dynamic', dad);
										this.objects_by_id = this.objects_by_id.set(object.id, current);
									}

									var bitasset = current.get('bitasset');
									if (!bitasset && object.bitasset_data_id) {
										var bad = this.getObject(object.bitasset_data_id, true);
										if (!bad) bad = Immutable.Map();

										if (!bad.get('asset_id')) {
											bad = bad.set('asset_id', object.id);
										}
										this.objects_by_id = this.objects_by_id.set(object.bitasset_data_id, bad);

										current = current.set('bitasset', bad);
										this.objects_by_id = this.objects_by_id.set(object.id, current);
									}
								}
								// ASSET DYNAMIC DATA OBJECT
								else if (object.id.substring(0, asset_dynamic_data_prefix.length) == asset_dynamic_data_prefix) {
										// let asset_id = asset_prefix + object.id.substring( asset_dynamic_data_prefix.length )
										var asset_id = current.get("asset_id");
										if (asset_id) {
											var asset_obj = this.getObject(asset_id);
											if (asset_obj && asset_obj.set) {
												asset_obj = asset_obj.set('dynamic', current);
												this.objects_by_id = this.objects_by_id.set(asset_id, asset_obj);
											}
										}
									}
									// WORKER OBJECT
									else if (object.id.substring(0, worker_prefix.length) == worker_prefix) {
											this.objects_by_vote_id.set(object.vote_for, object.id);
											this.objects_by_vote_id.set(object.vote_against, object.id);
										}
										// BITASSET DATA OBJECT
										else if (object.id.substring(0, bitasset_data_prefix.length) == bitasset_data_prefix) {
												var _asset_id = current.get("asset_id");
												if (_asset_id) {
													var asset = this.getObject(_asset_id);
													if (asset) {
														asset = asset.set("bitasset", current);
														emitter.emit('bitasset-update', asset);
														this.objects_by_id = this.objects_by_id.set(_asset_id, asset);
													}
												}
											}
											// CALL ORDER OBJECT
											else if (object.id.substring(0, call_order_prefix.length) == call_order_prefix) {
													// Update nested call_orders inside account object
													if (emit) {
														emitter.emit("call-order-update", object);
													}

													var account = this.objects_by_id.get(object.borrower);
													if (account && account.has("call_orders")) {
														var call_orders = account.get("call_orders");
														if (!call_orders.has(object.id)) {
															account = account.set("call_orders", call_orders.add(object.id));
															this.objects_by_id = this.objects_by_id.set(account.get("id"), account);
														}
													}
												}
												// LIMIT ORDER OBJECT
												else if (object.id.substring(0, order_prefix.length) == order_prefix) {
														var _account3 = this.objects_by_id.get(object.seller);
														if (_account3 && _account3.has("orders")) {
															var limit_orders = _account3.get("orders");
															if (!limit_orders.has(object.id)) {
																_account3 = _account3.set("orders", limit_orders.add(object.id));
																this.objects_by_id = this.objects_by_id.set(_account3.get("id"), _account3);
															}
														}
														// POROPOSAL OBJECT
													} else if (object.id.substring(0, proposal_prefix.length) == proposal_prefix) {
														this.addProposalData(object.required_active_approvals, object.id);
														this.addProposalData(object.required_owner_approvals, object.id);
													}

			if (notify_subscribers) this.notifySubscribers();

			return current;
		}
	}, {
		key: "getObjectsByVoteIds",
		value: function getObjectsByVoteIds(vote_ids) {
			var _this20 = this;

			var result = [];
			var missing = [];
			for (var i = 0; i < vote_ids.length; ++i) {
				var obj = this.objects_by_vote_id.get(vote_ids[i]);
				if (obj) result.push(this.getObject(obj));else {
					result.push(null);
					missing.push(vote_ids[i]);
				}
			}

			if (missing.length) {
				// we may need to fetch some objects
				Apis.instance().db_api().exec("lookup_vote_ids", [missing]).then(function (vote_obj_array) {
					console.log("missing ===========> ", missing);
					console.log("vote objects ===========> ", vote_obj_array);
					for (var _i2 = 0; _i2 < vote_obj_array.length; ++_i2) {
						if (vote_obj_array[_i2]) {
							_this20._updateObject(vote_obj_array[_i2]);
						}
					}
				}, function (error) {
					return console.log("Error looking up vote ids: ", error);
				});
			}
			return result;
		}
	}, {
		key: "getObjectByVoteID",
		value: function getObjectByVoteID(vote_id) {
			var obj_id = this.objects_by_vote_id.get(vote_id);
			if (obj_id) return this.getObject(obj_id);
			return undefined;
		}
	}, {
		key: "getHeadBlockDate",
		value: function getHeadBlockDate() {
			return timeStringToDate(this.head_block_time_string);
		}
	}, {
		key: "getEstimatedChainTimeOffset",
		value: function getEstimatedChainTimeOffset() {
			if (this.chain_time_offset.length === 0) return 0;
			// Immutable is fast, sorts numbers correctly, and leaves the original unmodified
			// This will fix itself if the user changes their clock
			var median_offset = Immutable.List(this.chain_time_offset).sort().get(Math.floor((this.chain_time_offset.length - 1) / 2));
			// console.log("median_offset", median_offset)
			return median_offset;
		}
	}, {
		key: "addProposalData",
		value: function addProposalData(approvals, objectId) {
			var _this21 = this;

			approvals.forEach(function (id) {
				var impactedAccount = _this21.objects_by_id.get(id);
				if (impactedAccount) {
					var proposals = impactedAccount.get("proposals");

					if (!proposals.includes(objectId)) {
						proposals = proposals.add(objectId);
						impactedAccount = impactedAccount.set("proposals", proposals);
						_this21._updateObject(impactedAccount.toJS(), false);
					}
				}
			});
		}
	}, {
		key: "getNextMaintenanceMoment",
		value: function getNextMaintenanceMoment() {
			var time = moment.utc().hours(9).minutes(0).second(0);
			if (time.diff(moment.utc(), 'seconds') < 0) {
				time.add(1, 'day');
			}
			return time;
		}
	}, {
		key: "getObjectAsync",
		value: function () {
			var _ref19 = (0, _bluebird.coroutine)(function* (object_id) {
				var object = this.getObject(object_id);
				if (object === false) {
					return false;
				}
				if (object !== undefined) {
					return object;
				}
				yield sleep(100);
				return yield this.getObjectAsync(object_id);
			});

			function getObjectAsync(_x11) {
				return _ref19.apply(this, arguments);
			}

			return getObjectAsync;
		}()
	}, {
		key: "getMiningInfo",
		value: function () {
			var _ref20 = (0, _bluebird.coroutine)(function* (account_id) {
				var asset_id = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '1.3.1';

				return {
					matureBalance: yield this.getMatureBalance(account_id, asset_id),
					requireTransferIndicator: yield this.getIsExistRequireTransfer(account_id, asset_id)
				};
			});

			function getMiningInfo(_x13) {
				return _ref20.apply(this, arguments);
			}

			return getMiningInfo;
		}()
	}, {
		key: "getMatureBalance",
		value: function () {
			var _ref21 = (0, _bluebird.coroutine)(function* (account_id) {
				var asset_id = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '1.3.1';

				var history = (yield this.getTransfers(account_id, asset_id)).toJS(),
				    account = yield this.getObjectAsync(account_id),
				    asset = yield this.getObjectAsync(asset_id);

				var precision = Math.pow(10, asset.get('precision'));
				if (!account || !account.get('balances') || !account.get('balances').get(asset_id)) {
					return { balance: 0, precision: precision };
				}
				var balance = +(yield this.getObjectAsync(account.get('balances').get(asset_id))).get('balance');

				var prevMaintenanceMoment = this.getNextMaintenanceMoment().subtract(1, 'day'),
				    debitTxsForPeriod = [],
				    validTxs = [];

				history.forEach(function (tx) {
					// Older than current mining period
					if (moment.utc(tx.block_time).diff(prevMaintenanceMoment, 'seconds') < 0) return;
					validTxs.push(tx);

					var txAmount = tx.op[1]['amount']['amount'];
					if (tx.op[1]['to'] == account_id) {
						balance -= txAmount;
					} else {
						txAmount += tx.op[1]['fee']['amount'];
						balance += txAmount;
					}
				});

				validTxs.reverse().forEach(function (tx) {
					var txAmount = tx.op[1]['amount']['amount'];

					if (tx.op[1]['to'] == account_id) {
						debitTxsForPeriod.push([txAmount, tx.block_time]);
					} else {
						txAmount += tx.op[1]['fee']['amount'];
						while (debitTxsForPeriod.length && txAmount > 0) {
							if (debitTxsForPeriod[debitTxsForPeriod.length - 1][0] > txAmount) {
								debitTxsForPeriod[debitTxsForPeriod.length - 1][0] -= txAmount;
								txAmount = 0;
							} else {
								txAmount -= debitTxsForPeriod[debitTxsForPeriod.length - 1][0];
								debitTxsForPeriod = debitTxsForPeriod.slice(0, -1);
							}
						}
						balance -= txAmount;
					}
				});

				debitTxsForPeriod.forEach(function (r) {
					var mature = 1440 - moment.utc(r[1]).diff(prevMaintenanceMoment, 'minutes');
					balance += r[0] * mature / 1440;
				});
				return { balance: Math.floor(balance), precision: precision };
			});

			function getMatureBalance(_x15) {
				return _ref21.apply(this, arguments);
			}

			return getMatureBalance;
		}()
	}, {
		key: "getIsExistRequireTransfer",
		value: function () {
			var _ref22 = (0, _bluebird.coroutine)(function* (account_id) {
				var asset_id = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '1.3.1';

				if (this.account_sum_transfers_by_asset.has(account_id)) {
					return (this.account_sum_transfers_by_asset.get(account_id).get(asset_id) || 0) >= 1000;
				}
				yield this.setSumForMiningPeriod(account_id, asset_id);
				return yield this.getIsExistRequireTransfer(account_id, asset_id);
			});

			function getIsExistRequireTransfer(_x17) {
				return _ref22.apply(this, arguments);
			}

			return getIsExistRequireTransfer;
		}()
	}, {
		key: "setSumForMiningPeriod",
		value: function () {
			var _ref23 = (0, _bluebird.coroutine)(function* (account_id, asset_id) {
				var history = (yield this.getTransfers(account_id, asset_id)).toJS();
				var prevMaintenanceMoment = this.getNextMaintenanceMoment().subtract(1, 'day');
				var sum = 0;

				var assets = this.account_sum_transfers_by_asset.get(account_id);
				if (!assets) {
					assets = Immutable.Map();
				}

				history.forEach(function (tx) {
					// Older than current mining period
					if (moment.utc(tx.block_time).diff(prevMaintenanceMoment, 'seconds') < 0) return;

					if (tx.op[1]['to'] == account_id) return;
					sum += tx.op[1]['amount']['amount'];
				});
				assets = assets.set(asset_id, sum);
				this.account_sum_transfers_by_asset = this.account_sum_transfers_by_asset.set(account_id, assets);
			});

			function setSumForMiningPeriod(_x18, _x19) {
				return _ref23.apply(this, arguments);
			}

			return setSumForMiningPeriod;
		}()
	}, {
		key: "addTransaction",
		value: function () {
			var _ref24 = (0, _bluebird.coroutine)(function* (account_id) {
				var _this22 = this;

				if (this.fetching_transfers_by_account.get(account_id)) return;
				if (!this.transfers_by_account.has(account_id)) return;

				var ops = this.transfers_by_account.get(account_id).toJS();
				var lastID = 0;
				Object.keys(ops).forEach(function (asset_id) {
					var id = ops[asset_id][0]['id'].split('.')[2];
					if (id > lastID) lastID = id;
				});
				var transfers = yield Apis.instance().history_api().exec('get_account_operation_history2', [account_id, '1.11.' + lastID, 100, '1.11.0', 0]);
				transfers.forEach(function (tx) {
					_this22._addTransferToHistory(account_id, tx, true);
					_this22.setSumForMiningPeriod(account_id, tx.op[1]['amount']['asset_id']);
				});
			});

			function addTransaction(_x20) {
				return _ref24.apply(this, arguments);
			}

			return addTransaction;
		}()

		/**
   *
   * @param account_id
   * @param asset_id - in null - return transfers for all assets
   * @returns {Promise.<*>}
   */

	}, {
		key: "getTransfers",
		value: function () {
			var _ref25 = (0, _bluebird.coroutine)(function* (account_id) {
				var _this23 = this;

				var asset_id = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '1.3.1';

				if (this.fetching_transfers_by_account.get(account_id)) {
					yield sleep(100);
					return yield this.getTransfers(account_id, asset_id);
				}
				if (this.transfers_by_account.has(account_id)) {
					return this._getTransfersFromVar(account_id, asset_id);
				}
				this.fetching_transfers_by_account = this.fetching_transfers_by_account.set(account_id, true);
				this.transfers_by_account = this.transfers_by_account.set(account_id, Immutable.Map());
				this.all_transfers_by_account = this.all_transfers_by_account.set(account_id, Immutable.List());

				var transfers = yield Apis.instance().history_api().exec('get_account_operation_history2', [account_id, '1.11.0', 100, '1.11.0', 0]);

				transfers.forEach(function (tx) {
					return _this23._addTransferToHistory(account_id, tx);
				});
				this.fetching_transfers_by_account = this.fetching_transfers_by_account.set(account_id, false);
				return this._getTransfersFromVar(account_id, asset_id);
			});

			function getTransfers(_x22) {
				return _ref25.apply(this, arguments);
			}

			return getTransfers;
		}()
	}, {
		key: "_getTransfersFromVar",
		value: function _getTransfersFromVar(account_id, asset_id) {
			if (asset_id) return this.transfers_by_account.get(account_id).get(asset_id) || Immutable.List();
			return this.all_transfers_by_account.get(account_id) || Immutable.List();
		}

		/**
   * Add new transfer to this.transfers_by_account object
   * @param account_id
   * @param transfer
   * @param prepend
   * @private
   */

	}, {
		key: "_addTransferToHistory",
		value: function _addTransferToHistory(account_id, transfer) {
			var prepend = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

			var asset_id = transfer.op[1]['amount']['asset_id'];

			var assets = this.transfers_by_account.get(account_id);
			var allTransfers = this.all_transfers_by_account.get(account_id);

			var history = Immutable.List();
			if (this.transfers_by_account.has(account_id) && this.transfers_by_account.get(account_id).has(asset_id)) {
				history = this.transfers_by_account.get(account_id).get(asset_id);
			}
			if (prepend) history = history.unshift(transfer);else history = history.push(transfer);
			if (prepend) allTransfers = allTransfers.unshift(transfer);else allTransfers = allTransfers.push(transfer);
			assets = assets.set(asset_id, history);
			this.transfers_by_account = this.transfers_by_account.set(account_id, assets);
			this.all_transfers_by_account = this.all_transfers_by_account.set(account_id, allTransfers);
		}
	}, {
		key: "getBlock",
		value: function () {
			var _ref26 = (0, _bluebird.coroutine)(function* (height) {
				if (this.blocks.has(height)) return this.blocks.get(height);
				var block = yield Apis.instance().db_api().exec('get_block', [height]);
				this.blocks = this.blocks.set(height, block);
				return block;
			});

			function getBlock(_x24) {
				return _ref26.apply(this, arguments);
			}

			return getBlock;
		}()
	}, {
		key: "newBlock",
		value: function () {
			var _ref27 = (0, _bluebird.coroutine)(function* (blockId) {
				var block = yield Apis.instance().db_api().exec('get_block_by_id', [blockId]);
				this.blocks = this.blocks.set(block.block_number, block);
				this._clearOldBlock();
				return block;
			});

			function newBlock(_x25) {
				return _ref27.apply(this, arguments);
			}

			return newBlock;
		}()
	}, {
		key: "_clearOldBlock",
		value: function _clearOldBlock() {
			var first = this.blocks.last();
			this.blocks = this.blocks.filter(function (block) {
				return block.block_number > first.block_number - 20;
			});
		}
	}]);

	return ChainStore;
}();

/**
 *
 * @type {ChainStore}
 */


var chain_store = new ChainStore();

function FetchChainObjects(method, object_ids, timeout) {
	var get_object = method.bind(chain_store);

	return new Promise(function (resolve, reject) {

		var timeout_handle = null;

		function onUpdate() {
			var not_subscribed_yet = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

			var res = object_ids.map(function (id) {
				return get_object(id);
			});
			if (res.findIndex(function (o) {
				return o === undefined;
			}) === -1) {
				if (timeout_handle) clearTimeout(timeout_handle);
				if (!not_subscribed_yet) chain_store.unsubscribe(onUpdate);
				resolve(res);
				return true;
			}
			return false;
		}

		var resolved = onUpdate(true);
		if (!resolved) chain_store.subscribe(onUpdate);

		if (timeout && !resolved) timeout_handle = setTimeout(function () {
			chain_store.unsubscribe(onUpdate);
			reject("timeout");
		}, timeout);
	});
}

chain_store.FetchChainObjects = FetchChainObjects;

function FetchChain(methodName, objectIds) {
	var timeout = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1900;


	var method = chain_store[methodName];
	if (!method) throw new Error("ChainStore does not have method " + methodName);

	var arrayIn = Array.isArray(objectIds);
	if (!arrayIn) objectIds = [objectIds];

	return chain_store.FetchChainObjects(method, Immutable.List(objectIds), timeout).then(function (res) {
		return arrayIn ? res : res.get(0);
	});
}

chain_store.FetchChain = FetchChain;

function timeStringToDate(time_string) {
	if (!time_string) return new Date("1970-01-01T00:00:00.000Z");
	if (!/Z$/.test(time_string)) //does not end in Z
		// https://github.com/cryptonomex/graphene/issues/368
		time_string = time_string + "Z";
	return new Date(time_string);
}

function sleep() {
	var ms = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

	return new Promise(function (r) {
		return setTimeout(r, ms);
	});
}

module.exports = chain_store;