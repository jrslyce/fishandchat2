(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.Muxy = factory());
}(this, (function () { 'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation. All rights reserved.
    Licensed under the Apache License, Version 2.0 (the "License"); you may not use
    this file except in compliance with the License. You may obtain a copy of the
    License at http://www.apache.org/licenses/LICENSE-2.0

    THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
    WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
    MERCHANTABLITY OR NON-INFRINGEMENT.

    See the Apache Version 2.0 License for specific language governing permissions
    and limitations under the License.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };

    var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function unwrapExports (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x.default : x;
    }

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var gumshoe = createCommonjsModule(function (module) {
    /* eslint-disable */

    // polyfill for String.prototype.trim for IE8
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Trim
    if (!String.prototype.trim) {
      (function() {
        // Make sure we trim BOM and NBSP
        var rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;
        String.prototype.trim = function() {
          return this.replace(rtrim, '');
        };
      })();
    }

    // Production steps of ECMA-262, Edition 5, 15.4.4.21
    // Reference: http://es5.github.io/#x15.4.4.21
    if (!Array.prototype.reduce) {
      Array.prototype.reduce = function(callback /*, initialValue*/) {
        if (this == null) {
          throw new TypeError('Array.prototype.reduce called on null or undefined');
        }
        if (typeof callback !== 'function') {
          throw new TypeError(callback + ' is not a function');
        }
        var t = Object(this), len = t.length >>> 0, k = 0, value;
        if (arguments.length == 2) {
          value = arguments[1];
        } else {
          while (k < len && ! k in t) {
            k++;
          }
          if (k >= len) {
            throw new TypeError('Reduce of empty array with no initial value');
          }
          value = t[k++];
        }
        for (; k < len; k++) {
          if (k in t) {
            value = callback(value, t[k], k, t);
          }
        }
        return value;
      };
    }

    /**
     * @file perfnow is a 0.14 kb window.performance.now high resolution timer polyfill with Date fallback
     * @author Daniel Lamb <dlamb.open.source@gmail.com>
     */
    function perfnow() {
      var perf = window.performance || {};
      perf.now = perf.now ||
        perf.mozNow ||
        perf.msNow ||
        perf.oNow ||
        perf.webkitNow ||
        // fallback to Date
        Date.now || function () {
          return new Date().getTime();
        };

      return perf;
    }
    function gumshoeFactory() {

      // we need reqwest and store2 (and any other future deps)
      // to be solely within our context, so as they don't leak and conflict
      // with other versions of the same libs sites may be loading.
      // so we'll provide our own context.
      // root._gumshoe is only available in specs
      var context = {},
        queryString,
        store,
        /*jshint -W024 */
        undefined;

      // call contextSetup with 'context' as 'this' so all libs attach
      // to our context variable.
      (function contextSetup() {
        /*!
    	    query-string
    	    Parse and stringify URL query strings
    	    https://github.com/sindresorhus/query-string
    	    by Sindre Sorhus
    	    MIT License
        */
        (function (c) {
          var queryString = {};

          queryString.parse = function (str) {
            if (typeof str !== 'string') {
              return {};
            }

            str = str.trim().replace(/^(\?|#)/, '');

            if (!str) {
              return {};
            }

            return str.trim().split('&').reduce(function (ret, param) {
              var parts = param.replace(/\+/g, ' ').split('=');
              var key = parts[0];
              var val = parts[1];

              key = decodeURIComponent(key);
              // missing `=` should be `null`:
              // http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
              val = val === undefined ? null : decodeURIComponent(val);

              if (!ret.hasOwnProperty(key)) {
                ret[key] = val;
              } else if (Array.isArray(ret[key])) {
                ret[key].push(val);
              } else {
                ret[key] = [ret[key], val];
              }

              return ret;
            }, {});
          };

          queryString.stringify = function (obj) {
            return obj ? Object.keys(obj).map(function (key) {
              var val = obj[key];

              if (Array.isArray(val)) {
                return val.map(function (val2) {
                  return encodeURIComponent(key) + '=' + encodeURIComponent(val2);
                }).join('&');
              }

              return encodeURIComponent(key) + '=' + encodeURIComponent(val);
            }).join('&') : '';
          };

          c.queryString = queryString;
        })(this);


        /*!
         * Reqwest! A general purpose XHR connection manager
         * license MIT (c) Dustin Diaz 2014
         * https://github.com/ded/reqwest
         */

        !function (name, context, definition) {
          context[name] = definition();
        }('reqwest', this, function () {

          var win = window
            , doc = document
            , httpsRe = /^http/
            , protocolRe = /(^\w+):\/\//
            , twoHundo = /^(20\d|1223)$/ //http://stackoverflow.com/questions/10046972/msie-returns-status-code-of-1223-for-ajax-request
            , byTag = 'getElementsByTagName'
            , readyState = 'readyState'
            , contentType = 'Content-Type'
            , requestedWith = 'X-Requested-With'
            , head = doc[byTag]('head')[0]
            , uniqid = 0
            , callbackPrefix = 'reqwest_' + (+new Date())
            , lastValue // data stored by the most recent JSONP callback
            , xmlHttpRequest = 'XMLHttpRequest'
            , xDomainRequest = 'XDomainRequest'
            , noop = function () {}

            , isArray = typeof Array.isArray == 'function'
                ? Array.isArray
                : function (a) {
                    return a instanceof Array
                  }

            , defaultHeaders = {
                  'contentType': 'application/x-www-form-urlencoded'
                , 'requestedWith': xmlHttpRequest
                , 'accept': {
                      '*':  'text/javascript, text/html, application/xml, text/xml, */*'
                    , 'xml':  'application/xml, text/xml'
                    , 'html': 'text/html'
                    , 'text': 'text/plain'
                    , 'json': 'application/json, text/javascript'
                    , 'js':   'application/javascript, text/javascript'
                  }
              }

            , xhr = function(o) {
                // is it x-domain
                if (o['crossOrigin'] === true) {
                  var xhr = win[xmlHttpRequest] ? new XMLHttpRequest() : null;
                  if (xhr && 'withCredentials' in xhr) {
                    return xhr
                  } else if (win[xDomainRequest]) {
                    return new XDomainRequest()
                  } else {
                    throw new Error('Browser does not support cross-origin requests')
                  }
                } else if (win[xmlHttpRequest]) {
                  return new XMLHttpRequest()
                } else {
                  return new ActiveXObject('Microsoft.XMLHTTP')
                }
              }
            , globalSetupOptions = {
                dataFilter: function (data) {
                  return data
                }
              };

          function succeed(r) {
            var protocol = protocolRe.exec(r.url);
            protocol = (protocol && protocol[1]) || window.location.protocol;
            return httpsRe.test(protocol) ? twoHundo.test(r.request.status) : !!r.request.responseText;
          }

          function handleReadyState(r, success, error) {
            return function () {
              // use _aborted to mitigate against IE err c00c023f
              // (can't read props on aborted request objects)
              if (r._aborted) return error(r.request)
              if (r._timedOut) return error(r.request, 'Request is aborted: timeout')
              if (r.request && r.request[readyState] == 4) {
                r.request.onreadystatechange = noop;
                if (succeed(r)) success(r.request);
                else
                  error(r.request);
              }
            }
          }

          function setHeaders(http, o) {
            var headers = o['headers'] || {}
              , h;

            headers['Accept'] = headers['Accept']
              || defaultHeaders['accept'][o['type']]
              || defaultHeaders['accept']['*'];

            var isAFormData = typeof FormData === 'function' && (o['data'] instanceof FormData);
            // breaks cross-origin requests with legacy browsers
            if (!o['crossOrigin'] && !headers[requestedWith]) headers[requestedWith] = defaultHeaders['requestedWith'];
            if (!headers[contentType] && !isAFormData) headers[contentType] = o['contentType'] || defaultHeaders['contentType'];
            for (h in headers)
              headers.hasOwnProperty(h) && 'setRequestHeader' in http && http.setRequestHeader(h, headers[h]);
          }

          function setCredentials(http, o) {
            if (typeof o['withCredentials'] !== 'undefined' && typeof http.withCredentials !== 'undefined') {
              http.withCredentials = !!o['withCredentials'];
            }
          }

          function generalCallback(data) {
            lastValue = data;
          }

          function urlappend (url, s) {
            return url + (/\?/.test(url) ? '&' : '?') + s
          }

          function handleJsonp(o, fn, err, url) {
            var reqId = uniqid++
              , cbkey = o['jsonpCallback'] || 'callback' // the 'callback' key
              , cbval = o['jsonpCallbackName'] || reqwest.getcallbackPrefix(reqId)
              , cbreg = new RegExp('((^|\\?|&)' + cbkey + ')=([^&]+)')
              , match = url.match(cbreg)
              , script = doc.createElement('script')
              , loaded = 0
              , isIE10 = navigator.userAgent.indexOf('MSIE 10.0') !== -1;

            if (match) {
              if (match[3] === '?') {
                url = url.replace(cbreg, '$1=' + cbval); // wildcard callback func name
              } else {
                cbval = match[3]; // provided callback func name
              }
            } else {
              url = urlappend(url, cbkey + '=' + cbval); // no callback details, add 'em
            }

            win[cbval] = generalCallback;

            script.type = 'text/javascript';
            script.src = url;
            script.async = true;
            if (typeof script.onreadystatechange !== 'undefined' && !isIE10) {
              // need this for IE due to out-of-order onreadystatechange(), binding script
              // execution to an event listener gives us control over when the script
              // is executed. See http://jaubourg.net/2010/07/loading-script-as-onclick-handler-of.html
              script.htmlFor = script.id = '_reqwest_' + reqId;
            }

            script.onload = script.onreadystatechange = function () {
              if ((script[readyState] && script[readyState] !== 'complete' && script[readyState] !== 'loaded') || loaded) {
                return false
              }
              script.onload = script.onreadystatechange = null;
              script.onclick && script.onclick();
              // Call the user callback with the last value stored and clean up values and scripts.
              fn(lastValue);
              lastValue = undefined;
              head.removeChild(script);
              loaded = 1;
            };

            // Add the script to the DOM head
            head.appendChild(script);

            // Enable JSONP timeout
            return {
              abort: function () {
                script.onload = script.onreadystatechange = null;
                err({}, 'Request is aborted: timeout', {});
                lastValue = undefined;
                head.removeChild(script);
                loaded = 1;
              }
            }
          }

          function getRequest(fn, err) {
            var o = this.o
              , method = (o['method'] || 'GET').toUpperCase()
              , url = typeof o === 'string' ? o : o['url']
              // convert non-string objects to query-string form unless o['processData'] is false
              , data = (o['processData'] !== false && o['data'] && typeof o['data'] !== 'string')
                ? reqwest.toQueryString(o['data'])
                : (o['data'] || null)
              , http
              , sendWait = false;

            // if we're working on a GET request and we have data then we should append
            // query string to end of URL and not post data
            if ((o['type'] == 'jsonp' || method == 'GET') && data) {
              url = urlappend(url, data);
              data = null;
            }

            if (o['type'] == 'jsonp') return handleJsonp(o, fn, err, url)

            // get the xhr from the factory if passed
            // if the factory returns null, fall-back to ours
            http = (o.xhr && o.xhr(o)) || xhr(o);

            http.open(method, url, o['async'] === false ? false : true);
            setHeaders(http, o);
            setCredentials(http, o);
            if (win[xDomainRequest] && http instanceof win[xDomainRequest]) {
                http.onload = fn;
                http.onerror = err;
                // NOTE: see
                // http://social.msdn.microsoft.com/Forums/en-US/iewebdevelopment/thread/30ef3add-767c-4436-b8a9-f1ca19b4812e
                http.onprogress = function() {};
                sendWait = true;
            } else {
              http.onreadystatechange = handleReadyState(this, fn, err);
            }
            o['before'] && o['before'](http);
            if (sendWait) {
              setTimeout(function () {
                http.send(data);
              }, 200);
            } else {
              http.send(data);
            }
            return http
          }

          function Reqwest(o, fn) {
            this.o = o;
            this.fn = fn;

            init.apply(this, arguments);
          }

          function setType(header) {
            // json, javascript, text/plain, text/html, xml
            if (header.match('json')) return 'json'
            if (header.match('javascript')) return 'js'
            if (header.match('text')) return 'html'
            if (header.match('xml')) return 'xml'
          }

          function init(o, fn) {

            this.url = typeof o == 'string' ? o : o['url'];
            this.timeout = null;

            // whether request has been fulfilled for purpose
            // of tracking the Promises
            this._fulfilled = false;
            // success handlers
            this._successHandler = function(){};
            this._fulfillmentHandlers = [];
            // error handlers
            this._errorHandlers = [];
            // complete (both success and fail) handlers
            this._completeHandlers = [];
            this._erred = false;
            this._responseArgs = {};

            var self = this;

            fn = fn || function () {};

            if (o['timeout']) {
              this.timeout = setTimeout(function () {
                timedOut();
              }, o['timeout']);
            }

            if (o['success']) {
              this._successHandler = function () {
                o['success'].apply(o, arguments);
              };
            }

            if (o['error']) {
              this._errorHandlers.push(function () {
                o['error'].apply(o, arguments);
              });
            }

            if (o['complete']) {
              this._completeHandlers.push(function () {
                o['complete'].apply(o, arguments);
              });
            }

            function complete (resp) {
              o['timeout'] && clearTimeout(self.timeout);
              self.timeout = null;
              while (self._completeHandlers.length > 0) {
                self._completeHandlers.shift()(resp);
              }
            }

            function success (resp) {
              var type = o['type'] || resp && setType(resp.getResponseHeader('Content-Type')); // resp can be undefined in IE
              resp = (type !== 'jsonp') ? self.request : resp;
              // use global data filter on response text
              var filteredResponse = globalSetupOptions.dataFilter(resp.responseText, type)
                , r = filteredResponse;
              try {
                resp.responseText = r;
              } catch (e) {
                // can't assign this in IE<=8, just ignore
              }
              if (r) {
                switch (type) {
                case 'json':
                  try {
                    resp = win.JSON.parse(r);
                  } catch (err) {
                    return error(resp, 'Could not parse JSON in response', err)
                  }
                  break;
                }
              }

              self._responseArgs.resp = resp;
              self._fulfilled = true;
              fn(resp);
              self._successHandler(resp);
              while (self._fulfillmentHandlers.length > 0) {
                resp = self._fulfillmentHandlers.shift()(resp);
              }

              complete(resp);
            }

            function timedOut() {
              self._timedOut = true;
              if(typeof self.request !== 'undefined' && typeof self.request.abort === 'function') {
                self.request.abort();
              }
            }

            function error(resp, msg, t) {
              resp = self.request;
              self._responseArgs.resp = resp;
              self._responseArgs.msg = msg;
              self._responseArgs.t = t;
              self._erred = true;
              while (self._errorHandlers.length > 0) {
                self._errorHandlers.shift()(resp, msg, t);
              }
              complete(resp);
            }

            this.request = getRequest.call(this, success, error);
          }

          Reqwest.prototype = {
            abort: function () {
              this._aborted = true;
              if(typeof this.request !== 'undefined' && typeof this.request.abort === 'function') {
                this.request.abort();
              }
            }

          , retry: function () {
              this._aborted=false;
              this._timedOut=false;
              init.call(this, this.o, this.fn);
            }

            /**
             * Small deviation from the Promises A CommonJs specification
             * http://wiki.commonjs.org/wiki/Promises/A
             */

            /**
             * `then` will execute upon successful requests
             */
          , then: function (success, fail) {
              success = success || function () {};
              fail = fail || function () {};
              if (this._fulfilled) {
                this._responseArgs.resp = success(this._responseArgs.resp);
              } else if (this._erred) {
                fail(this._responseArgs.resp, this._responseArgs.msg, this._responseArgs.t);
              } else {
                this._fulfillmentHandlers.push(success);
                this._errorHandlers.push(fail);
              }
              return this
            }

            /**
             * `always` will execute whether the request succeeds or fails
             */
          , always: function (fn) {
              if (this._fulfilled || this._erred) {
                fn(this._responseArgs.resp);
              } else {
                this._completeHandlers.push(fn);
              }
              return this
            }

            /**
             * `fail` will execute when the request fails
             */
          , fail: function (fn) {
              if (this._erred) {
                fn(this._responseArgs.resp, this._responseArgs.msg, this._responseArgs.t);
              } else {
                this._errorHandlers.push(fn);
              }
              return this
            }
          , 'catch': function (fn) {
              return this.fail(fn)
            }
          };

          function reqwest(o, fn) {
            return new Reqwest(o, fn)
          }

          // normalize newline variants according to spec -> CRLF
          function normalize(s) {
            return s ? s.replace(/\r?\n/g, '\r\n') : ''
          }

          function serial(el, cb) {
            var n = el.name
              , t = el.tagName.toLowerCase()
              , optCb = function (o) {
                  // IE gives value="" even where there is no value attribute
                  // 'specified' ref: http://www.w3.org/TR/DOM-Level-3-Core/core.html#ID-862529273
                  if (o && !o['disabled'])
                    cb(n, normalize(o['attributes']['value'] && o['attributes']['value']['specified'] ? o['value'] : o['text']));
                }
              , ch, ra, val, i;

            // don't serialize elements that are disabled or without a name
            if (el.disabled || !n) return

            switch (t) {
            case 'input':
              if (!/reset|button|image|file/i.test(el.type)) {
                ch = /checkbox/i.test(el.type);
                ra = /radio/i.test(el.type);
                val = el.value
                // WebKit gives us "" instead of "on" if a checkbox has no value, so correct it here
                ;(!(ch || ra) || el.checked) && cb(n, normalize(ch && val === '' ? 'on' : val));
              }
              break
            case 'textarea':
              cb(n, normalize(el.value));
              break
            case 'select':
              if (el.type.toLowerCase() === 'select-one') {
                optCb(el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null);
              } else {
                for (i = 0; el.length && i < el.length; i++) {
                  el.options[i].selected && optCb(el.options[i]);
                }
              }
              break
            }
          }

          // collect up all form elements found from the passed argument elements all
          // the way down to child elements; pass a '<form>' or form fields.
          // called with 'this'=callback to use for serial() on each element
          function eachFormElement() {
            var cb = this
              , e, i
              , serializeSubtags = function (e, tags) {
                  var i, j, fa;
                  for (i = 0; i < tags.length; i++) {
                    fa = e[byTag](tags[i]);
                    for (j = 0; j < fa.length; j++) serial(fa[j], cb);
                  }
                };

            for (i = 0; i < arguments.length; i++) {
              e = arguments[i];
              if (/input|select|textarea/i.test(e.tagName)) serial(e, cb);
              serializeSubtags(e, [ 'input', 'select', 'textarea' ]);
            }
          }

          // standard query string style serialization
          function serializeQueryString() {
            return reqwest.toQueryString(reqwest.serializeArray.apply(null, arguments))
          }

          // { 'name': 'value', ... } style serialization
          function serializeHash() {
            var hash = {};
            eachFormElement.apply(function (name, value) {
              if (name in hash) {
                hash[name] && !isArray(hash[name]) && (hash[name] = [hash[name]]);
                hash[name].push(value);
              } else hash[name] = value;
            }, arguments);
            return hash
          }

          // [ { name: 'name', value: 'value' }, ... ] style serialization
          reqwest.serializeArray = function () {
            var arr = [];
            eachFormElement.apply(function (name, value) {
              arr.push({name: name, value: value});
            }, arguments);
            return arr
          };

          reqwest.serialize = function () {
            if (arguments.length === 0) return ''
            var opt, fn
              , args = Array.prototype.slice.call(arguments, 0);

            opt = args.pop();
            opt && opt.nodeType && args.push(opt) && (opt = null);
            opt && (opt = opt.type);

            if (opt == 'map') fn = serializeHash;
            else if (opt == 'array') fn = reqwest.serializeArray;
            else fn = serializeQueryString;

            return fn.apply(null, args)
          };

          reqwest.toQueryString = function (o, trad) {
            var prefix, i
              , traditional = trad || false
              , s = []
              , enc = encodeURIComponent
              , add = function (key, value) {
                  // If value is a function, invoke it and return its value
                  value = ('function' === typeof value) ? value() : (value == null ? '' : value);
                  s[s.length] = enc(key) + '=' + enc(value);
                };
            // If an array was passed in, assume that it is an array of form elements.
            if (isArray(o)) {
              for (i = 0; o && i < o.length; i++) add(o[i]['name'], o[i]['value']);
            } else {
              // If traditional, encode the "old" way (the way 1.3.2 or older
              // did it), otherwise encode params recursively.
              for (prefix in o) {
                if (o.hasOwnProperty(prefix)) buildParams(prefix, o[prefix], traditional, add);
              }
            }

            // spaces should be + according to spec
            return s.join('&').replace(/%20/g, '+')
          };

          function buildParams(prefix, obj, traditional, add) {
            var name, i, v
              , rbracket = /\[\]$/;

            if (isArray(obj)) {
              // Serialize array item.
              for (i = 0; obj && i < obj.length; i++) {
                v = obj[i];
                if (traditional || rbracket.test(prefix)) {
                  // Treat each array item as a scalar.
                  add(prefix, v);
                } else {
                  buildParams(prefix + '[' + (typeof v === 'object' ? i : '') + ']', v, traditional, add);
                }
              }
            } else if (obj && obj.toString() === '[object Object]') {
              // Serialize object item.
              for (name in obj) {
                buildParams(prefix + '[' + name + ']', obj[name], traditional, add);
              }

            } else {
              // Serialize scalar item.
              add(prefix, obj);
            }
          }

          reqwest.getcallbackPrefix = function () {
            return callbackPrefix
          };

          // jQuery and Zepto compatibility, differences can be remapped here so you can call
          // .ajax.compat(options, callback)
          reqwest.compat = function (o, fn) {
            if (o) {
              o['type'] && (o['method'] = o['type']) && delete o['type'];
              o['dataType'] && (o['type'] = o['dataType']);
              o['jsonpCallback'] && (o['jsonpCallbackName'] = o['jsonpCallback']) && delete o['jsonpCallback'];
              o['jsonp'] && (o['jsonpCallback'] = o['jsonp']);
            }
            return new Reqwest(o, fn)
          };

          reqwest.ajaxSetup = function (options) {
            options = options || {};
            for (var k in options) {
              globalSetupOptions[k] = options[k];
            }
          };

          return reqwest
        });
    (function(window, define) {
            var _ = {
                version: "2.3.0",
                areas: {},
                apis: {},

                // utilities
                inherit: function(api, o) {
                    for (var p in api) {
                        if (!o.hasOwnProperty(p)) {
                            o[p] = api[p];
                        }
                    }
                    return o;
                },
                stringify: function(d) {
                    return d === undefined || typeof d === "function" ? d+'' : JSON.stringify(d);
                },
                parse: function(s) {
                    // if it doesn't parse, return as is
                    try{ return JSON.parse(s); }catch(e){ return s; }
                },

                // extension hooks
                fn: function(name, fn) {
                    _.storeAPI[name] = fn;
                    for (var api in _.apis) {
                        _.apis[api][name] = fn;
                    }
                },
                get: function(area, key){ return area.getItem(key); },
                set: function(area, key, string){ area.setItem(key, string); },
                remove: function(area, key){ area.removeItem(key); },
                key: function(area, i){ return area.key(i); },
                length: function(area){ return area.length; },
                clear: function(area){ area.clear(); },

                // core functions
                Store: function(id, area, namespace) {
                    var store = _.inherit(_.storeAPI, function(key, data, overwrite) {
                        if (arguments.length === 0){ return store.getAll(); }
                        if (data !== undefined){ return store.set(key, data, overwrite); }
                        if (typeof key === "string"){ return store.get(key); }
                        if (!key){ return store.clear(); }
                        return store.setAll(key, data);// overwrite=data, data=key
                    });
                    store._id = id;
                    try {
                        var testKey = '_safariPrivate_';
                        area.setItem(testKey, 'sucks');
                        store._area = area;
                        area.removeItem(testKey);
                    } catch (e) {}
                    if (!store._area) {
                        store._area = _.inherit(_.storageAPI, { items: {}, name: 'fake' });
                    }
                    store._ns = namespace || '';
                    if (!_.areas[id]) {
                        _.areas[id] = store._area;
                    }
                    if (!_.apis[store._ns+store._id]) {
                        _.apis[store._ns+store._id] = store;
                    }
                    return store;
                },
                storeAPI: {
                    // admin functions
                    area: function(id, area) {
                        var store = this[id];
                        if (!store || !store.area) {
                            store = _.Store(id, area, this._ns);//new area-specific api in this namespace
                            if (!this[id]){ this[id] = store; }
                        }
                        return store;
                    },
                    namespace: function(namespace, noSession) {
                        if (!namespace){
                            return this._ns ? this._ns.substring(0,this._ns.length-1) : '';
                        }
                        var ns = namespace, store = this[ns];
                        if (!store || !store.namespace) {
                            store = _.Store(this._id, this._area, this._ns+ns+'.');//new namespaced api
                            if (!this[ns]){ this[ns] = store; }
                            if (!noSession){ store.area('session', _.areas.session); }
                        }
                        return store;
                    },
                    isFake: function(){ return this._area.name === 'fake'; },
                    toString: function() {
                        return 'store'+(this._ns?'.'+this.namespace():'')+'['+this._id+']';
                    },

                    // storage functions
                    has: function(key) {
                        if (this._area.has) {
                            return this._area.has(this._in(key));//extension hook
                        }
                        return !!(this._in(key) in this._area);
                    },
                    size: function(){ return this.keys().length; },
                    each: function(fn, and) {
                        for (var i=0, m=_.length(this._area); i<m; i++) {
                            var key = this._out(_.key(this._area, i));
                            if (key !== undefined) {
                                if (fn.call(this, key, and || this.get(key)) === false) {
                                    break;
                                }
                            }
                            if (m > _.length(this._area)) { m--; i--; }// in case of removeItem
                        }
                        return and || this;
                    },
                    keys: function() {
                        return this.each(function(k, list){ list.push(k); }, []);
                    },
                    get: function(key, alt) {
                        var s = _.get(this._area, this._in(key));
                        return s !== null ? _.parse(s) : alt || s;// support alt for easy default mgmt
                    },
                    getAll: function() {
                        return this.each(function(k, all){ all[k] = this.get(k); }, {});
                    },
                    set: function(key, data, overwrite) {
                        var d = this.get(key);
                        if (d != null && overwrite === false) {
                            return data;
                        }
                        return _.set(this._area, this._in(key), _.stringify(data), overwrite) || d;
                    },
                    setAll: function(data, overwrite) {
                        var changed, val;
                        for (var key in data) {
                            val = data[key];
                            if (this.set(key, val, overwrite) !== val) {
                                changed = true;
                            }
                        }
                        return changed;
                    },
                    remove: function(key) {
                        var d = this.get(key);
                        _.remove(this._area, this._in(key));
                        return d;
                    },
                    clear: function() {
                        if (!this._ns) {
                            _.clear(this._area);
                        } else {
                            this.each(function(k){ _.remove(this._area, this._in(k)); }, 1);
                        }
                        return this;
                    },
                    clearAll: function() {
                        var area = this._area;
                        for (var id in _.areas) {
                            if (_.areas.hasOwnProperty(id)) {
                                this._area = _.areas[id];
                                this.clear();
                            }
                        }
                        this._area = area;
                        return this;
                    },

                    // internal use functions
                    _in: function(k) {
                        if (typeof k !== "string"){ k = _.stringify(k); }
                        return this._ns ? this._ns + k : k;
                    },
                    _out: function(k) {
                        return this._ns ?
                            k && k.indexOf(this._ns) === 0 ?
                                k.substring(this._ns.length) :
                                undefined : // so each() knows to skip it
                            k;
                    }
                },// end _.storeAPI
                storageAPI: {
                    length: 0,
                    has: function(k){ return this.items.hasOwnProperty(k); },
                    key: function(i) {
                        var c = 0;
                        for (var k in this.items){
                            if (this.has(k) && i === c++) {
                                return k;
                            }
                        }
                    },
                    setItem: function(k, v) {
                        if (!this.has(k)) {
                            this.length++;
                        }
                        this.items[k] = v;
                    },
                    removeItem: function(k) {
                        if (this.has(k)) {
                            delete this.items[k];
                            this.length--;
                        }
                    },
                    getItem: function(k){ return this.has(k) ? this.items[k] : null; },
                    clear: function(){ for (var k in this.list){ this.removeItem(k); } },
                    toString: function(){ return this.length+' items in '+this.name+'Storage'; }
                }// end _.storageAPI
            };

            // setup the primary store fn
            if (window.store){ _.conflict = window.store; }
            var store =
                // safely set this up (throws error in IE10/32bit mode for local files)
                _.Store("local");
            store.local = store;// for completeness
            store._ = _;// for extenders and debuggers...
            // safely setup store.session (throws exception in FF for file:/// urls)
            store.area("session");

            //Expose store to the global object
            window.store = store;

            if (typeof define === 'function' && define.amd !== undefined) {
                define(function () {
                    return store;
                });
            } else if (module.exports) {
                module.exports = store;
            }

        })(this, this.define);
      }).call(context);

      queryString = context.queryString;
      store = context.store;

      function extend (obj) {
        if (!isObject(obj)) {
          return obj;
        }
        var source, prop;
        for (var i = 1, length = arguments.length; i < length; i++) {
          source = arguments[i];
          for (prop in source) {
            obj[prop] = source[prop];
          }
        }
        return obj;
      }

      function isArray (obj) {
        return '[object Array]' === Object.prototype.toString.call(obj);
      }

      function isObject (obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;
      }

      function isString (value) {
        return typeof value == 'string' || (value && typeof value == 'object' &&
          Object.prototype.toString.call(value) == '[object String]') || false;
      }

      function uuidv4 (){
        var d = perfnow().now();
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = (d + Math.random()*16)%16 | 0;
          d = Math.floor(d/16);
          return (c=='x' ? r : (r&0x3|0x8)).toString(16);
        });
        return uuid;
      }

      var defaults = {
          transport: '',
          queueTimeout: 100
        },
        localStore = store.namespace('gumshoe'),
        storage = store.namespace('gumshoe').session,
        queue = storage('queue') || [],
        transports = {};

      if (!isArray(queue)) {
        queue = [];
      }

      function gumshoe (options) {
        var clientUuid = localStore('clientUuid');

        options = extend({}, defaults, options);

        // always ensure options.transport is an array.
        if (isString(options.transport)) {
          options.transport = [options.transport];
        }
        else if (!isArray(options.transport)) {
          throw 'Gumeshoe: Transport property must be a [String] or [Array].';
        }

        // store a client id to identify a client long-term. Google Analytics uses
        // the value, combined with other factors, to determine unique users. we
        // duplicate the same kind of value to assist GA.
        if (!clientUuid) {
          clientUuid = uuidv4();
          localStore({ clientUuid: clientUuid });
        }

        options.clientUuid = clientUuid;

        session(options.sessionFn);

        gumshoe.options = options;
      }

      function each (obj, iterator, context) {
        if (obj === null) {
          return;
        }

        if (Array.prototype.forEach && obj.forEach === Array.prototype.forEach) {
          obj.forEach(iterator, context);
        }
        else if (obj.length === +obj.length) {
          for (var i = 0, l = obj.length; i < l; i++) {
            if (iterator.call(context, obj[i], i, obj) === {}) {
              return;
            }
          }
        }
        else {
          for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
              if (iterator.call(context, obj[key], key, obj) === {}) {
                return;
              }
            }
          }
        }
      }

      function map (obj, iterator, context) {
        var results = [];

        if (!obj) {
          return results;
        }

        if (Array.prototype.map && obj.map === Array.prototype.map) {
          return obj.map(iterator, context);
        }

        each(obj, function(value, index, list) {
          results[results.length] = iterator.call(context, value, index, list);
        });

        return results;
      }

      function collectPlugins () {
        var result,
          plugins = navigator.plugins || [];

        result = map(plugins, function (plugin) {
          var mimeTypes = map(plugin, function (mimeType) {
            var type = mimeType.type;

            if (mimeType.suffixes) {
              type += '~' + mimeType.suffixes;
            }

            return type;
          });

          return {
            description: plugin.description,
            filename: plugin.filename,
            mimeTypes: mimeTypes,
            name: plugin.name
          };
        });

        return result;
      }

      function collect () {

        function getViewport() {
          var e = window, a = 'inner';
          if (!('innerWidth' in window )) {
            a = 'client';
            e = document.documentElement || document.body;
          }
          return { width : e[ a+'Width' ] , height : e[ a+'Height' ] };
        }

        var viewport = getViewport(),
          query = queryString.parse(location.search),
          result = {
            // utmcs Character set (e.g. ISO-8859-1)
            characterSet: document.characterSet || document.charset || document.inputEncoding || 'Unknown',

            // utmsc Screen colour depth (e.g. 24-bit)
            colorDepth: screen.colorDepth + '',

            // gclid Gclid is a globally unique tracking parameter (Google Click Identifier)
            googleClickId: query.gclid || '',

            hash: window.location.hash,
            host: window.location.host,

            // utmhn Hostname
            hostName: window.location.hostname,

            // utmip IP address
            ipAddress: '',

            // utmje Java enabled?
            javaEnabled: navigator.javaEnabled ? navigator.javaEnabled() : false,

            // utmul Language code (e.g. en-us)
            language: window.navigator.userLanguage || window.navigator.language || 'Unknown',

            // login key: ?lk=
            loginKey: query.lk || '',

            // IE9 doesn't support this
            origin: window.location.origin || '',

            // utmp  Page path
            path: window.location.pathname,
            platform: window.navigator.platform,
            plugins: collectPlugins(),
            port: window.location.port || 80,
            // promotional key: pkey
            promotionKey: query.pkey || '',
            protocol: window.location.protocol,

            queryString: window.location.search,

            // utmr  Full referral URL
            referer: document.referrer,

            screenAvailHeight: screen.availHeight,
            screenAvailWidth: screen.availWidth,
            screenHeight: screen.height,
            screenOrientationAngle: '',
            screenOrientationType: '',
            screenPixelDepth: screen.pixelDepth + '',
            // utmsr Screen resolution
            screenResolution: screen.width + 'x' + screen.height,
            screenWidth: screen.width,

            // utmdt Page title
            title: document.title,

            url: window.location.href,
            userAgent: window.navigator.userAgent,
            utmCampaign: query.utm_campaign || '',
            utmContent: query.utm_content || '',
            utmMedium: query.utm_medium || '',
            utmSource: query.utm_source || '',
            utmTerm: query.utm_term || '',

            // utmvp Viewport resolution
            viewportHeight: viewport.height,
            viewportResolution: viewport.width + 'x' + viewport.height,
            viewportWidth: viewport.width
          },

          intFields = [
            'port', 'screenAvailHeight', 'screenAvailWidth', 'screenHeight',
            'screenOrientationAngle', 'screenWidth', 'viewportHeight', 'viewportWidth'
          ],
          prop,
          value;

        // some browsers don't support navigator.javaEnabled(), it's always undefined.
        if (result.javaEnabled === undefined) {
          result.javaEnabled = false;
        }

        // IE 8, 9 don't support this. Yay.
        if (screen.orientation) {
          result.screenOrientationAngle = parseInt(screen.orientation.angle ? screen.orientation.angle : '0');
          result.screenOrientationType = screen.orientation.type ? screen.orientation.type : '';

          if (isNaN(result.screenOrientationAngle)) {
            result.screenOrientationAngle = 0;
          }
        }

        // assert that these values are ints
        for (var i = 0; i < intFields.length; i++) {
          prop = intFields[i];
          value = parseInt(result[prop]);

          if (isNaN(value)) {
            value = 0;
          }

          result[prop] = value;
        }

        return result;
      }

      /**
       * @private
       * @method session
       *
       * @note
       * Gumshoe Session Rules
       *
       *  Generate a new Session ID if any of the following criteria are met:
       *
       *  1. User opens new tab or window (browser default behavior)
       *  2. User has been inactive longer than 30 minutes
       *  3. User has visited withinin the same session, but a UTM
       *     query string parameter has changed.
       */
      function session (fn) {

        // returns a simple object containing utm parameters
        function getUtm () {
          return {
            campaign: query.utm_campaign || '',
            medium: query.utm_medium || '',
            source: query.utm_source || '',
            utmTerm: query.utm_term || ''
          };
        }

        var now = (new Date()).getTime(),
          query = queryString.parse(location.search),
          lastUtm = storage('utm') || getUtm(),
          utm = getUtm(),
          timestamp,
          difference;

        // save the current state of the utm parameters
        storage('utm', utm);

        // set a session based uuid
        if (!storage('uuid')) {
          storage('uuid', uuidv4());
          storage('timestamp', now);
        }
        else {
          timestamp = storage('timestamp');
          difference = now - timestamp;

          if (fn) {
            /* jshint validthis: true */
            if (fn.call(this, timestamp, difference, query)) {
              storage('uuid', uuidv4());
            }
          }
          else if (JSON.stringify(lastUtm) !== JSON.stringify(utm) || difference > (1000 * 60 * 30)) {
            storage('uuid', uuidv4());
          }
        }
      }

      function send(eventName, eventData) {
        var pageData = collect(),
          baseData = {
            clientUuid: gumshoe.options.clientUuid,
            eventName: eventName,
            eventData: eventData || {},
            gumshoe: '0.8.1',
            pageData: pageData,
            sessionUuid: storage('uuid'),
            timestamp: (new Date()).getTime(),
            timezoneOffset: (new Date()).getTimezoneOffset(),
            uuid: uuidv4()
          };

        // since we're dealing with timeouts now, we need to reassert the
        // session ID for each event sent.
        session(gumshoe.options.sessionFn);

        if (gumshoe.options.transport) {
          for (var i = 0; i < gumshoe.options.transport.length; i++) {
            var transportName = gumshoe.options.transport[i],
              transport,
              data;

            if (transportName && transports[transportName]) {
              transport = transports[transportName];

              // allow each transport to extend the data with more information
              // or transform it how they'd like. transports cannot however,
              // modify eventData sent from the client.
              data = transport.map ? transport.map(baseData) : baseData;

              // extend our data with whatever came back from the transport
              data = extend(baseData, data);

              // TODO: remove this. gumshoe shouldn't care what format this is in
              if (!isString(data.eventData)) {
                data.eventData = JSON.stringify(data.eventData);
              }

              // TODO: remove this. gumshoe shouldn't care what format this is in
              if (!isString(data.pageData.plugins)) {
                data.pageData.plugins = JSON.stringify(data.pageData.plugins);
              }

              // TODO: remove this. temporary bugfix for apps
              if (!data.pageData.ipAddress) {
                data.pageData.ipAddress = '<unknown>';
              }

              pushEvent(eventName, transportName, data);
            }
            else {
              throw 'Gumshoe: The transport name: ' + transportName + ', doesn\'t map to a valid transport.';
            }
          }
        }

        /*if (!transportFound) {
          throw 'Gumshoe: No valid transports were found.';
        }*/
      }

      function nextEvent () {

        if (!queue.length) {
          return;
        }

        // granb the next event from the queue and remove it.
        var nevent = queue.shift(),
          transport = transports[nevent.transportName];

        storage('queue', queue);
        transport.send(nevent.data, function (err, result) {
          // we care if an error was thrown, created, or captured
          // if there is an error, add the item back into the queue
          if (err) {
            console.warn('Gumshoe: Retrying. Error received from transport: ' + nevent.transportName + ', for event: ' + nevent.eventName);
            queue.push(nevent);
          }
        });

        setTimeout(nextEvent, gumshoe.options.queueTimeout);
      }

      function pushEvent (eventName, transportName, data) {
        var transport;

        // if we're dealing with a fake storage object
        // (eg. sessionStorage isn't available) then don't
        // even bother queueing the data.
        if (storage.isFake()) {
          transport = transports[transportName];
          transport.send(data);

          return;
        }

        // add the event data to the queue
        queue.push({
          eventName: eventName,
          transportName: transportName,
          data: data
        });

        // put our newly modified queue in session storage
        storage('queue', queue);

        setTimeout(nextEvent, gumshoe.options.queueTimeout);
      }

      function transport (tp) {
        if (!tp.name) {
          throw 'Gumshoe: Transport [Object] must have a name defined.';
        }

        transports[tp.name] = tp;
      }

      // setup some static properties
      gumshoe.version = '0.8.1';
      gumshoe.options = {};

      // setup some static methods
      gumshoe.extend = extend;
      gumshoe.reqwest = context.reqwest;
      gumshoe.send = send;
      gumshoe.transport = transport;
      gumshoe.uuid = uuidv4;

      // setup some internal stuff for access
      gumshoe._ = {
        collect: collect,
        localStorage: localStore,
        queryString: queryString,
        queue: queue,
        storage: storage,
        transports: transports
      };

      return gumshoe;

      /*
      if (root.gumshoe) {
        if (root.gumshoe.ready) {
          root.gumshoe.ready = gumshoe.ready = root.gumshoe.ready;
          root.gumshoe = gumshoe;

          if (!isFunction(root.gumshoe.ready.resolve)) {
            throw 'Gumshoe: gumshoe.ready was predefined, but is not a Promise/A deferred.';
          }

          root.gumshoe.ready.resolve();
        }
      }
      else {
        root.gumshoe = gumshoe;
      }
      */

    }

    module.exports = gumshoeFactory;
    });

    /**
     * @module SDK
     */
    /**
     * The analytics collection endpoint.
     * @ignore
     */
    var ANALYTICS_ENDPOINT = 'https://info.muxy.io';
    /**
     * The Analytics class allows for sending events and metrics to Google Analytics
     * with a given UA_STRING.
     */
    var Analytics = /** @class */ (function () {
        function Analytics(uaString, loadPromise) {
            var _this = this;
            this.ready = false;
            this.uaString = uaString;
            this.loadPromise = loadPromise;
            this.user = null;
            this.gumshoe = gumshoe();
            this.gumshoe.transport({
                map: this.mapData.bind(this),
                name: 'muxy-extension-sdk',
                send: function (data, fn) {
                    var d = data;
                    // Remove stuff that we don't want to send up
                    delete d.pageData;
                    delete d.clientUuid;
                    delete d.uuid;
                    delete d.sessionUuid;
                    _this.gumshoe.reqwest({
                        contentType: 'application/x-www-form-urlencoded',
                        crossOrigin: true,
                        data: d,
                        method: 'POST',
                        url: ANALYTICS_ENDPOINT
                    }, function () {
                        if (fn) {
                            fn(null);
                        }
                    });
                }
            });
            this.gumshoe({ transport: 'muxy-extension-sdk' });
            this.loadPromise.then(function () {
                _this.ready = true;
            });
        }
        /**
         * Internal function to map event data to GA format.
         * @private
         */
        Analytics.prototype.mapData = function (data) {
            var appName = 'Muxy';
            var ip = '<unknown ip>';
            var channelID = null;
            var opaqueID = null;
            var userID = null;
            var role = null;
            var game = null;
            var videoMode = null;
            var latency = null;
            var bitrate = null;
            if (this.user) {
                ip = this.user.ip;
                channelID = this.user.channelID;
                opaqueID = this.user.twitchOpaqueID;
                userID = !opaqueID || opaqueID[0] !== 'U' ? null : opaqueID;
                role = this.user.role;
                game = this.user.game;
                videoMode = this.user.videoMode;
                latency = this.user.latency;
                bitrate = this.user.bitrate;
            }
            var pd = data.pageData;
            pd.ipAddress = ip;
            var result = {
                aid: appName,
                an: appName,
                cd1: channelID,
                cd2: role,
                cd3: game,
                cd4: videoMode,
                cid: opaqueID || data.clientUuid || data.sessionUuid || '00000000-0000-0000-0000-000000000000',
                cm2: latency,
                cm3: bitrate,
                dh: pd.hostName,
                dl: pd.url,
                dp: pd.path,
                dr: pd.referer,
                dt: pd.title,
                ea: undefined,
                ec: undefined,
                el: undefined,
                ev: undefined,
                je: pd.javaEnabled,
                sr: pd.screenResolution,
                t: 'event',
                tid: this.uaString,
                ua: pd.userAgent,
                uid: userID,
                uip: ip,
                ul: pd.language,
                v: 1,
                vp: pd.viewportHeight + "x" + pd.viewportWidth
            };
            if (data.eventName === 'page.view') {
                result.t = 'pageview';
            }
            else {
                result.ec = data.eventName;
                result.ea = data.eventData.name;
                result.el = data.eventData.label;
                result.ev = data.eventData.value;
            }
            return result;
        };
        /**
         * Sends an arbitrary even to Google Analytics.
         *
         * @param {string} category - The high-level category to collect this event under.
         * @param {string} name - A unique identifier for this event.
         * @param {*} value - (optional) A value to associate with this event (defaults to 1).
         * @param {string} label - (optional) A human-readable label for this event.
         */
        Analytics.prototype.sendEvent = function (category, name, value, label) {
            if (value === void 0) { value = 1; }
            if (label === void 0) { label = ''; }
            if (!this.ready) {
                throw new Error('muxy.Analytics used before ready');
            }
            var data = { name: name, value: value, label: label };
            this.gumshoe.send(category, data);
        };
        /**
         * Sends a simple page view event to Google Analytics.
         */
        Analytics.prototype.pageView = function () {
            if (!this.ready) {
                throw new Error('muxy.Analytics used before ready');
            }
            this.gumshoe.send('page.view', {});
        };
        return Analytics;
    }());

    var DebuggingOptions = /** @class */ (function () {
        function DebuggingOptions() {
            var noop = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                /* Default to doing nothing on callback */
            };
            this.options = {
                onPubsubListen: noop,
                onPubsubReceive: noop,
                onPubsubSend: noop
            };
            if (window.location && window.location.search) {
                var qp = new URLSearchParams(window.location.search);
                this.options.url = this.readFromQuery(qp, 'url');
                this.options.url = this.readFromQuery(qp, 'channelID');
                this.options.url = this.readFromQuery(qp, 'userID');
                this.options.url = this.readFromQuery(qp, 'role');
                this.options.url = this.readFromQuery(qp, 'environment');
            }
        }
        DebuggingOptions.prototype.url = function (url) {
            this.options.url = /^https?:\/\//.test(url) ? url : "https://" + url;
            return this;
        };
        DebuggingOptions.prototype.channelID = function (cid) {
            this.options.channelID = cid;
            return this;
        };
        DebuggingOptions.prototype.userID = function (uid) {
            this.options.userID = uid;
            return this;
        };
        DebuggingOptions.prototype.role = function (r) {
            this.options.role = r;
            return this;
        };
        DebuggingOptions.prototype.jwt = function (j) {
            this.options.jwt = j;
            return this;
        };
        DebuggingOptions.prototype.environment = function (e) {
            this.options.environment = e;
            return this;
        };
        DebuggingOptions.prototype.onPubsubSend = function (cb) {
            this.options.onPubsubSend = cb;
            return this;
        };
        DebuggingOptions.prototype.onPubsubReceive = function (cb) {
            this.options.onPubsubReceive = cb;
            return this;
        };
        DebuggingOptions.prototype.onPubsubListen = function (cb) {
            this.options.onPubsubListen = cb;
            return this;
        };
        DebuggingOptions.prototype.readFromQuery = function (params, key) {
            return params.get("muxy_debug_" + key);
        };
        return DebuggingOptions;
    }());

    var pusher = createCommonjsModule(function (module, exports) {
    /*!
     * Pusher JavaScript Library v4.3.1
     * https://pusher.com/
     *
     * Copyright 2017, Pusher
     * Released under the MIT licence.
     */

    (function webpackUniversalModuleDefinition(root, factory) {
    	module.exports = factory();
    })(commonjsGlobal, function() {
    return /******/ (function(modules) { // webpackBootstrap
    /******/ 	// The module cache
    /******/ 	var installedModules = {};

    /******/ 	// The require function
    /******/ 	function __webpack_require__(moduleId) {

    /******/ 		// Check if module is in cache
    /******/ 		if(installedModules[moduleId])
    /******/ 			return installedModules[moduleId].exports;

    /******/ 		// Create a new module (and put it into the cache)
    /******/ 		var module = installedModules[moduleId] = {
    /******/ 			exports: {},
    /******/ 			id: moduleId,
    /******/ 			loaded: false
    /******/ 		};

    /******/ 		// Execute the module function
    /******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

    /******/ 		// Flag the module as loaded
    /******/ 		module.loaded = true;

    /******/ 		// Return the exports of the module
    /******/ 		return module.exports;
    /******/ 	}


    /******/ 	// expose the modules object (__webpack_modules__)
    /******/ 	__webpack_require__.m = modules;

    /******/ 	// expose the module cache
    /******/ 	__webpack_require__.c = installedModules;

    /******/ 	// __webpack_public_path__
    /******/ 	__webpack_require__.p = "";

    /******/ 	// Load entry module and return exports
    /******/ 	return __webpack_require__(0);
    /******/ })
    /************************************************************************/
    /******/ ([
    /* 0 */
    /***/ (function(module, exports, __webpack_require__) {
    	var pusher_1 = __webpack_require__(1);
    	module.exports = pusher_1["default"];


    /***/ }),
    /* 1 */
    /***/ (function(module, exports, __webpack_require__) {
    	var runtime_1 = __webpack_require__(2);
    	var Collections = __webpack_require__(9);
    	var dispatcher_1 = __webpack_require__(24);
    	var timeline_1 = __webpack_require__(39);
    	var level_1 = __webpack_require__(40);
    	var StrategyBuilder = __webpack_require__(41);
    	var timers_1 = __webpack_require__(12);
    	var defaults_1 = __webpack_require__(5);
    	var DefaultConfig = __webpack_require__(71);
    	var logger_1 = __webpack_require__(8);
    	var factory_1 = __webpack_require__(43);
    	var url_store_1 = __webpack_require__(14);
    	var Pusher = (function () {
    	    function Pusher(app_key, options) {
    	        var _this = this;
    	        checkAppKey(app_key);
    	        options = options || {};
    	        if (!options.cluster && !(options.wsHost || options.httpHost)) {
    	            var suffix = url_store_1["default"].buildLogSuffix("javascriptQuickStart");
    	            logger_1["default"].warn("You should always specify a cluster when connecting. " + suffix);
    	        }
    	        this.key = app_key;
    	        this.config = Collections.extend(DefaultConfig.getGlobalConfig(), options.cluster ? DefaultConfig.getClusterConfig(options.cluster) : {}, options);
    	        this.channels = factory_1["default"].createChannels();
    	        this.global_emitter = new dispatcher_1["default"]();
    	        this.sessionID = Math.floor(Math.random() * 1000000000);
    	        this.timeline = new timeline_1["default"](this.key, this.sessionID, {
    	            cluster: this.config.cluster,
    	            features: Pusher.getClientFeatures(),
    	            params: this.config.timelineParams || {},
    	            limit: 50,
    	            level: level_1["default"].INFO,
    	            version: defaults_1["default"].VERSION
    	        });
    	        if (!this.config.disableStats) {
    	            this.timelineSender = factory_1["default"].createTimelineSender(this.timeline, {
    	                host: this.config.statsHost,
    	                path: "/timeline/v2/" + runtime_1["default"].TimelineTransport.name
    	            });
    	        }
    	        var getStrategy = function (options) {
    	            var config = Collections.extend({}, _this.config, options);
    	            return StrategyBuilder.build(runtime_1["default"].getDefaultStrategy(config), config);
    	        };
    	        this.connection = factory_1["default"].createConnectionManager(this.key, Collections.extend({ getStrategy: getStrategy,
    	            timeline: this.timeline,
    	            activityTimeout: this.config.activity_timeout,
    	            pongTimeout: this.config.pong_timeout,
    	            unavailableTimeout: this.config.unavailable_timeout
    	        }, this.config, { useTLS: this.shouldUseTLS() }));
    	        this.connection.bind('connected', function () {
    	            _this.subscribeAll();
    	            if (_this.timelineSender) {
    	                _this.timelineSender.send(_this.connection.isUsingTLS());
    	            }
    	        });
    	        this.connection.bind('message', function (params) {
    	            var internal = (params.event.indexOf('pusher_internal:') === 0);
    	            if (params.channel) {
    	                var channel = _this.channel(params.channel);
    	                if (channel) {
    	                    channel.handleEvent(params.event, params.data);
    	                }
    	            }
    	            if (!internal) {
    	                _this.global_emitter.emit(params.event, params.data);
    	            }
    	        });
    	        this.connection.bind('connecting', function () {
    	            _this.channels.disconnect();
    	        });
    	        this.connection.bind('disconnected', function () {
    	            _this.channels.disconnect();
    	        });
    	        this.connection.bind('error', function (err) {
    	            logger_1["default"].warn('Error', err);
    	        });
    	        Pusher.instances.push(this);
    	        this.timeline.info({ instances: Pusher.instances.length });
    	        if (Pusher.isReady) {
    	            this.connect();
    	        }
    	    }
    	    Pusher.ready = function () {
    	        Pusher.isReady = true;
    	        for (var i = 0, l = Pusher.instances.length; i < l; i++) {
    	            Pusher.instances[i].connect();
    	        }
    	    };
    	    Pusher.log = function (message) {
    	        if (Pusher.logToConsole && (window).console && (window).console.log) {
    	            (window).console.log(message);
    	        }
    	    };
    	    Pusher.getClientFeatures = function () {
    	        return Collections.keys(Collections.filterObject({ "ws": runtime_1["default"].Transports.ws }, function (t) { return t.isSupported({}); }));
    	    };
    	    Pusher.prototype.channel = function (name) {
    	        return this.channels.find(name);
    	    };
    	    Pusher.prototype.allChannels = function () {
    	        return this.channels.all();
    	    };
    	    Pusher.prototype.connect = function () {
    	        this.connection.connect();
    	        if (this.timelineSender) {
    	            if (!this.timelineSenderTimer) {
    	                var usingTLS = this.connection.isUsingTLS();
    	                var timelineSender = this.timelineSender;
    	                this.timelineSenderTimer = new timers_1.PeriodicTimer(60000, function () {
    	                    timelineSender.send(usingTLS);
    	                });
    	            }
    	        }
    	    };
    	    Pusher.prototype.disconnect = function () {
    	        this.connection.disconnect();
    	        if (this.timelineSenderTimer) {
    	            this.timelineSenderTimer.ensureAborted();
    	            this.timelineSenderTimer = null;
    	        }
    	    };
    	    Pusher.prototype.bind = function (event_name, callback, context) {
    	        this.global_emitter.bind(event_name, callback, context);
    	        return this;
    	    };
    	    Pusher.prototype.unbind = function (event_name, callback, context) {
    	        this.global_emitter.unbind(event_name, callback, context);
    	        return this;
    	    };
    	    Pusher.prototype.bind_global = function (callback) {
    	        this.global_emitter.bind_global(callback);
    	        return this;
    	    };
    	    Pusher.prototype.unbind_global = function (callback) {
    	        this.global_emitter.unbind_global(callback);
    	        return this;
    	    };
    	    Pusher.prototype.unbind_all = function (callback) {
    	        this.global_emitter.unbind_all();
    	        return this;
    	    };
    	    Pusher.prototype.subscribeAll = function () {
    	        var channelName;
    	        for (channelName in this.channels.channels) {
    	            if (this.channels.channels.hasOwnProperty(channelName)) {
    	                this.subscribe(channelName);
    	            }
    	        }
    	    };
    	    Pusher.prototype.subscribe = function (channel_name) {
    	        var channel = this.channels.add(channel_name, this);
    	        if (channel.subscriptionPending && channel.subscriptionCancelled) {
    	            channel.reinstateSubscription();
    	        }
    	        else if (!channel.subscriptionPending && this.connection.state === "connected") {
    	            channel.subscribe();
    	        }
    	        return channel;
    	    };
    	    Pusher.prototype.unsubscribe = function (channel_name) {
    	        var channel = this.channels.find(channel_name);
    	        if (channel && channel.subscriptionPending) {
    	            channel.cancelSubscription();
    	        }
    	        else {
    	            channel = this.channels.remove(channel_name);
    	            if (channel && this.connection.state === "connected") {
    	                channel.unsubscribe();
    	            }
    	        }
    	    };
    	    Pusher.prototype.send_event = function (event_name, data, channel) {
    	        return this.connection.send_event(event_name, data, channel);
    	    };
    	    Pusher.prototype.shouldUseTLS = function () {
    	        if (runtime_1["default"].getProtocol() === "https:") {
    	            return true;
    	        }
    	        else if (this.config.forceTLS === true) {
    	            return true;
    	        }
    	        else {
    	            return Boolean(this.config.encrypted);
    	        }
    	    };
    	    Pusher.instances = [];
    	    Pusher.isReady = false;
    	    Pusher.logToConsole = false;
    	    Pusher.Runtime = runtime_1["default"];
    	    Pusher.ScriptReceivers = runtime_1["default"].ScriptReceivers;
    	    Pusher.DependenciesReceivers = runtime_1["default"].DependenciesReceivers;
    	    Pusher.auth_callbacks = runtime_1["default"].auth_callbacks;
    	    return Pusher;
    	}());
    	exports.__esModule = true;
    	exports["default"] = Pusher;
    	function checkAppKey(key) {
    	    if (key === null || key === undefined) {
    	        throw "You must pass your app key when you instantiate Pusher.";
    	    }
    	}
    	runtime_1["default"].setup(Pusher);


    /***/ }),
    /* 2 */
    /***/ (function(module, exports, __webpack_require__) {
    	var dependencies_1 = __webpack_require__(3);
    	var xhr_auth_1 = __webpack_require__(7);
    	var jsonp_auth_1 = __webpack_require__(15);
    	var script_request_1 = __webpack_require__(16);
    	var jsonp_request_1 = __webpack_require__(17);
    	var script_receiver_factory_1 = __webpack_require__(4);
    	var jsonp_timeline_1 = __webpack_require__(18);
    	var transports_1 = __webpack_require__(19);
    	var net_info_1 = __webpack_require__(26);
    	var default_strategy_1 = __webpack_require__(27);
    	var transport_connection_initializer_1 = __webpack_require__(28);
    	var http_1 = __webpack_require__(29);
    	var Runtime = {
    	    nextAuthCallbackID: 1,
    	    auth_callbacks: {},
    	    ScriptReceivers: script_receiver_factory_1.ScriptReceivers,
    	    DependenciesReceivers: dependencies_1.DependenciesReceivers,
    	    getDefaultStrategy: default_strategy_1["default"],
    	    Transports: transports_1["default"],
    	    transportConnectionInitializer: transport_connection_initializer_1["default"],
    	    HTTPFactory: http_1["default"],
    	    TimelineTransport: jsonp_timeline_1["default"],
    	    getXHRAPI: function () {
    	        return window.XMLHttpRequest;
    	    },
    	    getWebSocketAPI: function () {
    	        return window.WebSocket || window.MozWebSocket;
    	    },
    	    setup: function (PusherClass) {
    	        var _this = this;
    	        window.Pusher = PusherClass;
    	        var initializeOnDocumentBody = function () {
    	            _this.onDocumentBody(PusherClass.ready);
    	        };
    	        if (!window.JSON) {
    	            dependencies_1.Dependencies.load("json2", {}, initializeOnDocumentBody);
    	        }
    	        else {
    	            initializeOnDocumentBody();
    	        }
    	    },
    	    getDocument: function () {
    	        return document;
    	    },
    	    getProtocol: function () {
    	        return this.getDocument().location.protocol;
    	    },
    	    getAuthorizers: function () {
    	        return { ajax: xhr_auth_1["default"], jsonp: jsonp_auth_1["default"] };
    	    },
    	    onDocumentBody: function (callback) {
    	        var _this = this;
    	        if (document.body) {
    	            callback();
    	        }
    	        else {
    	            setTimeout(function () {
    	                _this.onDocumentBody(callback);
    	            }, 0);
    	        }
    	    },
    	    createJSONPRequest: function (url, data) {
    	        return new jsonp_request_1["default"](url, data);
    	    },
    	    createScriptRequest: function (src) {
    	        return new script_request_1["default"](src);
    	    },
    	    getLocalStorage: function () {
    	        try {
    	            return window.localStorage;
    	        }
    	        catch (e) {
    	            return undefined;
    	        }
    	    },
    	    createXHR: function () {
    	        if (this.getXHRAPI()) {
    	            return this.createXMLHttpRequest();
    	        }
    	        else {
    	            return this.createMicrosoftXHR();
    	        }
    	    },
    	    createXMLHttpRequest: function () {
    	        var Constructor = this.getXHRAPI();
    	        return new Constructor();
    	    },
    	    createMicrosoftXHR: function () {
    	        return new ActiveXObject("Microsoft.XMLHTTP");
    	    },
    	    getNetwork: function () {
    	        return net_info_1.Network;
    	    },
    	    createWebSocket: function (url) {
    	        var Constructor = this.getWebSocketAPI();
    	        return new Constructor(url);
    	    },
    	    createSocketRequest: function (method, url) {
    	        if (this.isXHRSupported()) {
    	            return this.HTTPFactory.createXHR(method, url);
    	        }
    	        else if (this.isXDRSupported(url.indexOf("https:") === 0)) {
    	            return this.HTTPFactory.createXDR(method, url);
    	        }
    	        else {
    	            throw "Cross-origin HTTP requests are not supported";
    	        }
    	    },
    	    isXHRSupported: function () {
    	        var Constructor = this.getXHRAPI();
    	        return Boolean(Constructor) && (new Constructor()).withCredentials !== undefined;
    	    },
    	    isXDRSupported: function (useTLS) {
    	        var protocol = useTLS ? "https:" : "http:";
    	        var documentProtocol = this.getProtocol();
    	        return Boolean((window['XDomainRequest'])) && documentProtocol === protocol;
    	    },
    	    addUnloadListener: function (listener) {
    	        if (window.addEventListener !== undefined) {
    	            window.addEventListener("unload", listener, false);
    	        }
    	        else if (window.attachEvent !== undefined) {
    	            window.attachEvent("onunload", listener);
    	        }
    	    },
    	    removeUnloadListener: function (listener) {
    	        if (window.addEventListener !== undefined) {
    	            window.removeEventListener("unload", listener, false);
    	        }
    	        else if (window.detachEvent !== undefined) {
    	            window.detachEvent("onunload", listener);
    	        }
    	    }
    	};
    	exports.__esModule = true;
    	exports["default"] = Runtime;


    /***/ }),
    /* 3 */
    /***/ (function(module, exports, __webpack_require__) {
    	var script_receiver_factory_1 = __webpack_require__(4);
    	var defaults_1 = __webpack_require__(5);
    	var dependency_loader_1 = __webpack_require__(6);
    	exports.DependenciesReceivers = new script_receiver_factory_1.ScriptReceiverFactory("_pusher_dependencies", "Pusher.DependenciesReceivers");
    	exports.Dependencies = new dependency_loader_1["default"]({
    	    cdn_http: defaults_1["default"].cdn_http,
    	    cdn_https: defaults_1["default"].cdn_https,
    	    version: defaults_1["default"].VERSION,
    	    suffix: defaults_1["default"].dependency_suffix,
    	    receivers: exports.DependenciesReceivers
    	});


    /***/ }),
    /* 4 */
    /***/ (function(module, exports) {
    	var ScriptReceiverFactory = (function () {
    	    function ScriptReceiverFactory(prefix, name) {
    	        this.lastId = 0;
    	        this.prefix = prefix;
    	        this.name = name;
    	    }
    	    ScriptReceiverFactory.prototype.create = function (callback) {
    	        this.lastId++;
    	        var number = this.lastId;
    	        var id = this.prefix + number;
    	        var name = this.name + "[" + number + "]";
    	        var called = false;
    	        var callbackWrapper = function () {
    	            if (!called) {
    	                callback.apply(null, arguments);
    	                called = true;
    	            }
    	        };
    	        this[number] = callbackWrapper;
    	        return { number: number, id: id, name: name, callback: callbackWrapper };
    	    };
    	    ScriptReceiverFactory.prototype.remove = function (receiver) {
    	        delete this[receiver.number];
    	    };
    	    return ScriptReceiverFactory;
    	}());
    	exports.ScriptReceiverFactory = ScriptReceiverFactory;
    	exports.ScriptReceivers = new ScriptReceiverFactory("_pusher_script_", "Pusher.ScriptReceivers");


    /***/ }),
    /* 5 */
    /***/ (function(module, exports) {
    	var Defaults = {
    	    VERSION: "4.3.1",
    	    PROTOCOL: 7,
    	    host: 'ws.pusherapp.com',
    	    ws_port: 80,
    	    wss_port: 443,
    	    ws_path: '',
    	    sockjs_host: 'sockjs.pusher.com',
    	    sockjs_http_port: 80,
    	    sockjs_https_port: 443,
    	    sockjs_path: "/pusher",
    	    stats_host: 'stats.pusher.com',
    	    channel_auth_endpoint: '/pusher/auth',
    	    channel_auth_transport: 'ajax',
    	    activity_timeout: 120000,
    	    pong_timeout: 30000,
    	    unavailable_timeout: 10000,
    	    cdn_http: 'http://js.pusher.com',
    	    cdn_https: 'https://js.pusher.com',
    	    dependency_suffix: ''
    	};
    	exports.__esModule = true;
    	exports["default"] = Defaults;


    /***/ }),
    /* 6 */
    /***/ (function(module, exports, __webpack_require__) {
    	var script_receiver_factory_1 = __webpack_require__(4);
    	var runtime_1 = __webpack_require__(2);
    	var DependencyLoader = (function () {
    	    function DependencyLoader(options) {
    	        this.options = options;
    	        this.receivers = options.receivers || script_receiver_factory_1.ScriptReceivers;
    	        this.loading = {};
    	    }
    	    DependencyLoader.prototype.load = function (name, options, callback) {
    	        var self = this;
    	        if (self.loading[name] && self.loading[name].length > 0) {
    	            self.loading[name].push(callback);
    	        }
    	        else {
    	            self.loading[name] = [callback];
    	            var request = runtime_1["default"].createScriptRequest(self.getPath(name, options));
    	            var receiver = self.receivers.create(function (error) {
    	                self.receivers.remove(receiver);
    	                if (self.loading[name]) {
    	                    var callbacks = self.loading[name];
    	                    delete self.loading[name];
    	                    var successCallback = function (wasSuccessful) {
    	                        if (!wasSuccessful) {
    	                            request.cleanup();
    	                        }
    	                    };
    	                    for (var i = 0; i < callbacks.length; i++) {
    	                        callbacks[i](error, successCallback);
    	                    }
    	                }
    	            });
    	            request.send(receiver);
    	        }
    	    };
    	    DependencyLoader.prototype.getRoot = function (options) {
    	        var cdn;
    	        var protocol = runtime_1["default"].getDocument().location.protocol;
    	        if ((options && options.useTLS) || protocol === "https:") {
    	            cdn = this.options.cdn_https;
    	        }
    	        else {
    	            cdn = this.options.cdn_http;
    	        }
    	        return cdn.replace(/\/*$/, "") + "/" + this.options.version;
    	    };
    	    DependencyLoader.prototype.getPath = function (name, options) {
    	        return this.getRoot(options) + '/' + name + this.options.suffix + '.js';
    	    };
    	    return DependencyLoader;
    	}());
    	exports.__esModule = true;
    	exports["default"] = DependencyLoader;


    /***/ }),
    /* 7 */
    /***/ (function(module, exports, __webpack_require__) {
    	var logger_1 = __webpack_require__(8);
    	var runtime_1 = __webpack_require__(2);
    	var url_store_1 = __webpack_require__(14);
    	var ajax = function (context, socketId, callback) {
    	    var self = this, xhr;
    	    xhr = runtime_1["default"].createXHR();
    	    xhr.open("POST", self.options.authEndpoint, true);
    	    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    	    for (var headerName in this.authOptions.headers) {
    	        xhr.setRequestHeader(headerName, this.authOptions.headers[headerName]);
    	    }
    	    xhr.onreadystatechange = function () {
    	        if (xhr.readyState === 4) {
    	            if (xhr.status === 200) {
    	                var data, parsed = false;
    	                try {
    	                    data = JSON.parse(xhr.responseText);
    	                    parsed = true;
    	                }
    	                catch (e) {
    	                    callback(true, 'JSON returned from webapp was invalid, yet status code was 200. Data was: ' + xhr.responseText);
    	                }
    	                if (parsed) {
    	                    callback(false, data);
    	                }
    	            }
    	            else {
    	                var suffix = url_store_1["default"].buildLogSuffix("authenticationEndpoint");
    	                logger_1["default"].warn(("Couldn't retrieve authentication info. " + xhr.status) +
    	                    ("Clients must be authenticated to join private or presence channels. " + suffix));
    	                callback(true, xhr.status);
    	            }
    	        }
    	    };
    	    xhr.send(this.composeQuery(socketId));
    	    return xhr;
    	};
    	exports.__esModule = true;
    	exports["default"] = ajax;


    /***/ }),
    /* 8 */
    /***/ (function(module, exports, __webpack_require__) {
    	var collections_1 = __webpack_require__(9);
    	var pusher_1 = __webpack_require__(1);
    	var Logger = {
    	    debug: function () {
    	        var args = [];
    	        for (var _i = 0; _i < arguments.length; _i++) {
    	            args[_i - 0] = arguments[_i];
    	        }
    	        if (!pusher_1["default"].log) {
    	            return;
    	        }
    	        pusher_1["default"].log(collections_1.stringify.apply(this, arguments));
    	    },
    	    warn: function () {
    	        var args = [];
    	        for (var _i = 0; _i < arguments.length; _i++) {
    	            args[_i - 0] = arguments[_i];
    	        }
    	        var message = collections_1.stringify.apply(this, arguments);
    	        if (pusher_1["default"].log) {
    	            pusher_1["default"].log(message);
    	        }
    	        else if ((window).console) {
    	            if ((window).console.warn) {
    	                (window).console.warn(message);
    	            }
    	            else if ((window).console.log) {
    	                (window).console.log(message);
    	            }
    	        }
    	    }
    	};
    	exports.__esModule = true;
    	exports["default"] = Logger;


    /***/ }),
    /* 9 */
    /***/ (function(module, exports, __webpack_require__) {
    	var base64_1 = __webpack_require__(10);
    	var util_1 = __webpack_require__(11);
    	function extend(target) {
    	    var sources = [];
    	    for (var _i = 1; _i < arguments.length; _i++) {
    	        sources[_i - 1] = arguments[_i];
    	    }
    	    for (var i = 0; i < sources.length; i++) {
    	        var extensions = sources[i];
    	        for (var property in extensions) {
    	            if (extensions[property] && extensions[property].constructor &&
    	                extensions[property].constructor === Object) {
    	                target[property] = extend(target[property] || {}, extensions[property]);
    	            }
    	            else {
    	                target[property] = extensions[property];
    	            }
    	        }
    	    }
    	    return target;
    	}
    	exports.extend = extend;
    	function stringify() {
    	    var m = ["Pusher"];
    	    for (var i = 0; i < arguments.length; i++) {
    	        if (typeof arguments[i] === "string") {
    	            m.push(arguments[i]);
    	        }
    	        else {
    	            m.push(safeJSONStringify(arguments[i]));
    	        }
    	    }
    	    return m.join(" : ");
    	}
    	exports.stringify = stringify;
    	function arrayIndexOf(array, item) {
    	    var nativeIndexOf = Array.prototype.indexOf;
    	    if (array === null) {
    	        return -1;
    	    }
    	    if (nativeIndexOf && array.indexOf === nativeIndexOf) {
    	        return array.indexOf(item);
    	    }
    	    for (var i = 0, l = array.length; i < l; i++) {
    	        if (array[i] === item) {
    	            return i;
    	        }
    	    }
    	    return -1;
    	}
    	exports.arrayIndexOf = arrayIndexOf;
    	function objectApply(object, f) {
    	    for (var key in object) {
    	        if (Object.prototype.hasOwnProperty.call(object, key)) {
    	            f(object[key], key, object);
    	        }
    	    }
    	}
    	exports.objectApply = objectApply;
    	function keys(object) {
    	    var keys = [];
    	    objectApply(object, function (_, key) {
    	        keys.push(key);
    	    });
    	    return keys;
    	}
    	exports.keys = keys;
    	function values(object) {
    	    var values = [];
    	    objectApply(object, function (value) {
    	        values.push(value);
    	    });
    	    return values;
    	}
    	exports.values = values;
    	function apply(array, f, context) {
    	    for (var i = 0; i < array.length; i++) {
    	        f.call(context || (window), array[i], i, array);
    	    }
    	}
    	exports.apply = apply;
    	function map(array, f) {
    	    var result = [];
    	    for (var i = 0; i < array.length; i++) {
    	        result.push(f(array[i], i, array, result));
    	    }
    	    return result;
    	}
    	exports.map = map;
    	function mapObject(object, f) {
    	    var result = {};
    	    objectApply(object, function (value, key) {
    	        result[key] = f(value);
    	    });
    	    return result;
    	}
    	exports.mapObject = mapObject;
    	function filter(array, test) {
    	    test = test || function (value) { return !!value; };
    	    var result = [];
    	    for (var i = 0; i < array.length; i++) {
    	        if (test(array[i], i, array, result)) {
    	            result.push(array[i]);
    	        }
    	    }
    	    return result;
    	}
    	exports.filter = filter;
    	function filterObject(object, test) {
    	    var result = {};
    	    objectApply(object, function (value, key) {
    	        if ((test && test(value, key, object, result)) || Boolean(value)) {
    	            result[key] = value;
    	        }
    	    });
    	    return result;
    	}
    	exports.filterObject = filterObject;
    	function flatten(object) {
    	    var result = [];
    	    objectApply(object, function (value, key) {
    	        result.push([key, value]);
    	    });
    	    return result;
    	}
    	exports.flatten = flatten;
    	function any(array, test) {
    	    for (var i = 0; i < array.length; i++) {
    	        if (test(array[i], i, array)) {
    	            return true;
    	        }
    	    }
    	    return false;
    	}
    	exports.any = any;
    	function all(array, test) {
    	    for (var i = 0; i < array.length; i++) {
    	        if (!test(array[i], i, array)) {
    	            return false;
    	        }
    	    }
    	    return true;
    	}
    	exports.all = all;
    	function encodeParamsObject(data) {
    	    return mapObject(data, function (value) {
    	        if (typeof value === "object") {
    	            value = safeJSONStringify(value);
    	        }
    	        return encodeURIComponent(base64_1["default"](value.toString()));
    	    });
    	}
    	exports.encodeParamsObject = encodeParamsObject;
    	function buildQueryString(data) {
    	    var params = filterObject(data, function (value) {
    	        return value !== undefined;
    	    });
    	    var query = map(flatten(encodeParamsObject(params)), util_1["default"].method("join", "=")).join("&");
    	    return query;
    	}
    	exports.buildQueryString = buildQueryString;
    	function decycleObject(object) {
    	    var objects = [], paths = [];
    	    return (function derez(value, path) {
    	        var i, name, nu;
    	        switch (typeof value) {
    	            case 'object':
    	                if (!value) {
    	                    return null;
    	                }
    	                for (i = 0; i < objects.length; i += 1) {
    	                    if (objects[i] === value) {
    	                        return { $ref: paths[i] };
    	                    }
    	                }
    	                objects.push(value);
    	                paths.push(path);
    	                if (Object.prototype.toString.apply(value) === '[object Array]') {
    	                    nu = [];
    	                    for (i = 0; i < value.length; i += 1) {
    	                        nu[i] = derez(value[i], path + '[' + i + ']');
    	                    }
    	                }
    	                else {
    	                    nu = {};
    	                    for (name in value) {
    	                        if (Object.prototype.hasOwnProperty.call(value, name)) {
    	                            nu[name] = derez(value[name], path + '[' + JSON.stringify(name) + ']');
    	                        }
    	                    }
    	                }
    	                return nu;
    	            case 'number':
    	            case 'string':
    	            case 'boolean':
    	                return value;
    	        }
    	    }(object, '$'));
    	}
    	exports.decycleObject = decycleObject;
    	function safeJSONStringify(source) {
    	    try {
    	        return JSON.stringify(source);
    	    }
    	    catch (e) {
    	        return JSON.stringify(decycleObject(source));
    	    }
    	}
    	exports.safeJSONStringify = safeJSONStringify;


    /***/ }),
    /* 10 */
    /***/ (function(module, exports, __webpack_require__) {
    	function encode(s) {
    	    return btoa(utob(s));
    	}
    	exports.__esModule = true;
    	exports["default"] = encode;
    	var fromCharCode = String.fromCharCode;
    	var b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    	var cb_utob = function (c) {
    	    var cc = c.charCodeAt(0);
    	    return cc < 0x80 ? c
    	        : cc < 0x800 ? fromCharCode(0xc0 | (cc >>> 6)) +
    	            fromCharCode(0x80 | (cc & 0x3f))
    	            : fromCharCode(0xe0 | ((cc >>> 12) & 0x0f)) +
    	                fromCharCode(0x80 | ((cc >>> 6) & 0x3f)) +
    	                fromCharCode(0x80 | (cc & 0x3f));
    	};
    	var utob = function (u) {
    	    return u.replace(/[^\x00-\x7F]/g, cb_utob);
    	};
    	var cb_encode = function (ccc) {
    	    var padlen = [0, 2, 1][ccc.length % 3];
    	    var ord = ccc.charCodeAt(0) << 16
    	        | ((ccc.length > 1 ? ccc.charCodeAt(1) : 0) << 8)
    	        | ((ccc.length > 2 ? ccc.charCodeAt(2) : 0));
    	    var chars = [
    	        b64chars.charAt(ord >>> 18),
    	        b64chars.charAt((ord >>> 12) & 63),
    	        padlen >= 2 ? '=' : b64chars.charAt((ord >>> 6) & 63),
    	        padlen >= 1 ? '=' : b64chars.charAt(ord & 63)
    	    ];
    	    return chars.join('');
    	};
    	var btoa = (window).btoa || function (b) {
    	    return b.replace(/[\s\S]{1,3}/g, cb_encode);
    	};


    /***/ }),
    /* 11 */
    /***/ (function(module, exports, __webpack_require__) {
    	var timers_1 = __webpack_require__(12);
    	var Util = {
    	    now: function () {
    	        if (Date.now) {
    	            return Date.now();
    	        }
    	        else {
    	            return new Date().valueOf();
    	        }
    	    },
    	    defer: function (callback) {
    	        return new timers_1.OneOffTimer(0, callback);
    	    },
    	    method: function (name) {
    	        var args = [];
    	        for (var _i = 1; _i < arguments.length; _i++) {
    	            args[_i - 1] = arguments[_i];
    	        }
    	        var boundArguments = Array.prototype.slice.call(arguments, 1);
    	        return function (object) {
    	            return object[name].apply(object, boundArguments.concat(arguments));
    	        };
    	    }
    	};
    	exports.__esModule = true;
    	exports["default"] = Util;


    /***/ }),
    /* 12 */
    /***/ (function(module, exports, __webpack_require__) {
    	var __extends = (this && this.__extends) || function (d, b) {
    	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    	    function __() { this.constructor = d; }
    	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    	};
    	var abstract_timer_1 = __webpack_require__(13);
    	function clearTimeout(timer) {
    	    (window).clearTimeout(timer);
    	}
    	function clearInterval(timer) {
    	    (window).clearInterval(timer);
    	}
    	var OneOffTimer = (function (_super) {
    	    __extends(OneOffTimer, _super);
    	    function OneOffTimer(delay, callback) {
    	        _super.call(this, setTimeout, clearTimeout, delay, function (timer) {
    	            callback();
    	            return null;
    	        });
    	    }
    	    return OneOffTimer;
    	}(abstract_timer_1["default"]));
    	exports.OneOffTimer = OneOffTimer;
    	var PeriodicTimer = (function (_super) {
    	    __extends(PeriodicTimer, _super);
    	    function PeriodicTimer(delay, callback) {
    	        _super.call(this, setInterval, clearInterval, delay, function (timer) {
    	            callback();
    	            return timer;
    	        });
    	    }
    	    return PeriodicTimer;
    	}(abstract_timer_1["default"]));
    	exports.PeriodicTimer = PeriodicTimer;


    /***/ }),
    /* 13 */
    /***/ (function(module, exports) {
    	var Timer = (function () {
    	    function Timer(set, clear, delay, callback) {
    	        var _this = this;
    	        this.clear = clear;
    	        this.timer = set(function () {
    	            if (_this.timer) {
    	                _this.timer = callback(_this.timer);
    	            }
    	        }, delay);
    	    }
    	    Timer.prototype.isRunning = function () {
    	        return this.timer !== null;
    	    };
    	    Timer.prototype.ensureAborted = function () {
    	        if (this.timer) {
    	            this.clear(this.timer);
    	            this.timer = null;
    	        }
    	    };
    	    return Timer;
    	}());
    	exports.__esModule = true;
    	exports["default"] = Timer;


    /***/ }),
    /* 14 */
    /***/ (function(module, exports) {
    	var urlStore = {
    	    baseUrl: "https://pusher.com",
    	    urls: {
    	        authenticationEndpoint: {
    	            path: "/docs/authenticating_users"
    	        },
    	        javascriptQuickStart: {
    	            path: "/docs/javascript_quick_start"
    	        }
    	    }
    	};
    	var buildLogSuffix = function (key) {
    	    var urlPrefix = "See:";
    	    var urlObj = urlStore.urls[key];
    	    if (!urlObj)
    	        return "";
    	    var url;
    	    if (urlObj.fullUrl) {
    	        url = urlObj.fullUrl;
    	    }
    	    else if (urlObj.path) {
    	        url = urlStore.baseUrl + urlObj.path;
    	    }
    	    if (!url)
    	        return "";
    	    return urlPrefix + " " + url;
    	};
    	exports.__esModule = true;
    	exports["default"] = { buildLogSuffix: buildLogSuffix };


    /***/ }),
    /* 15 */
    /***/ (function(module, exports, __webpack_require__) {
    	var logger_1 = __webpack_require__(8);
    	var jsonp = function (context, socketId, callback) {
    	    if (this.authOptions.headers !== undefined) {
    	        logger_1["default"].warn("Warn", "To send headers with the auth request, you must use AJAX, rather than JSONP.");
    	    }
    	    var callbackName = context.nextAuthCallbackID.toString();
    	    context.nextAuthCallbackID++;
    	    var document = context.getDocument();
    	    var script = document.createElement("script");
    	    context.auth_callbacks[callbackName] = function (data) {
    	        callback(false, data);
    	    };
    	    var callback_name = "Pusher.auth_callbacks['" + callbackName + "']";
    	    script.src = this.options.authEndpoint +
    	        '?callback=' +
    	        encodeURIComponent(callback_name) +
    	        '&' +
    	        this.composeQuery(socketId);
    	    var head = document.getElementsByTagName("head")[0] || document.documentElement;
    	    head.insertBefore(script, head.firstChild);
    	};
    	exports.__esModule = true;
    	exports["default"] = jsonp;


    /***/ }),
    /* 16 */
    /***/ (function(module, exports) {
    	var ScriptRequest = (function () {
    	    function ScriptRequest(src) {
    	        this.src = src;
    	    }
    	    ScriptRequest.prototype.send = function (receiver) {
    	        var self = this;
    	        var errorString = "Error loading " + self.src;
    	        self.script = document.createElement("script");
    	        self.script.id = receiver.id;
    	        self.script.src = self.src;
    	        self.script.type = "text/javascript";
    	        self.script.charset = "UTF-8";
    	        if (self.script.addEventListener) {
    	            self.script.onerror = function () {
    	                receiver.callback(errorString);
    	            };
    	            self.script.onload = function () {
    	                receiver.callback(null);
    	            };
    	        }
    	        else {
    	            self.script.onreadystatechange = function () {
    	                if (self.script.readyState === 'loaded' ||
    	                    self.script.readyState === 'complete') {
    	                    receiver.callback(null);
    	                }
    	            };
    	        }
    	        if (self.script.async === undefined && document.attachEvent &&
    	            /opera/i.test(navigator.userAgent)) {
    	            self.errorScript = document.createElement("script");
    	            self.errorScript.id = receiver.id + "_error";
    	            self.errorScript.text = receiver.name + "('" + errorString + "');";
    	            self.script.async = self.errorScript.async = false;
    	        }
    	        else {
    	            self.script.async = true;
    	        }
    	        var head = document.getElementsByTagName('head')[0];
    	        head.insertBefore(self.script, head.firstChild);
    	        if (self.errorScript) {
    	            head.insertBefore(self.errorScript, self.script.nextSibling);
    	        }
    	    };
    	    ScriptRequest.prototype.cleanup = function () {
    	        if (this.script) {
    	            this.script.onload = this.script.onerror = null;
    	            this.script.onreadystatechange = null;
    	        }
    	        if (this.script && this.script.parentNode) {
    	            this.script.parentNode.removeChild(this.script);
    	        }
    	        if (this.errorScript && this.errorScript.parentNode) {
    	            this.errorScript.parentNode.removeChild(this.errorScript);
    	        }
    	        this.script = null;
    	        this.errorScript = null;
    	    };
    	    return ScriptRequest;
    	}());
    	exports.__esModule = true;
    	exports["default"] = ScriptRequest;


    /***/ }),
    /* 17 */
    /***/ (function(module, exports, __webpack_require__) {
    	var Collections = __webpack_require__(9);
    	var runtime_1 = __webpack_require__(2);
    	var JSONPRequest = (function () {
    	    function JSONPRequest(url, data) {
    	        this.url = url;
    	        this.data = data;
    	    }
    	    JSONPRequest.prototype.send = function (receiver) {
    	        if (this.request) {
    	            return;
    	        }
    	        var query = Collections.buildQueryString(this.data);
    	        var url = this.url + "/" + receiver.number + "?" + query;
    	        this.request = runtime_1["default"].createScriptRequest(url);
    	        this.request.send(receiver);
    	    };
    	    JSONPRequest.prototype.cleanup = function () {
    	        if (this.request) {
    	            this.request.cleanup();
    	        }
    	    };
    	    return JSONPRequest;
    	}());
    	exports.__esModule = true;
    	exports["default"] = JSONPRequest;


    /***/ }),
    /* 18 */
    /***/ (function(module, exports, __webpack_require__) {
    	var runtime_1 = __webpack_require__(2);
    	var script_receiver_factory_1 = __webpack_require__(4);
    	var getAgent = function (sender, useTLS) {
    	    return function (data, callback) {
    	        var scheme = "http" + (useTLS ? "s" : "") + "://";
    	        var url = scheme + (sender.host || sender.options.host) + sender.options.path;
    	        var request = runtime_1["default"].createJSONPRequest(url, data);
    	        var receiver = runtime_1["default"].ScriptReceivers.create(function (error, result) {
    	            script_receiver_factory_1.ScriptReceivers.remove(receiver);
    	            request.cleanup();
    	            if (result && result.host) {
    	                sender.host = result.host;
    	            }
    	            if (callback) {
    	                callback(error, result);
    	            }
    	        });
    	        request.send(receiver);
    	    };
    	};
    	var jsonp = {
    	    name: 'jsonp',
    	    getAgent: getAgent
    	};
    	exports.__esModule = true;
    	exports["default"] = jsonp;


    /***/ }),
    /* 19 */
    /***/ (function(module, exports, __webpack_require__) {
    	var transports_1 = __webpack_require__(20);
    	var transport_1 = __webpack_require__(22);
    	var URLSchemes = __webpack_require__(21);
    	var runtime_1 = __webpack_require__(2);
    	var dependencies_1 = __webpack_require__(3);
    	var Collections = __webpack_require__(9);
    	var SockJSTransport = new transport_1["default"]({
    	    file: "sockjs",
    	    urls: URLSchemes.sockjs,
    	    handlesActivityChecks: true,
    	    supportsPing: false,
    	    isSupported: function () {
    	        return true;
    	    },
    	    isInitialized: function () {
    	        return window.SockJS !== undefined;
    	    },
    	    getSocket: function (url, options) {
    	        return new window.SockJS(url, null, {
    	            js_path: dependencies_1.Dependencies.getPath("sockjs", {
    	                useTLS: options.useTLS
    	            }),
    	            ignore_null_origin: options.ignoreNullOrigin
    	        });
    	    },
    	    beforeOpen: function (socket, path) {
    	        socket.send(JSON.stringify({
    	            path: path
    	        }));
    	    }
    	});
    	var xdrConfiguration = {
    	    isSupported: function (environment) {
    	        var yes = runtime_1["default"].isXDRSupported(environment.useTLS);
    	        return yes;
    	    }
    	};
    	var XDRStreamingTransport = new transport_1["default"](Collections.extend({}, transports_1.streamingConfiguration, xdrConfiguration));
    	var XDRPollingTransport = new transport_1["default"](Collections.extend({}, transports_1.pollingConfiguration, xdrConfiguration));
    	transports_1["default"].xdr_streaming = XDRStreamingTransport;
    	transports_1["default"].xdr_polling = XDRPollingTransport;
    	transports_1["default"].sockjs = SockJSTransport;
    	exports.__esModule = true;
    	exports["default"] = transports_1["default"];


    /***/ }),
    /* 20 */
    /***/ (function(module, exports, __webpack_require__) {
    	var URLSchemes = __webpack_require__(21);
    	var transport_1 = __webpack_require__(22);
    	var Collections = __webpack_require__(9);
    	var runtime_1 = __webpack_require__(2);
    	var WSTransport = new transport_1["default"]({
    	    urls: URLSchemes.ws,
    	    handlesActivityChecks: false,
    	    supportsPing: false,
    	    isInitialized: function () {
    	        return Boolean(runtime_1["default"].getWebSocketAPI());
    	    },
    	    isSupported: function () {
    	        return Boolean(runtime_1["default"].getWebSocketAPI());
    	    },
    	    getSocket: function (url) {
    	        return runtime_1["default"].createWebSocket(url);
    	    }
    	});
    	var httpConfiguration = {
    	    urls: URLSchemes.http,
    	    handlesActivityChecks: false,
    	    supportsPing: true,
    	    isInitialized: function () {
    	        return true;
    	    }
    	};
    	exports.streamingConfiguration = Collections.extend({ getSocket: function (url) {
    	        return runtime_1["default"].HTTPFactory.createStreamingSocket(url);
    	    }
    	}, httpConfiguration);
    	exports.pollingConfiguration = Collections.extend({ getSocket: function (url) {
    	        return runtime_1["default"].HTTPFactory.createPollingSocket(url);
    	    }
    	}, httpConfiguration);
    	var xhrConfiguration = {
    	    isSupported: function () {
    	        return runtime_1["default"].isXHRSupported();
    	    }
    	};
    	var XHRStreamingTransport = new transport_1["default"](Collections.extend({}, exports.streamingConfiguration, xhrConfiguration));
    	var XHRPollingTransport = new transport_1["default"](Collections.extend({}, exports.pollingConfiguration, xhrConfiguration));
    	var Transports = {
    	    ws: WSTransport,
    	    xhr_streaming: XHRStreamingTransport,
    	    xhr_polling: XHRPollingTransport
    	};
    	exports.__esModule = true;
    	exports["default"] = Transports;


    /***/ }),
    /* 21 */
    /***/ (function(module, exports, __webpack_require__) {
    	var defaults_1 = __webpack_require__(5);
    	function getGenericURL(baseScheme, params, path) {
    	    var scheme = baseScheme + (params.useTLS ? "s" : "");
    	    var host = params.useTLS ? params.hostTLS : params.hostNonTLS;
    	    return scheme + "://" + host + path;
    	}
    	function getGenericPath(key, queryString) {
    	    var path = "/app/" + key;
    	    var query = "?protocol=" + defaults_1["default"].PROTOCOL +
    	        "&client=js" +
    	        "&version=" + defaults_1["default"].VERSION +
    	        (queryString ? ("&" + queryString) : "");
    	    return path + query;
    	}
    	exports.ws = {
    	    getInitial: function (key, params) {
    	        var path = (params.httpPath || "") + getGenericPath(key, "flash=false");
    	        return getGenericURL("ws", params, path);
    	    }
    	};
    	exports.http = {
    	    getInitial: function (key, params) {
    	        var path = (params.httpPath || "/pusher") + getGenericPath(key);
    	        return getGenericURL("http", params, path);
    	    }
    	};
    	exports.sockjs = {
    	    getInitial: function (key, params) {
    	        return getGenericURL("http", params, params.httpPath || "/pusher");
    	    },
    	    getPath: function (key, params) {
    	        return getGenericPath(key);
    	    }
    	};


    /***/ }),
    /* 22 */
    /***/ (function(module, exports, __webpack_require__) {
    	var transport_connection_1 = __webpack_require__(23);
    	var Transport = (function () {
    	    function Transport(hooks) {
    	        this.hooks = hooks;
    	    }
    	    Transport.prototype.isSupported = function (environment) {
    	        return this.hooks.isSupported(environment);
    	    };
    	    Transport.prototype.createConnection = function (name, priority, key, options) {
    	        return new transport_connection_1["default"](this.hooks, name, priority, key, options);
    	    };
    	    return Transport;
    	}());
    	exports.__esModule = true;
    	exports["default"] = Transport;


    /***/ }),
    /* 23 */
    /***/ (function(module, exports, __webpack_require__) {
    	var __extends = (this && this.__extends) || function (d, b) {
    	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    	    function __() { this.constructor = d; }
    	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    	};
    	var util_1 = __webpack_require__(11);
    	var Collections = __webpack_require__(9);
    	var dispatcher_1 = __webpack_require__(24);
    	var logger_1 = __webpack_require__(8);
    	var runtime_1 = __webpack_require__(2);
    	var TransportConnection = (function (_super) {
    	    __extends(TransportConnection, _super);
    	    function TransportConnection(hooks, name, priority, key, options) {
    	        _super.call(this);
    	        this.initialize = runtime_1["default"].transportConnectionInitializer;
    	        this.hooks = hooks;
    	        this.name = name;
    	        this.priority = priority;
    	        this.key = key;
    	        this.options = options;
    	        this.state = "new";
    	        this.timeline = options.timeline;
    	        this.activityTimeout = options.activityTimeout;
    	        this.id = this.timeline.generateUniqueID();
    	    }
    	    TransportConnection.prototype.handlesActivityChecks = function () {
    	        return Boolean(this.hooks.handlesActivityChecks);
    	    };
    	    TransportConnection.prototype.supportsPing = function () {
    	        return Boolean(this.hooks.supportsPing);
    	    };
    	    TransportConnection.prototype.connect = function () {
    	        var _this = this;
    	        if (this.socket || this.state !== "initialized") {
    	            return false;
    	        }
    	        var url = this.hooks.urls.getInitial(this.key, this.options);
    	        try {
    	            this.socket = this.hooks.getSocket(url, this.options);
    	        }
    	        catch (e) {
    	            util_1["default"].defer(function () {
    	                _this.onError(e);
    	                _this.changeState("closed");
    	            });
    	            return false;
    	        }
    	        this.bindListeners();
    	        logger_1["default"].debug("Connecting", { transport: this.name, url: url });
    	        this.changeState("connecting");
    	        return true;
    	    };
    	    TransportConnection.prototype.close = function () {
    	        if (this.socket) {
    	            this.socket.close();
    	            return true;
    	        }
    	        else {
    	            return false;
    	        }
    	    };
    	    TransportConnection.prototype.send = function (data) {
    	        var _this = this;
    	        if (this.state === "open") {
    	            util_1["default"].defer(function () {
    	                if (_this.socket) {
    	                    _this.socket.send(data);
    	                }
    	            });
    	            return true;
    	        }
    	        else {
    	            return false;
    	        }
    	    };
    	    TransportConnection.prototype.ping = function () {
    	        if (this.state === "open" && this.supportsPing()) {
    	            this.socket.ping();
    	        }
    	    };
    	    TransportConnection.prototype.onOpen = function () {
    	        if (this.hooks.beforeOpen) {
    	            this.hooks.beforeOpen(this.socket, this.hooks.urls.getPath(this.key, this.options));
    	        }
    	        this.changeState("open");
    	        this.socket.onopen = undefined;
    	    };
    	    TransportConnection.prototype.onError = function (error) {
    	        this.emit("error", { type: 'WebSocketError', error: error });
    	        this.timeline.error(this.buildTimelineMessage({ error: error.toString() }));
    	    };
    	    TransportConnection.prototype.onClose = function (closeEvent) {
    	        if (closeEvent) {
    	            this.changeState("closed", {
    	                code: closeEvent.code,
    	                reason: closeEvent.reason,
    	                wasClean: closeEvent.wasClean
    	            });
    	        }
    	        else {
    	            this.changeState("closed");
    	        }
    	        this.unbindListeners();
    	        this.socket = undefined;
    	    };
    	    TransportConnection.prototype.onMessage = function (message) {
    	        this.emit("message", message);
    	    };
    	    TransportConnection.prototype.onActivity = function () {
    	        this.emit("activity");
    	    };
    	    TransportConnection.prototype.bindListeners = function () {
    	        var _this = this;
    	        this.socket.onopen = function () {
    	            _this.onOpen();
    	        };
    	        this.socket.onerror = function (error) {
    	            _this.onError(error);
    	        };
    	        this.socket.onclose = function (closeEvent) {
    	            _this.onClose(closeEvent);
    	        };
    	        this.socket.onmessage = function (message) {
    	            _this.onMessage(message);
    	        };
    	        if (this.supportsPing()) {
    	            this.socket.onactivity = function () { _this.onActivity(); };
    	        }
    	    };
    	    TransportConnection.prototype.unbindListeners = function () {
    	        if (this.socket) {
    	            this.socket.onopen = undefined;
    	            this.socket.onerror = undefined;
    	            this.socket.onclose = undefined;
    	            this.socket.onmessage = undefined;
    	            if (this.supportsPing()) {
    	                this.socket.onactivity = undefined;
    	            }
    	        }
    	    };
    	    TransportConnection.prototype.changeState = function (state, params) {
    	        this.state = state;
    	        this.timeline.info(this.buildTimelineMessage({
    	            state: state,
    	            params: params
    	        }));
    	        this.emit(state, params);
    	    };
    	    TransportConnection.prototype.buildTimelineMessage = function (message) {
    	        return Collections.extend({ cid: this.id }, message);
    	    };
    	    return TransportConnection;
    	}(dispatcher_1["default"]));
    	exports.__esModule = true;
    	exports["default"] = TransportConnection;


    /***/ }),
    /* 24 */
    /***/ (function(module, exports, __webpack_require__) {
    	var Collections = __webpack_require__(9);
    	var callback_registry_1 = __webpack_require__(25);
    	var Dispatcher = (function () {
    	    function Dispatcher(failThrough) {
    	        this.callbacks = new callback_registry_1["default"]();
    	        this.global_callbacks = [];
    	        this.failThrough = failThrough;
    	    }
    	    Dispatcher.prototype.bind = function (eventName, callback, context) {
    	        this.callbacks.add(eventName, callback, context);
    	        return this;
    	    };
    	    Dispatcher.prototype.bind_global = function (callback) {
    	        this.global_callbacks.push(callback);
    	        return this;
    	    };
    	    Dispatcher.prototype.unbind = function (eventName, callback, context) {
    	        this.callbacks.remove(eventName, callback, context);
    	        return this;
    	    };
    	    Dispatcher.prototype.unbind_global = function (callback) {
    	        if (!callback) {
    	            this.global_callbacks = [];
    	            return this;
    	        }
    	        this.global_callbacks = Collections.filter(this.global_callbacks || [], function (c) { return c !== callback; });
    	        return this;
    	    };
    	    Dispatcher.prototype.unbind_all = function () {
    	        this.unbind();
    	        this.unbind_global();
    	        return this;
    	    };
    	    Dispatcher.prototype.emit = function (eventName, data) {
    	        var i;
    	        for (i = 0; i < this.global_callbacks.length; i++) {
    	            this.global_callbacks[i](eventName, data);
    	        }
    	        var callbacks = this.callbacks.get(eventName);
    	        if (callbacks && callbacks.length > 0) {
    	            for (i = 0; i < callbacks.length; i++) {
    	                callbacks[i].fn.call(callbacks[i].context || (window), data);
    	            }
    	        }
    	        else if (this.failThrough) {
    	            this.failThrough(eventName, data);
    	        }
    	        return this;
    	    };
    	    return Dispatcher;
    	}());
    	exports.__esModule = true;
    	exports["default"] = Dispatcher;


    /***/ }),
    /* 25 */
    /***/ (function(module, exports, __webpack_require__) {
    	var Collections = __webpack_require__(9);
    	var CallbackRegistry = (function () {
    	    function CallbackRegistry() {
    	        this._callbacks = {};
    	    }
    	    CallbackRegistry.prototype.get = function (name) {
    	        return this._callbacks[prefix(name)];
    	    };
    	    CallbackRegistry.prototype.add = function (name, callback, context) {
    	        var prefixedEventName = prefix(name);
    	        this._callbacks[prefixedEventName] = this._callbacks[prefixedEventName] || [];
    	        this._callbacks[prefixedEventName].push({
    	            fn: callback,
    	            context: context
    	        });
    	    };
    	    CallbackRegistry.prototype.remove = function (name, callback, context) {
    	        if (!name && !callback && !context) {
    	            this._callbacks = {};
    	            return;
    	        }
    	        var names = name ? [prefix(name)] : Collections.keys(this._callbacks);
    	        if (callback || context) {
    	            this.removeCallback(names, callback, context);
    	        }
    	        else {
    	            this.removeAllCallbacks(names);
    	        }
    	    };
    	    CallbackRegistry.prototype.removeCallback = function (names, callback, context) {
    	        Collections.apply(names, function (name) {
    	            this._callbacks[name] = Collections.filter(this._callbacks[name] || [], function (binding) {
    	                return (callback && callback !== binding.fn) ||
    	                    (context && context !== binding.context);
    	            });
    	            if (this._callbacks[name].length === 0) {
    	                delete this._callbacks[name];
    	            }
    	        }, this);
    	    };
    	    CallbackRegistry.prototype.removeAllCallbacks = function (names) {
    	        Collections.apply(names, function (name) {
    	            delete this._callbacks[name];
    	        }, this);
    	    };
    	    return CallbackRegistry;
    	}());
    	exports.__esModule = true;
    	exports["default"] = CallbackRegistry;
    	function prefix(name) {
    	    return "_" + name;
    	}


    /***/ }),
    /* 26 */
    /***/ (function(module, exports, __webpack_require__) {
    	var __extends = (this && this.__extends) || function (d, b) {
    	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    	    function __() { this.constructor = d; }
    	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    	};
    	var dispatcher_1 = __webpack_require__(24);
    	var NetInfo = (function (_super) {
    	    __extends(NetInfo, _super);
    	    function NetInfo() {
    	        _super.call(this);
    	        var self = this;
    	        if (window.addEventListener !== undefined) {
    	            window.addEventListener("online", function () {
    	                self.emit('online');
    	            }, false);
    	            window.addEventListener("offline", function () {
    	                self.emit('offline');
    	            }, false);
    	        }
    	    }
    	    NetInfo.prototype.isOnline = function () {
    	        if (window.navigator.onLine === undefined) {
    	            return true;
    	        }
    	        else {
    	            return window.navigator.onLine;
    	        }
    	    };
    	    return NetInfo;
    	}(dispatcher_1["default"]));
    	exports.NetInfo = NetInfo;
    	exports.Network = new NetInfo();


    /***/ }),
    /* 27 */
    /***/ (function(module, exports) {
    	var getDefaultStrategy = function (config) {
    	    var wsStrategy;
    	    if (config.useTLS) {
    	        wsStrategy = [
    	            ":best_connected_ever",
    	            ":ws_loop",
    	            [":delayed", 2000, [":http_fallback_loop"]]
    	        ];
    	    }
    	    else {
    	        wsStrategy = [
    	            ":best_connected_ever",
    	            ":ws_loop",
    	            [":delayed", 2000, [":wss_loop"]],
    	            [":delayed", 5000, [":http_fallback_loop"]]
    	        ];
    	    }
    	    return [
    	        [":def", "ws_options", {
    	                hostNonTLS: config.wsHost + ":" + config.wsPort,
    	                hostTLS: config.wsHost + ":" + config.wssPort,
    	                httpPath: config.wsPath
    	            }],
    	        [":def", "wss_options", [":extend", ":ws_options", {
    	                    useTLS: true
    	                }]],
    	        [":def", "sockjs_options", {
    	                hostNonTLS: config.httpHost + ":" + config.httpPort,
    	                hostTLS: config.httpHost + ":" + config.httpsPort,
    	                httpPath: config.httpPath
    	            }],
    	        [":def", "timeouts", {
    	                loop: true,
    	                timeout: 15000,
    	                timeoutLimit: 60000
    	            }],
    	        [":def", "ws_manager", [":transport_manager", {
    	                    lives: 2,
    	                    minPingDelay: 10000,
    	                    maxPingDelay: config.activity_timeout
    	                }]],
    	        [":def", "streaming_manager", [":transport_manager", {
    	                    lives: 2,
    	                    minPingDelay: 10000,
    	                    maxPingDelay: config.activity_timeout
    	                }]],
    	        [":def_transport", "ws", "ws", 3, ":ws_options", ":ws_manager"],
    	        [":def_transport", "wss", "ws", 3, ":wss_options", ":ws_manager"],
    	        [":def_transport", "sockjs", "sockjs", 1, ":sockjs_options"],
    	        [":def_transport", "xhr_streaming", "xhr_streaming", 1, ":sockjs_options", ":streaming_manager"],
    	        [":def_transport", "xdr_streaming", "xdr_streaming", 1, ":sockjs_options", ":streaming_manager"],
    	        [":def_transport", "xhr_polling", "xhr_polling", 1, ":sockjs_options"],
    	        [":def_transport", "xdr_polling", "xdr_polling", 1, ":sockjs_options"],
    	        [":def", "ws_loop", [":sequential", ":timeouts", ":ws"]],
    	        [":def", "wss_loop", [":sequential", ":timeouts", ":wss"]],
    	        [":def", "sockjs_loop", [":sequential", ":timeouts", ":sockjs"]],
    	        [":def", "streaming_loop", [":sequential", ":timeouts",
    	                [":if", [":is_supported", ":xhr_streaming"],
    	                    ":xhr_streaming",
    	                    ":xdr_streaming"
    	                ]
    	            ]],
    	        [":def", "polling_loop", [":sequential", ":timeouts",
    	                [":if", [":is_supported", ":xhr_polling"],
    	                    ":xhr_polling",
    	                    ":xdr_polling"
    	                ]
    	            ]],
    	        [":def", "http_loop", [":if", [":is_supported", ":streaming_loop"], [
    	                    ":best_connected_ever",
    	                    ":streaming_loop",
    	                    [":delayed", 4000, [":polling_loop"]]
    	                ], [
    	                    ":polling_loop"
    	                ]]],
    	        [":def", "http_fallback_loop",
    	            [":if", [":is_supported", ":http_loop"], [
    	                    ":http_loop"
    	                ], [
    	                    ":sockjs_loop"
    	                ]]
    	        ],
    	        [":def", "strategy",
    	            [":cached", 1800000,
    	                [":first_connected",
    	                    [":if", [":is_supported", ":ws"],
    	                        wsStrategy,
    	                        ":http_fallback_loop"
    	                    ]
    	                ]
    	            ]
    	        ]
    	    ];
    	};
    	exports.__esModule = true;
    	exports["default"] = getDefaultStrategy;


    /***/ }),
    /* 28 */
    /***/ (function(module, exports, __webpack_require__) {
    	var dependencies_1 = __webpack_require__(3);
    	function default_1() {
    	    var self = this;
    	    self.timeline.info(self.buildTimelineMessage({
    	        transport: self.name + (self.options.useTLS ? "s" : "")
    	    }));
    	    if (self.hooks.isInitialized()) {
    	        self.changeState("initialized");
    	    }
    	    else if (self.hooks.file) {
    	        self.changeState("initializing");
    	        dependencies_1.Dependencies.load(self.hooks.file, { useTLS: self.options.useTLS }, function (error, callback) {
    	            if (self.hooks.isInitialized()) {
    	                self.changeState("initialized");
    	                callback(true);
    	            }
    	            else {
    	                if (error) {
    	                    self.onError(error);
    	                }
    	                self.onClose();
    	                callback(false);
    	            }
    	        });
    	    }
    	    else {
    	        self.onClose();
    	    }
    	}
    	exports.__esModule = true;
    	exports["default"] = default_1;


    /***/ }),
    /* 29 */
    /***/ (function(module, exports, __webpack_require__) {
    	var http_xdomain_request_1 = __webpack_require__(30);
    	var http_1 = __webpack_require__(32);
    	http_1["default"].createXDR = function (method, url) {
    	    return this.createRequest(http_xdomain_request_1["default"], method, url);
    	};
    	exports.__esModule = true;
    	exports["default"] = http_1["default"];


    /***/ }),
    /* 30 */
    /***/ (function(module, exports, __webpack_require__) {
    	var Errors = __webpack_require__(31);
    	var hooks = {
    	    getRequest: function (socket) {
    	        var xdr = new window.XDomainRequest();
    	        xdr.ontimeout = function () {
    	            socket.emit("error", new Errors.RequestTimedOut());
    	            socket.close();
    	        };
    	        xdr.onerror = function (e) {
    	            socket.emit("error", e);
    	            socket.close();
    	        };
    	        xdr.onprogress = function () {
    	            if (xdr.responseText && xdr.responseText.length > 0) {
    	                socket.onChunk(200, xdr.responseText);
    	            }
    	        };
    	        xdr.onload = function () {
    	            if (xdr.responseText && xdr.responseText.length > 0) {
    	                socket.onChunk(200, xdr.responseText);
    	            }
    	            socket.emit("finished", 200);
    	            socket.close();
    	        };
    	        return xdr;
    	    },
    	    abortRequest: function (xdr) {
    	        xdr.ontimeout = xdr.onerror = xdr.onprogress = xdr.onload = null;
    	        xdr.abort();
    	    }
    	};
    	exports.__esModule = true;
    	exports["default"] = hooks;


    /***/ }),
    /* 31 */
    /***/ (function(module, exports) {
    	var __extends = (this && this.__extends) || function (d, b) {
    	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    	    function __() { this.constructor = d; }
    	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    	};
    	var BadEventName = (function (_super) {
    	    __extends(BadEventName, _super);
    	    function BadEventName() {
    	        _super.apply(this, arguments);
    	    }
    	    return BadEventName;
    	}(Error));
    	exports.BadEventName = BadEventName;
    	var RequestTimedOut = (function (_super) {
    	    __extends(RequestTimedOut, _super);
    	    function RequestTimedOut() {
    	        _super.apply(this, arguments);
    	    }
    	    return RequestTimedOut;
    	}(Error));
    	exports.RequestTimedOut = RequestTimedOut;
    	var TransportPriorityTooLow = (function (_super) {
    	    __extends(TransportPriorityTooLow, _super);
    	    function TransportPriorityTooLow() {
    	        _super.apply(this, arguments);
    	    }
    	    return TransportPriorityTooLow;
    	}(Error));
    	exports.TransportPriorityTooLow = TransportPriorityTooLow;
    	var TransportClosed = (function (_super) {
    	    __extends(TransportClosed, _super);
    	    function TransportClosed() {
    	        _super.apply(this, arguments);
    	    }
    	    return TransportClosed;
    	}(Error));
    	exports.TransportClosed = TransportClosed;
    	var UnsupportedFeature = (function (_super) {
    	    __extends(UnsupportedFeature, _super);
    	    function UnsupportedFeature() {
    	        _super.apply(this, arguments);
    	    }
    	    return UnsupportedFeature;
    	}(Error));
    	exports.UnsupportedFeature = UnsupportedFeature;
    	var UnsupportedTransport = (function (_super) {
    	    __extends(UnsupportedTransport, _super);
    	    function UnsupportedTransport() {
    	        _super.apply(this, arguments);
    	    }
    	    return UnsupportedTransport;
    	}(Error));
    	exports.UnsupportedTransport = UnsupportedTransport;
    	var UnsupportedStrategy = (function (_super) {
    	    __extends(UnsupportedStrategy, _super);
    	    function UnsupportedStrategy() {
    	        _super.apply(this, arguments);
    	    }
    	    return UnsupportedStrategy;
    	}(Error));
    	exports.UnsupportedStrategy = UnsupportedStrategy;


    /***/ }),
    /* 32 */
    /***/ (function(module, exports, __webpack_require__) {
    	var http_request_1 = __webpack_require__(33);
    	var http_socket_1 = __webpack_require__(34);
    	var http_streaming_socket_1 = __webpack_require__(36);
    	var http_polling_socket_1 = __webpack_require__(37);
    	var http_xhr_request_1 = __webpack_require__(38);
    	var HTTP = {
    	    createStreamingSocket: function (url) {
    	        return this.createSocket(http_streaming_socket_1["default"], url);
    	    },
    	    createPollingSocket: function (url) {
    	        return this.createSocket(http_polling_socket_1["default"], url);
    	    },
    	    createSocket: function (hooks, url) {
    	        return new http_socket_1["default"](hooks, url);
    	    },
    	    createXHR: function (method, url) {
    	        return this.createRequest(http_xhr_request_1["default"], method, url);
    	    },
    	    createRequest: function (hooks, method, url) {
    	        return new http_request_1["default"](hooks, method, url);
    	    }
    	};
    	exports.__esModule = true;
    	exports["default"] = HTTP;


    /***/ }),
    /* 33 */
    /***/ (function(module, exports, __webpack_require__) {
    	var __extends = (this && this.__extends) || function (d, b) {
    	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    	    function __() { this.constructor = d; }
    	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    	};
    	var runtime_1 = __webpack_require__(2);
    	var dispatcher_1 = __webpack_require__(24);
    	var MAX_BUFFER_LENGTH = 256 * 1024;
    	var HTTPRequest = (function (_super) {
    	    __extends(HTTPRequest, _super);
    	    function HTTPRequest(hooks, method, url) {
    	        _super.call(this);
    	        this.hooks = hooks;
    	        this.method = method;
    	        this.url = url;
    	    }
    	    HTTPRequest.prototype.start = function (payload) {
    	        var _this = this;
    	        this.position = 0;
    	        this.xhr = this.hooks.getRequest(this);
    	        this.unloader = function () {
    	            _this.close();
    	        };
    	        runtime_1["default"].addUnloadListener(this.unloader);
    	        this.xhr.open(this.method, this.url, true);
    	        if (this.xhr.setRequestHeader) {
    	            this.xhr.setRequestHeader("Content-Type", "application/json");
    	        }
    	        this.xhr.send(payload);
    	    };
    	    HTTPRequest.prototype.close = function () {
    	        if (this.unloader) {
    	            runtime_1["default"].removeUnloadListener(this.unloader);
    	            this.unloader = null;
    	        }
    	        if (this.xhr) {
    	            this.hooks.abortRequest(this.xhr);
    	            this.xhr = null;
    	        }
    	    };
    	    HTTPRequest.prototype.onChunk = function (status, data) {
    	        while (true) {
    	            var chunk = this.advanceBuffer(data);
    	            if (chunk) {
    	                this.emit("chunk", { status: status, data: chunk });
    	            }
    	            else {
    	                break;
    	            }
    	        }
    	        if (this.isBufferTooLong(data)) {
    	            this.emit("buffer_too_long");
    	        }
    	    };
    	    HTTPRequest.prototype.advanceBuffer = function (buffer) {
    	        var unreadData = buffer.slice(this.position);
    	        var endOfLinePosition = unreadData.indexOf("\n");
    	        if (endOfLinePosition !== -1) {
    	            this.position += endOfLinePosition + 1;
    	            return unreadData.slice(0, endOfLinePosition);
    	        }
    	        else {
    	            return null;
    	        }
    	    };
    	    HTTPRequest.prototype.isBufferTooLong = function (buffer) {
    	        return this.position === buffer.length && buffer.length > MAX_BUFFER_LENGTH;
    	    };
    	    return HTTPRequest;
    	}(dispatcher_1["default"]));
    	exports.__esModule = true;
    	exports["default"] = HTTPRequest;


    /***/ }),
    /* 34 */
    /***/ (function(module, exports, __webpack_require__) {
    	var state_1 = __webpack_require__(35);
    	var util_1 = __webpack_require__(11);
    	var runtime_1 = __webpack_require__(2);
    	var autoIncrement = 1;
    	var HTTPSocket = (function () {
    	    function HTTPSocket(hooks, url) {
    	        this.hooks = hooks;
    	        this.session = randomNumber(1000) + "/" + randomString(8);
    	        this.location = getLocation(url);
    	        this.readyState = state_1["default"].CONNECTING;
    	        this.openStream();
    	    }
    	    HTTPSocket.prototype.send = function (payload) {
    	        return this.sendRaw(JSON.stringify([payload]));
    	    };
    	    HTTPSocket.prototype.ping = function () {
    	        this.hooks.sendHeartbeat(this);
    	    };
    	    HTTPSocket.prototype.close = function (code, reason) {
    	        this.onClose(code, reason, true);
    	    };
    	    HTTPSocket.prototype.sendRaw = function (payload) {
    	        if (this.readyState === state_1["default"].OPEN) {
    	            try {
    	                runtime_1["default"].createSocketRequest("POST", getUniqueURL(getSendURL(this.location, this.session))).start(payload);
    	                return true;
    	            }
    	            catch (e) {
    	                return false;
    	            }
    	        }
    	        else {
    	            return false;
    	        }
    	    };
    	    HTTPSocket.prototype.reconnect = function () {
    	        this.closeStream();
    	        this.openStream();
    	    };
    	    HTTPSocket.prototype.onClose = function (code, reason, wasClean) {
    	        this.closeStream();
    	        this.readyState = state_1["default"].CLOSED;
    	        if (this.onclose) {
    	            this.onclose({
    	                code: code,
    	                reason: reason,
    	                wasClean: wasClean
    	            });
    	        }
    	    };
    	    HTTPSocket.prototype.onChunk = function (chunk) {
    	        if (chunk.status !== 200) {
    	            return;
    	        }
    	        if (this.readyState === state_1["default"].OPEN) {
    	            this.onActivity();
    	        }
    	        var payload;
    	        var type = chunk.data.slice(0, 1);
    	        switch (type) {
    	            case 'o':
    	                payload = JSON.parse(chunk.data.slice(1) || '{}');
    	                this.onOpen(payload);
    	                break;
    	            case 'a':
    	                payload = JSON.parse(chunk.data.slice(1) || '[]');
    	                for (var i = 0; i < payload.length; i++) {
    	                    this.onEvent(payload[i]);
    	                }
    	                break;
    	            case 'm':
    	                payload = JSON.parse(chunk.data.slice(1) || 'null');
    	                this.onEvent(payload);
    	                break;
    	            case 'h':
    	                this.hooks.onHeartbeat(this);
    	                break;
    	            case 'c':
    	                payload = JSON.parse(chunk.data.slice(1) || '[]');
    	                this.onClose(payload[0], payload[1], true);
    	                break;
    	        }
    	    };
    	    HTTPSocket.prototype.onOpen = function (options) {
    	        if (this.readyState === state_1["default"].CONNECTING) {
    	            if (options && options.hostname) {
    	                this.location.base = replaceHost(this.location.base, options.hostname);
    	            }
    	            this.readyState = state_1["default"].OPEN;
    	            if (this.onopen) {
    	                this.onopen();
    	            }
    	        }
    	        else {
    	            this.onClose(1006, "Server lost session", true);
    	        }
    	    };
    	    HTTPSocket.prototype.onEvent = function (event) {
    	        if (this.readyState === state_1["default"].OPEN && this.onmessage) {
    	            this.onmessage({ data: event });
    	        }
    	    };
    	    HTTPSocket.prototype.onActivity = function () {
    	        if (this.onactivity) {
    	            this.onactivity();
    	        }
    	    };
    	    HTTPSocket.prototype.onError = function (error) {
    	        if (this.onerror) {
    	            this.onerror(error);
    	        }
    	    };
    	    HTTPSocket.prototype.openStream = function () {
    	        var _this = this;
    	        this.stream = runtime_1["default"].createSocketRequest("POST", getUniqueURL(this.hooks.getReceiveURL(this.location, this.session)));
    	        this.stream.bind("chunk", function (chunk) {
    	            _this.onChunk(chunk);
    	        });
    	        this.stream.bind("finished", function (status) {
    	            _this.hooks.onFinished(_this, status);
    	        });
    	        this.stream.bind("buffer_too_long", function () {
    	            _this.reconnect();
    	        });
    	        try {
    	            this.stream.start();
    	        }
    	        catch (error) {
    	            util_1["default"].defer(function () {
    	                _this.onError(error);
    	                _this.onClose(1006, "Could not start streaming", false);
    	            });
    	        }
    	    };
    	    HTTPSocket.prototype.closeStream = function () {
    	        if (this.stream) {
    	            this.stream.unbind_all();
    	            this.stream.close();
    	            this.stream = null;
    	        }
    	    };
    	    return HTTPSocket;
    	}());
    	function getLocation(url) {
    	    var parts = /([^\?]*)\/*(\??.*)/.exec(url);
    	    return {
    	        base: parts[1],
    	        queryString: parts[2]
    	    };
    	}
    	function getSendURL(url, session) {
    	    return url.base + "/" + session + "/xhr_send";
    	}
    	function getUniqueURL(url) {
    	    var separator = (url.indexOf('?') === -1) ? "?" : "&";
    	    return url + separator + "t=" + (+new Date()) + "&n=" + autoIncrement++;
    	}
    	function replaceHost(url, hostname) {
    	    var urlParts = /(https?:\/\/)([^\/:]+)((\/|:)?.*)/.exec(url);
    	    return urlParts[1] + hostname + urlParts[3];
    	}
    	function randomNumber(max) {
    	    return Math.floor(Math.random() * max);
    	}
    	function randomString(length) {
    	    var result = [];
    	    for (var i = 0; i < length; i++) {
    	        result.push(randomNumber(32).toString(32));
    	    }
    	    return result.join('');
    	}
    	exports.__esModule = true;
    	exports["default"] = HTTPSocket;


    /***/ }),
    /* 35 */
    /***/ (function(module, exports) {
    	var State;
    	(function (State) {
    	    State[State["CONNECTING"] = 0] = "CONNECTING";
    	    State[State["OPEN"] = 1] = "OPEN";
    	    State[State["CLOSED"] = 3] = "CLOSED";
    	})(State || (State = {}));
    	exports.__esModule = true;
    	exports["default"] = State;


    /***/ }),
    /* 36 */
    /***/ (function(module, exports) {
    	var hooks = {
    	    getReceiveURL: function (url, session) {
    	        return url.base + "/" + session + "/xhr_streaming" + url.queryString;
    	    },
    	    onHeartbeat: function (socket) {
    	        socket.sendRaw("[]");
    	    },
    	    sendHeartbeat: function (socket) {
    	        socket.sendRaw("[]");
    	    },
    	    onFinished: function (socket, status) {
    	        socket.onClose(1006, "Connection interrupted (" + status + ")", false);
    	    }
    	};
    	exports.__esModule = true;
    	exports["default"] = hooks;


    /***/ }),
    /* 37 */
    /***/ (function(module, exports) {
    	var hooks = {
    	    getReceiveURL: function (url, session) {
    	        return url.base + "/" + session + "/xhr" + url.queryString;
    	    },
    	    onHeartbeat: function () {
    	    },
    	    sendHeartbeat: function (socket) {
    	        socket.sendRaw("[]");
    	    },
    	    onFinished: function (socket, status) {
    	        if (status === 200) {
    	            socket.reconnect();
    	        }
    	        else {
    	            socket.onClose(1006, "Connection interrupted (" + status + ")", false);
    	        }
    	    }
    	};
    	exports.__esModule = true;
    	exports["default"] = hooks;


    /***/ }),
    /* 38 */
    /***/ (function(module, exports, __webpack_require__) {
    	var runtime_1 = __webpack_require__(2);
    	var hooks = {
    	    getRequest: function (socket) {
    	        var Constructor = runtime_1["default"].getXHRAPI();
    	        var xhr = new Constructor();
    	        xhr.onreadystatechange = xhr.onprogress = function () {
    	            switch (xhr.readyState) {
    	                case 3:
    	                    if (xhr.responseText && xhr.responseText.length > 0) {
    	                        socket.onChunk(xhr.status, xhr.responseText);
    	                    }
    	                    break;
    	                case 4:
    	                    if (xhr.responseText && xhr.responseText.length > 0) {
    	                        socket.onChunk(xhr.status, xhr.responseText);
    	                    }
    	                    socket.emit("finished", xhr.status);
    	                    socket.close();
    	                    break;
    	            }
    	        };
    	        return xhr;
    	    },
    	    abortRequest: function (xhr) {
    	        xhr.onreadystatechange = null;
    	        xhr.abort();
    	    }
    	};
    	exports.__esModule = true;
    	exports["default"] = hooks;


    /***/ }),
    /* 39 */
    /***/ (function(module, exports, __webpack_require__) {
    	var Collections = __webpack_require__(9);
    	var util_1 = __webpack_require__(11);
    	var level_1 = __webpack_require__(40);
    	var Timeline = (function () {
    	    function Timeline(key, session, options) {
    	        this.key = key;
    	        this.session = session;
    	        this.events = [];
    	        this.options = options || {};
    	        this.sent = 0;
    	        this.uniqueID = 0;
    	    }
    	    Timeline.prototype.log = function (level, event) {
    	        if (level <= this.options.level) {
    	            this.events.push(Collections.extend({}, event, { timestamp: util_1["default"].now() }));
    	            if (this.options.limit && this.events.length > this.options.limit) {
    	                this.events.shift();
    	            }
    	        }
    	    };
    	    Timeline.prototype.error = function (event) {
    	        this.log(level_1["default"].ERROR, event);
    	    };
    	    Timeline.prototype.info = function (event) {
    	        this.log(level_1["default"].INFO, event);
    	    };
    	    Timeline.prototype.debug = function (event) {
    	        this.log(level_1["default"].DEBUG, event);
    	    };
    	    Timeline.prototype.isEmpty = function () {
    	        return this.events.length === 0;
    	    };
    	    Timeline.prototype.send = function (sendfn, callback) {
    	        var _this = this;
    	        var data = Collections.extend({
    	            session: this.session,
    	            bundle: this.sent + 1,
    	            key: this.key,
    	            lib: "js",
    	            version: this.options.version,
    	            cluster: this.options.cluster,
    	            features: this.options.features,
    	            timeline: this.events
    	        }, this.options.params);
    	        this.events = [];
    	        sendfn(data, function (error, result) {
    	            if (!error) {
    	                _this.sent++;
    	            }
    	            if (callback) {
    	                callback(error, result);
    	            }
    	        });
    	        return true;
    	    };
    	    Timeline.prototype.generateUniqueID = function () {
    	        this.uniqueID++;
    	        return this.uniqueID;
    	    };
    	    return Timeline;
    	}());
    	exports.__esModule = true;
    	exports["default"] = Timeline;


    /***/ }),
    /* 40 */
    /***/ (function(module, exports) {
    	var TimelineLevel;
    	(function (TimelineLevel) {
    	    TimelineLevel[TimelineLevel["ERROR"] = 3] = "ERROR";
    	    TimelineLevel[TimelineLevel["INFO"] = 6] = "INFO";
    	    TimelineLevel[TimelineLevel["DEBUG"] = 7] = "DEBUG";
    	})(TimelineLevel || (TimelineLevel = {}));
    	exports.__esModule = true;
    	exports["default"] = TimelineLevel;


    /***/ }),
    /* 41 */
    /***/ (function(module, exports, __webpack_require__) {
    	var Collections = __webpack_require__(9);
    	var util_1 = __webpack_require__(11);
    	var transport_manager_1 = __webpack_require__(42);
    	var Errors = __webpack_require__(31);
    	var transport_strategy_1 = __webpack_require__(64);
    	var sequential_strategy_1 = __webpack_require__(65);
    	var best_connected_ever_strategy_1 = __webpack_require__(66);
    	var cached_strategy_1 = __webpack_require__(67);
    	var delayed_strategy_1 = __webpack_require__(68);
    	var if_strategy_1 = __webpack_require__(69);
    	var first_connected_strategy_1 = __webpack_require__(70);
    	var runtime_1 = __webpack_require__(2);
    	var Transports = runtime_1["default"].Transports;
    	exports.build = function (scheme, options) {
    	    var context = Collections.extend({}, globalContext, options);
    	    return evaluate(scheme, context)[1].strategy;
    	};
    	var UnsupportedStrategy = {
    	    isSupported: function () {
    	        return false;
    	    },
    	    connect: function (_, callback) {
    	        var deferred = util_1["default"].defer(function () {
    	            callback(new Errors.UnsupportedStrategy());
    	        });
    	        return {
    	            abort: function () {
    	                deferred.ensureAborted();
    	            },
    	            forceMinPriority: function () { }
    	        };
    	    }
    	};
    	function returnWithOriginalContext(f) {
    	    return function (context) {
    	        return [f.apply(this, arguments), context];
    	    };
    	}
    	var globalContext = {
    	    extend: function (context, first, second) {
    	        return [Collections.extend({}, first, second), context];
    	    },
    	    def: function (context, name, value) {
    	        if (context[name] !== undefined) {
    	            throw "Redefining symbol " + name;
    	        }
    	        context[name] = value;
    	        return [undefined, context];
    	    },
    	    def_transport: function (context, name, type, priority, options, manager) {
    	        var transportClass = Transports[type];
    	        if (!transportClass) {
    	            throw new Errors.UnsupportedTransport(type);
    	        }
    	        var enabled = (!context.enabledTransports ||
    	            Collections.arrayIndexOf(context.enabledTransports, name) !== -1) &&
    	            (!context.disabledTransports ||
    	                Collections.arrayIndexOf(context.disabledTransports, name) === -1);
    	        var transport;
    	        if (enabled) {
    	            transport = new transport_strategy_1["default"](name, priority, manager ? manager.getAssistant(transportClass) : transportClass, Collections.extend({
    	                key: context.key,
    	                useTLS: context.useTLS,
    	                timeline: context.timeline,
    	                ignoreNullOrigin: context.ignoreNullOrigin
    	            }, options));
    	        }
    	        else {
    	            transport = UnsupportedStrategy;
    	        }
    	        var newContext = context.def(context, name, transport)[1];
    	        newContext.Transports = context.Transports || {};
    	        newContext.Transports[name] = transport;
    	        return [undefined, newContext];
    	    },
    	    transport_manager: returnWithOriginalContext(function (_, options) {
    	        return new transport_manager_1["default"](options);
    	    }),
    	    sequential: returnWithOriginalContext(function (_, options) {
    	        var strategies = Array.prototype.slice.call(arguments, 2);
    	        return new sequential_strategy_1["default"](strategies, options);
    	    }),
    	    cached: returnWithOriginalContext(function (context, ttl, strategy) {
    	        return new cached_strategy_1["default"](strategy, context.Transports, {
    	            ttl: ttl,
    	            timeline: context.timeline,
    	            useTLS: context.useTLS
    	        });
    	    }),
    	    first_connected: returnWithOriginalContext(function (_, strategy) {
    	        return new first_connected_strategy_1["default"](strategy);
    	    }),
    	    best_connected_ever: returnWithOriginalContext(function () {
    	        var strategies = Array.prototype.slice.call(arguments, 1);
    	        return new best_connected_ever_strategy_1["default"](strategies);
    	    }),
    	    delayed: returnWithOriginalContext(function (_, delay, strategy) {
    	        return new delayed_strategy_1["default"](strategy, { delay: delay });
    	    }),
    	    "if": returnWithOriginalContext(function (_, test, trueBranch, falseBranch) {
    	        return new if_strategy_1["default"](test, trueBranch, falseBranch);
    	    }),
    	    is_supported: returnWithOriginalContext(function (_, strategy) {
    	        return function () {
    	            return strategy.isSupported();
    	        };
    	    })
    	};
    	function isSymbol(expression) {
    	    return (typeof expression === "string") && expression.charAt(0) === ":";
    	}
    	function getSymbolValue(expression, context) {
    	    return context[expression.slice(1)];
    	}
    	function evaluateListOfExpressions(expressions, context) {
    	    if (expressions.length === 0) {
    	        return [[], context];
    	    }
    	    var head = evaluate(expressions[0], context);
    	    var tail = evaluateListOfExpressions(expressions.slice(1), head[1]);
    	    return [[head[0]].concat(tail[0]), tail[1]];
    	}
    	function evaluateString(expression, context) {
    	    if (!isSymbol(expression)) {
    	        return [expression, context];
    	    }
    	    var value = getSymbolValue(expression, context);
    	    if (value === undefined) {
    	        throw "Undefined symbol " + expression;
    	    }
    	    return [value, context];
    	}
    	function evaluateArray(expression, context) {
    	    if (isSymbol(expression[0])) {
    	        var f = getSymbolValue(expression[0], context);
    	        if (expression.length > 1) {
    	            if (typeof f !== "function") {
    	                throw "Calling non-function " + expression[0];
    	            }
    	            var args = [Collections.extend({}, context)].concat(Collections.map(expression.slice(1), function (arg) {
    	                return evaluate(arg, Collections.extend({}, context))[0];
    	            }));
    	            return f.apply(this, args);
    	        }
    	        else {
    	            return [f, context];
    	        }
    	    }
    	    else {
    	        return evaluateListOfExpressions(expression, context);
    	    }
    	}
    	function evaluate(expression, context) {
    	    if (typeof expression === "string") {
    	        return evaluateString(expression, context);
    	    }
    	    else if (typeof expression === "object") {
    	        if (expression instanceof Array && expression.length > 0) {
    	            return evaluateArray(expression, context);
    	        }
    	    }
    	    return [expression, context];
    	}


    /***/ }),
    /* 42 */
    /***/ (function(module, exports, __webpack_require__) {
    	var factory_1 = __webpack_require__(43);
    	var TransportManager = (function () {
    	    function TransportManager(options) {
    	        this.options = options || {};
    	        this.livesLeft = this.options.lives || Infinity;
    	    }
    	    TransportManager.prototype.getAssistant = function (transport) {
    	        return factory_1["default"].createAssistantToTheTransportManager(this, transport, {
    	            minPingDelay: this.options.minPingDelay,
    	            maxPingDelay: this.options.maxPingDelay
    	        });
    	    };
    	    TransportManager.prototype.isAlive = function () {
    	        return this.livesLeft > 0;
    	    };
    	    TransportManager.prototype.reportDeath = function () {
    	        this.livesLeft -= 1;
    	    };
    	    return TransportManager;
    	}());
    	exports.__esModule = true;
    	exports["default"] = TransportManager;


    /***/ }),
    /* 43 */
    /***/ (function(module, exports, __webpack_require__) {
    	var assistant_to_the_transport_manager_1 = __webpack_require__(44);
    	var handshake_1 = __webpack_require__(45);
    	var pusher_authorizer_1 = __webpack_require__(48);
    	var timeline_sender_1 = __webpack_require__(49);
    	var presence_channel_1 = __webpack_require__(50);
    	var private_channel_1 = __webpack_require__(51);
    	var encrypted_channel_1 = __webpack_require__(54);
    	var channel_1 = __webpack_require__(52);
    	var connection_manager_1 = __webpack_require__(62);
    	var channels_1 = __webpack_require__(63);
    	var Factory = {
    	    createChannels: function () {
    	        return new channels_1["default"]();
    	    },
    	    createConnectionManager: function (key, options) {
    	        return new connection_manager_1["default"](key, options);
    	    },
    	    createChannel: function (name, pusher) {
    	        return new channel_1["default"](name, pusher);
    	    },
    	    createPrivateChannel: function (name, pusher) {
    	        return new private_channel_1["default"](name, pusher);
    	    },
    	    createPresenceChannel: function (name, pusher) {
    	        return new presence_channel_1["default"](name, pusher);
    	    },
    	    createEncryptedChannel: function (name, pusher) {
    	        return new encrypted_channel_1["default"](name, pusher);
    	    },
    	    createTimelineSender: function (timeline, options) {
    	        return new timeline_sender_1["default"](timeline, options);
    	    },
    	    createAuthorizer: function (channel, options) {
    	        if (options.authorizer) {
    	            return options.authorizer(channel, options);
    	        }
    	        return new pusher_authorizer_1["default"](channel, options);
    	    },
    	    createHandshake: function (transport, callback) {
    	        return new handshake_1["default"](transport, callback);
    	    },
    	    createAssistantToTheTransportManager: function (manager, transport, options) {
    	        return new assistant_to_the_transport_manager_1["default"](manager, transport, options);
    	    }
    	};
    	exports.__esModule = true;
    	exports["default"] = Factory;


    /***/ }),
    /* 44 */
    /***/ (function(module, exports, __webpack_require__) {
    	var util_1 = __webpack_require__(11);
    	var Collections = __webpack_require__(9);
    	var AssistantToTheTransportManager = (function () {
    	    function AssistantToTheTransportManager(manager, transport, options) {
    	        this.manager = manager;
    	        this.transport = transport;
    	        this.minPingDelay = options.minPingDelay;
    	        this.maxPingDelay = options.maxPingDelay;
    	        this.pingDelay = undefined;
    	    }
    	    AssistantToTheTransportManager.prototype.createConnection = function (name, priority, key, options) {
    	        var _this = this;
    	        options = Collections.extend({}, options, {
    	            activityTimeout: this.pingDelay
    	        });
    	        var connection = this.transport.createConnection(name, priority, key, options);
    	        var openTimestamp = null;
    	        var onOpen = function () {
    	            connection.unbind("open", onOpen);
    	            connection.bind("closed", onClosed);
    	            openTimestamp = util_1["default"].now();
    	        };
    	        var onClosed = function (closeEvent) {
    	            connection.unbind("closed", onClosed);
    	            if (closeEvent.code === 1002 || closeEvent.code === 1003) {
    	                _this.manager.reportDeath();
    	            }
    	            else if (!closeEvent.wasClean && openTimestamp) {
    	                var lifespan = util_1["default"].now() - openTimestamp;
    	                if (lifespan < 2 * _this.maxPingDelay) {
    	                    _this.manager.reportDeath();
    	                    _this.pingDelay = Math.max(lifespan / 2, _this.minPingDelay);
    	                }
    	            }
    	        };
    	        connection.bind("open", onOpen);
    	        return connection;
    	    };
    	    AssistantToTheTransportManager.prototype.isSupported = function (environment) {
    	        return this.manager.isAlive() && this.transport.isSupported(environment);
    	    };
    	    return AssistantToTheTransportManager;
    	}());
    	exports.__esModule = true;
    	exports["default"] = AssistantToTheTransportManager;


    /***/ }),
    /* 45 */
    /***/ (function(module, exports, __webpack_require__) {
    	var Collections = __webpack_require__(9);
    	var Protocol = __webpack_require__(46);
    	var connection_1 = __webpack_require__(47);
    	var Handshake = (function () {
    	    function Handshake(transport, callback) {
    	        this.transport = transport;
    	        this.callback = callback;
    	        this.bindListeners();
    	    }
    	    Handshake.prototype.close = function () {
    	        this.unbindListeners();
    	        this.transport.close();
    	    };
    	    Handshake.prototype.bindListeners = function () {
    	        var _this = this;
    	        this.onMessage = function (m) {
    	            _this.unbindListeners();
    	            var result;
    	            try {
    	                result = Protocol.processHandshake(m);
    	            }
    	            catch (e) {
    	                _this.finish("error", { error: e });
    	                _this.transport.close();
    	                return;
    	            }
    	            if (result.action === "connected") {
    	                _this.finish("connected", {
    	                    connection: new connection_1["default"](result.id, _this.transport),
    	                    activityTimeout: result.activityTimeout
    	                });
    	            }
    	            else {
    	                _this.finish(result.action, { error: result.error });
    	                _this.transport.close();
    	            }
    	        };
    	        this.onClosed = function (closeEvent) {
    	            _this.unbindListeners();
    	            var action = Protocol.getCloseAction(closeEvent) || "backoff";
    	            var error = Protocol.getCloseError(closeEvent);
    	            _this.finish(action, { error: error });
    	        };
    	        this.transport.bind("message", this.onMessage);
    	        this.transport.bind("closed", this.onClosed);
    	    };
    	    Handshake.prototype.unbindListeners = function () {
    	        this.transport.unbind("message", this.onMessage);
    	        this.transport.unbind("closed", this.onClosed);
    	    };
    	    Handshake.prototype.finish = function (action, params) {
    	        this.callback(Collections.extend({ transport: this.transport, action: action }, params));
    	    };
    	    return Handshake;
    	}());
    	exports.__esModule = true;
    	exports["default"] = Handshake;


    /***/ }),
    /* 46 */
    /***/ (function(module, exports) {
    	exports.decodeMessage = function (message) {
    	    try {
    	        var params = JSON.parse(message.data);
    	        if (typeof params.data === 'string') {
    	            try {
    	                params.data = JSON.parse(params.data);
    	            }
    	            catch (e) {
    	                if (!(e instanceof SyntaxError)) {
    	                    throw e;
    	                }
    	            }
    	        }
    	        return params;
    	    }
    	    catch (e) {
    	        throw { type: 'MessageParseError', error: e, data: message.data };
    	    }
    	};
    	exports.encodeMessage = function (message) {
    	    return JSON.stringify(message);
    	};
    	exports.processHandshake = function (message) {
    	    message = exports.decodeMessage(message);
    	    if (message.event === "pusher:connection_established") {
    	        if (!message.data.activity_timeout) {
    	            throw "No activity timeout specified in handshake";
    	        }
    	        return {
    	            action: "connected",
    	            id: message.data.socket_id,
    	            activityTimeout: message.data.activity_timeout * 1000
    	        };
    	    }
    	    else if (message.event === "pusher:error") {
    	        return {
    	            action: this.getCloseAction(message.data),
    	            error: this.getCloseError(message.data)
    	        };
    	    }
    	    else {
    	        throw "Invalid handshake";
    	    }
    	};
    	exports.getCloseAction = function (closeEvent) {
    	    if (closeEvent.code < 4000) {
    	        if (closeEvent.code >= 1002 && closeEvent.code <= 1004) {
    	            return "backoff";
    	        }
    	        else {
    	            return null;
    	        }
    	    }
    	    else if (closeEvent.code === 4000) {
    	        return "tls_only";
    	    }
    	    else if (closeEvent.code < 4100) {
    	        return "refused";
    	    }
    	    else if (closeEvent.code < 4200) {
    	        return "backoff";
    	    }
    	    else if (closeEvent.code < 4300) {
    	        return "retry";
    	    }
    	    else {
    	        return "refused";
    	    }
    	};
    	exports.getCloseError = function (closeEvent) {
    	    if (closeEvent.code !== 1000 && closeEvent.code !== 1001) {
    	        return {
    	            type: 'PusherError',
    	            data: {
    	                code: closeEvent.code,
    	                message: closeEvent.reason || closeEvent.message
    	            }
    	        };
    	    }
    	    else {
    	        return null;
    	    }
    	};


    /***/ }),
    /* 47 */
    /***/ (function(module, exports, __webpack_require__) {
    	var __extends = (this && this.__extends) || function (d, b) {
    	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    	    function __() { this.constructor = d; }
    	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    	};
    	var Collections = __webpack_require__(9);
    	var dispatcher_1 = __webpack_require__(24);
    	var Protocol = __webpack_require__(46);
    	var logger_1 = __webpack_require__(8);
    	var Connection = (function (_super) {
    	    __extends(Connection, _super);
    	    function Connection(id, transport) {
    	        _super.call(this);
    	        this.id = id;
    	        this.transport = transport;
    	        this.activityTimeout = transport.activityTimeout;
    	        this.bindListeners();
    	    }
    	    Connection.prototype.handlesActivityChecks = function () {
    	        return this.transport.handlesActivityChecks();
    	    };
    	    Connection.prototype.send = function (data) {
    	        return this.transport.send(data);
    	    };
    	    Connection.prototype.send_event = function (name, data, channel) {
    	        var message = { event: name, data: data };
    	        if (channel) {
    	            message.channel = channel;
    	        }
    	        logger_1["default"].debug('Event sent', message);
    	        return this.send(Protocol.encodeMessage(message));
    	    };
    	    Connection.prototype.ping = function () {
    	        if (this.transport.supportsPing()) {
    	            this.transport.ping();
    	        }
    	        else {
    	            this.send_event('pusher:ping', {});
    	        }
    	    };
    	    Connection.prototype.close = function () {
    	        this.transport.close();
    	    };
    	    Connection.prototype.bindListeners = function () {
    	        var _this = this;
    	        var listeners = {
    	            message: function (m) {
    	                var message;
    	                try {
    	                    message = Protocol.decodeMessage(m);
    	                }
    	                catch (e) {
    	                    _this.emit('error', {
    	                        type: 'MessageParseError',
    	                        error: e,
    	                        data: m.data
    	                    });
    	                }
    	                if (message !== undefined) {
    	                    logger_1["default"].debug('Event recd', message);
    	                    switch (message.event) {
    	                        case 'pusher:error':
    	                            _this.emit('error', { type: 'PusherError', data: message.data });
    	                            break;
    	                        case 'pusher:ping':
    	                            _this.emit("ping");
    	                            break;
    	                        case 'pusher:pong':
    	                            _this.emit("pong");
    	                            break;
    	                    }
    	                    _this.emit('message', message);
    	                }
    	            },
    	            activity: function () {
    	                _this.emit("activity");
    	            },
    	            error: function (error) {
    	                _this.emit("error", { type: "WebSocketError", error: error });
    	            },
    	            closed: function (closeEvent) {
    	                unbindListeners();
    	                if (closeEvent && closeEvent.code) {
    	                    _this.handleCloseEvent(closeEvent);
    	                }
    	                _this.transport = null;
    	                _this.emit("closed");
    	            }
    	        };
    	        var unbindListeners = function () {
    	            Collections.objectApply(listeners, function (listener, event) {
    	                _this.transport.unbind(event, listener);
    	            });
    	        };
    	        Collections.objectApply(listeners, function (listener, event) {
    	            _this.transport.bind(event, listener);
    	        });
    	    };
    	    Connection.prototype.handleCloseEvent = function (closeEvent) {
    	        var action = Protocol.getCloseAction(closeEvent);
    	        var error = Protocol.getCloseError(closeEvent);
    	        if (error) {
    	            this.emit('error', error);
    	        }
    	        if (action) {
    	            this.emit(action, { action: action, error: error });
    	        }
    	    };
    	    return Connection;
    	}(dispatcher_1["default"]));
    	exports.__esModule = true;
    	exports["default"] = Connection;


    /***/ }),
    /* 48 */
    /***/ (function(module, exports, __webpack_require__) {
    	var runtime_1 = __webpack_require__(2);
    	var PusherAuthorizer = (function () {
    	    function PusherAuthorizer(channel, options) {
    	        this.channel = channel;
    	        var authTransport = options.authTransport;
    	        if (typeof runtime_1["default"].getAuthorizers()[authTransport] === "undefined") {
    	            throw "'" + authTransport + "' is not a recognized auth transport";
    	        }
    	        this.type = authTransport;
    	        this.options = options;
    	        this.authOptions = (options || {}).auth || {};
    	    }
    	    PusherAuthorizer.prototype.composeQuery = function (socketId) {
    	        var query = 'socket_id=' + encodeURIComponent(socketId) +
    	            '&channel_name=' + encodeURIComponent(this.channel.name);
    	        for (var i in this.authOptions.params) {
    	            query += "&" + encodeURIComponent(i) + "=" + encodeURIComponent(this.authOptions.params[i]);
    	        }
    	        return query;
    	    };
    	    PusherAuthorizer.prototype.authorize = function (socketId, callback) {
    	        PusherAuthorizer.authorizers = PusherAuthorizer.authorizers || runtime_1["default"].getAuthorizers();
    	        return PusherAuthorizer.authorizers[this.type].call(this, runtime_1["default"], socketId, callback);
    	    };
    	    return PusherAuthorizer;
    	}());
    	exports.__esModule = true;
    	exports["default"] = PusherAuthorizer;


    /***/ }),
    /* 49 */
    /***/ (function(module, exports, __webpack_require__) {
    	var runtime_1 = __webpack_require__(2);
    	var TimelineSender = (function () {
    	    function TimelineSender(timeline, options) {
    	        this.timeline = timeline;
    	        this.options = options || {};
    	    }
    	    TimelineSender.prototype.send = function (useTLS, callback) {
    	        if (this.timeline.isEmpty()) {
    	            return;
    	        }
    	        this.timeline.send(runtime_1["default"].TimelineTransport.getAgent(this, useTLS), callback);
    	    };
    	    return TimelineSender;
    	}());
    	exports.__esModule = true;
    	exports["default"] = TimelineSender;


    /***/ }),
    /* 50 */
    /***/ (function(module, exports, __webpack_require__) {
    	var __extends = (this && this.__extends) || function (d, b) {
    	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    	    function __() { this.constructor = d; }
    	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    	};
    	var private_channel_1 = __webpack_require__(51);
    	var logger_1 = __webpack_require__(8);
    	var members_1 = __webpack_require__(53);
    	var url_store_1 = __webpack_require__(14);
    	var PresenceChannel = (function (_super) {
    	    __extends(PresenceChannel, _super);
    	    function PresenceChannel(name, pusher) {
    	        _super.call(this, name, pusher);
    	        this.members = new members_1["default"]();
    	    }
    	    PresenceChannel.prototype.authorize = function (socketId, callback) {
    	        var _this = this;
    	        _super.prototype.authorize.call(this, socketId, function (error, authData) {
    	            if (!error) {
    	                if (authData.channel_data === undefined) {
    	                    var suffix = url_store_1["default"].buildLogSuffix("authenticationEndpoint");
    	                    logger_1["default"].warn(("Invalid auth response for channel '" + _this.name + "',") +
    	                        ("expected 'channel_data' field. " + suffix));
    	                    callback("Invalid auth response");
    	                    return;
    	                }
    	                var channelData = JSON.parse(authData.channel_data);
    	                _this.members.setMyID(channelData.user_id);
    	            }
    	            callback(error, authData);
    	        });
    	    };
    	    PresenceChannel.prototype.handleEvent = function (event, data) {
    	        switch (event) {
    	            case "pusher_internal:subscription_succeeded":
    	                this.subscriptionPending = false;
    	                this.subscribed = true;
    	                if (this.subscriptionCancelled) {
    	                    this.pusher.unsubscribe(this.name);
    	                }
    	                else {
    	                    this.members.onSubscription(data);
    	                    this.emit("pusher:subscription_succeeded", this.members);
    	                }
    	                break;
    	            case "pusher_internal:member_added":
    	                var addedMember = this.members.addMember(data);
    	                this.emit('pusher:member_added', addedMember);
    	                break;
    	            case "pusher_internal:member_removed":
    	                var removedMember = this.members.removeMember(data);
    	                if (removedMember) {
    	                    this.emit('pusher:member_removed', removedMember);
    	                }
    	                break;
    	            default:
    	                private_channel_1["default"].prototype.handleEvent.call(this, event, data);
    	        }
    	    };
    	    PresenceChannel.prototype.disconnect = function () {
    	        this.members.reset();
    	        _super.prototype.disconnect.call(this);
    	    };
    	    return PresenceChannel;
    	}(private_channel_1["default"]));
    	exports.__esModule = true;
    	exports["default"] = PresenceChannel;


    /***/ }),
    /* 51 */
    /***/ (function(module, exports, __webpack_require__) {
    	var __extends = (this && this.__extends) || function (d, b) {
    	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    	    function __() { this.constructor = d; }
    	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    	};
    	var factory_1 = __webpack_require__(43);
    	var channel_1 = __webpack_require__(52);
    	var PrivateChannel = (function (_super) {
    	    __extends(PrivateChannel, _super);
    	    function PrivateChannel() {
    	        _super.apply(this, arguments);
    	    }
    	    PrivateChannel.prototype.authorize = function (socketId, callback) {
    	        var authorizer = factory_1["default"].createAuthorizer(this, this.pusher.config);
    	        return authorizer.authorize(socketId, callback);
    	    };
    	    return PrivateChannel;
    	}(channel_1["default"]));
    	exports.__esModule = true;
    	exports["default"] = PrivateChannel;


    /***/ }),
    /* 52 */
    /***/ (function(module, exports, __webpack_require__) {
    	var __extends = (this && this.__extends) || function (d, b) {
    	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    	    function __() { this.constructor = d; }
    	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    	};
    	var dispatcher_1 = __webpack_require__(24);
    	var Errors = __webpack_require__(31);
    	var logger_1 = __webpack_require__(8);
    	var Channel = (function (_super) {
    	    __extends(Channel, _super);
    	    function Channel(name, pusher) {
    	        _super.call(this, function (event, data) {
    	            logger_1["default"].debug('No callbacks on ' + name + ' for ' + event);
    	        });
    	        this.name = name;
    	        this.pusher = pusher;
    	        this.subscribed = false;
    	        this.subscriptionPending = false;
    	        this.subscriptionCancelled = false;
    	    }
    	    Channel.prototype.authorize = function (socketId, callback) {
    	        return callback(false, {});
    	    };
    	    Channel.prototype.trigger = function (event, data) {
    	        if (event.indexOf("client-") !== 0) {
    	            throw new Errors.BadEventName("Event '" + event + "' does not start with 'client-'");
    	        }
    	        return this.pusher.send_event(event, data, this.name);
    	    };
    	    Channel.prototype.disconnect = function () {
    	        this.subscribed = false;
    	        this.subscriptionPending = false;
    	    };
    	    Channel.prototype.handleEvent = function (event, data) {
    	        if (event.indexOf("pusher_internal:") === 0) {
    	            if (event === "pusher_internal:subscription_succeeded") {
    	                this.subscriptionPending = false;
    	                this.subscribed = true;
    	                if (this.subscriptionCancelled) {
    	                    this.pusher.unsubscribe(this.name);
    	                }
    	                else {
    	                    this.emit("pusher:subscription_succeeded", data);
    	                }
    	            }
    	        }
    	        else {
    	            this.emit(event, data);
    	        }
    	    };
    	    Channel.prototype.subscribe = function () {
    	        var _this = this;
    	        if (this.subscribed) {
    	            return;
    	        }
    	        this.subscriptionPending = true;
    	        this.subscriptionCancelled = false;
    	        this.authorize(this.pusher.connection.socket_id, function (error, data) {
    	            if (error) {
    	                _this.handleEvent('pusher:subscription_error', data);
    	            }
    	            else {
    	                _this.pusher.send_event('pusher:subscribe', {
    	                    auth: data.auth,
    	                    channel_data: data.channel_data,
    	                    channel: _this.name
    	                });
    	            }
    	        });
    	    };
    	    Channel.prototype.unsubscribe = function () {
    	        this.subscribed = false;
    	        this.pusher.send_event('pusher:unsubscribe', {
    	            channel: this.name
    	        });
    	    };
    	    Channel.prototype.cancelSubscription = function () {
    	        this.subscriptionCancelled = true;
    	    };
    	    Channel.prototype.reinstateSubscription = function () {
    	        this.subscriptionCancelled = false;
    	    };
    	    return Channel;
    	}(dispatcher_1["default"]));
    	exports.__esModule = true;
    	exports["default"] = Channel;


    /***/ }),
    /* 53 */
    /***/ (function(module, exports, __webpack_require__) {
    	var Collections = __webpack_require__(9);
    	var Members = (function () {
    	    function Members() {
    	        this.reset();
    	    }
    	    Members.prototype.get = function (id) {
    	        if (Object.prototype.hasOwnProperty.call(this.members, id)) {
    	            return {
    	                id: id,
    	                info: this.members[id]
    	            };
    	        }
    	        else {
    	            return null;
    	        }
    	    };
    	    Members.prototype.each = function (callback) {
    	        var _this = this;
    	        Collections.objectApply(this.members, function (member, id) {
    	            callback(_this.get(id));
    	        });
    	    };
    	    Members.prototype.setMyID = function (id) {
    	        this.myID = id;
    	    };
    	    Members.prototype.onSubscription = function (subscriptionData) {
    	        this.members = subscriptionData.presence.hash;
    	        this.count = subscriptionData.presence.count;
    	        this.me = this.get(this.myID);
    	    };
    	    Members.prototype.addMember = function (memberData) {
    	        if (this.get(memberData.user_id) === null) {
    	            this.count++;
    	        }
    	        this.members[memberData.user_id] = memberData.user_info;
    	        return this.get(memberData.user_id);
    	    };
    	    Members.prototype.removeMember = function (memberData) {
    	        var member = this.get(memberData.user_id);
    	        if (member) {
    	            delete this.members[memberData.user_id];
    	            this.count--;
    	        }
    	        return member;
    	    };
    	    Members.prototype.reset = function () {
    	        this.members = {};
    	        this.count = 0;
    	        this.myID = null;
    	        this.me = null;
    	    };
    	    return Members;
    	}());
    	exports.__esModule = true;
    	exports["default"] = Members;


    /***/ }),
    /* 54 */
    /***/ (function(module, exports, __webpack_require__) {
    	var __extends = (this && this.__extends) || function (d, b) {
    	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    	    function __() { this.constructor = d; }
    	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    	};
    	var private_channel_1 = __webpack_require__(51);
    	var Errors = __webpack_require__(31);
    	var logger_1 = __webpack_require__(8);
    	var tweetnacl_1 = __webpack_require__(55);
    	var tweetnacl_util_1 = __webpack_require__(57);
    	var EncryptedChannel = (function (_super) {
    	    __extends(EncryptedChannel, _super);
    	    function EncryptedChannel() {
    	        _super.apply(this, arguments);
    	        this.key = null;
    	    }
    	    EncryptedChannel.prototype.authorize = function (socketId, callback) {
    	        var _this = this;
    	        _super.prototype.authorize.call(this, socketId, function (error, authData) {
    	            if (error) {
    	                callback(true, authData);
    	                return;
    	            }
    	            var sharedSecret = authData["shared_secret"];
    	            if (!sharedSecret) {
    	                var errorMsg = "No shared_secret key in auth payload for encrypted channel: " + _this.name;
    	                callback(true, errorMsg);
    	                logger_1["default"].warn("Error: " + errorMsg);
    	                return;
    	            }
    	            _this.key = tweetnacl_util_1.decodeBase64(sharedSecret);
    	            delete authData["shared_secret"];
    	            callback(false, authData);
    	        });
    	    };
    	    EncryptedChannel.prototype.trigger = function (event, data) {
    	        throw new Errors.UnsupportedFeature('Client events are not currently supported for encrypted channels');
    	    };
    	    EncryptedChannel.prototype.handleEvent = function (event, data) {
    	        if (event.indexOf("pusher_internal:") === 0 || event.indexOf("pusher:") === 0) {
    	            _super.prototype.handleEvent.call(this, event, data);
    	            return;
    	        }
    	        this.handleEncryptedEvent(event, data);
    	    };
    	    EncryptedChannel.prototype.handleEncryptedEvent = function (event, data) {
    	        var _this = this;
    	        if (!this.key) {
    	            logger_1["default"].debug('Received encrypted event before key has been retrieved from the authEndpoint');
    	            return;
    	        }
    	        if (!data.ciphertext || !data.nonce) {
    	            logger_1["default"].warn('Unexpected format for encrypted event, expected object with `ciphertext` and `nonce` fields, got: ' + data);
    	            return;
    	        }
    	        var cipherText = tweetnacl_util_1.decodeBase64(data.ciphertext);
    	        if (cipherText.length < tweetnacl_1.secretbox.overheadLength) {
    	            logger_1["default"].warn("Expected encrypted event ciphertext length to be " + tweetnacl_1.secretbox.overheadLength + ", got: " + cipherText.length);
    	            return;
    	        }
    	        var nonce = tweetnacl_util_1.decodeBase64(data.nonce);
    	        if (nonce.length < tweetnacl_1.secretbox.nonceLength) {
    	            logger_1["default"].warn("Expected encrypted event nonce length to be " + tweetnacl_1.secretbox.nonceLength + ", got: " + nonce.length);
    	            return;
    	        }
    	        var bytes = tweetnacl_1.secretbox.open(cipherText, nonce, this.key);
    	        if (bytes === null) {
    	            logger_1["default"].debug('Failed to decrypted an event, probably because it was encrypted with a different key. Fetching a new key from the authEndpoint...');
    	            this.authorize(this.pusher.connection.socket_id, function (error, authData) {
    	                if (error) {
    	                    logger_1["default"].warn("Failed to make a request to the authEndpoint: " + authData + ". Unable to fetch new key, so dropping encrypted event");
    	                    return;
    	                }
    	                bytes = tweetnacl_1.secretbox.open(cipherText, nonce, _this.key);
    	                if (bytes === null) {
    	                    logger_1["default"].warn("Failed to decrypt event with new key. Dropping encrypted event");
    	                    return;
    	                }
    	                _this.emitJSON(event, tweetnacl_util_1.encodeUTF8(bytes));
    	                return;
    	            });
    	            return;
    	        }
    	        this.emitJSON(event, tweetnacl_util_1.encodeUTF8(bytes));
    	    };
    	    EncryptedChannel.prototype.emitJSON = function (eventName, data) {
    	        try {
    	            this.emit(eventName, JSON.parse(data));
    	        }
    	        catch (e) {
    	            this.emit(eventName, data);
    	        }
    	        return this;
    	    };
    	    return EncryptedChannel;
    	}(private_channel_1["default"]));
    	exports.__esModule = true;
    	exports["default"] = EncryptedChannel;


    /***/ }),
    /* 55 */
    /***/ (function(module, exports, __webpack_require__) {

    	(function(nacl) {

    	// Ported in 2014 by Dmitry Chestnykh and Devi Mandiri.
    	// Public domain.
    	//
    	// Implementation derived from TweetNaCl version 20140427.
    	// See for details: http://tweetnacl.cr.yp.to/

    	var gf = function(init) {
    	  var i, r = new Float64Array(16);
    	  if (init) for (i = 0; i < init.length; i++) r[i] = init[i];
    	  return r;
    	};

    	//  Pluggable, initialized in high-level API below.
    	var randombytes = function(/* x, n */) { throw new Error('no PRNG'); };

    	var _0 = new Uint8Array(16);
    	var _9 = new Uint8Array(32); _9[0] = 9;

    	var gf0 = gf(),
    	    gf1 = gf([1]),
    	    _121665 = gf([0xdb41, 1]),
    	    D = gf([0x78a3, 0x1359, 0x4dca, 0x75eb, 0xd8ab, 0x4141, 0x0a4d, 0x0070, 0xe898, 0x7779, 0x4079, 0x8cc7, 0xfe73, 0x2b6f, 0x6cee, 0x5203]),
    	    D2 = gf([0xf159, 0x26b2, 0x9b94, 0xebd6, 0xb156, 0x8283, 0x149a, 0x00e0, 0xd130, 0xeef3, 0x80f2, 0x198e, 0xfce7, 0x56df, 0xd9dc, 0x2406]),
    	    X = gf([0xd51a, 0x8f25, 0x2d60, 0xc956, 0xa7b2, 0x9525, 0xc760, 0x692c, 0xdc5c, 0xfdd6, 0xe231, 0xc0a4, 0x53fe, 0xcd6e, 0x36d3, 0x2169]),
    	    Y = gf([0x6658, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666]),
    	    I = gf([0xa0b0, 0x4a0e, 0x1b27, 0xc4ee, 0xe478, 0xad2f, 0x1806, 0x2f43, 0xd7a7, 0x3dfb, 0x0099, 0x2b4d, 0xdf0b, 0x4fc1, 0x2480, 0x2b83]);

    	function ts64(x, i, h, l) {
    	  x[i]   = (h >> 24) & 0xff;
    	  x[i+1] = (h >> 16) & 0xff;
    	  x[i+2] = (h >>  8) & 0xff;
    	  x[i+3] = h & 0xff;
    	  x[i+4] = (l >> 24)  & 0xff;
    	  x[i+5] = (l >> 16)  & 0xff;
    	  x[i+6] = (l >>  8)  & 0xff;
    	  x[i+7] = l & 0xff;
    	}

    	function vn(x, xi, y, yi, n) {
    	  var i,d = 0;
    	  for (i = 0; i < n; i++) d |= x[xi+i]^y[yi+i];
    	  return (1 & ((d - 1) >>> 8)) - 1;
    	}

    	function crypto_verify_16(x, xi, y, yi) {
    	  return vn(x,xi,y,yi,16);
    	}

    	function crypto_verify_32(x, xi, y, yi) {
    	  return vn(x,xi,y,yi,32);
    	}

    	function core_salsa20(o, p, k, c) {
    	  var j0  = c[ 0] & 0xff | (c[ 1] & 0xff)<<8 | (c[ 2] & 0xff)<<16 | (c[ 3] & 0xff)<<24,
    	      j1  = k[ 0] & 0xff | (k[ 1] & 0xff)<<8 | (k[ 2] & 0xff)<<16 | (k[ 3] & 0xff)<<24,
    	      j2  = k[ 4] & 0xff | (k[ 5] & 0xff)<<8 | (k[ 6] & 0xff)<<16 | (k[ 7] & 0xff)<<24,
    	      j3  = k[ 8] & 0xff | (k[ 9] & 0xff)<<8 | (k[10] & 0xff)<<16 | (k[11] & 0xff)<<24,
    	      j4  = k[12] & 0xff | (k[13] & 0xff)<<8 | (k[14] & 0xff)<<16 | (k[15] & 0xff)<<24,
    	      j5  = c[ 4] & 0xff | (c[ 5] & 0xff)<<8 | (c[ 6] & 0xff)<<16 | (c[ 7] & 0xff)<<24,
    	      j6  = p[ 0] & 0xff | (p[ 1] & 0xff)<<8 | (p[ 2] & 0xff)<<16 | (p[ 3] & 0xff)<<24,
    	      j7  = p[ 4] & 0xff | (p[ 5] & 0xff)<<8 | (p[ 6] & 0xff)<<16 | (p[ 7] & 0xff)<<24,
    	      j8  = p[ 8] & 0xff | (p[ 9] & 0xff)<<8 | (p[10] & 0xff)<<16 | (p[11] & 0xff)<<24,
    	      j9  = p[12] & 0xff | (p[13] & 0xff)<<8 | (p[14] & 0xff)<<16 | (p[15] & 0xff)<<24,
    	      j10 = c[ 8] & 0xff | (c[ 9] & 0xff)<<8 | (c[10] & 0xff)<<16 | (c[11] & 0xff)<<24,
    	      j11 = k[16] & 0xff | (k[17] & 0xff)<<8 | (k[18] & 0xff)<<16 | (k[19] & 0xff)<<24,
    	      j12 = k[20] & 0xff | (k[21] & 0xff)<<8 | (k[22] & 0xff)<<16 | (k[23] & 0xff)<<24,
    	      j13 = k[24] & 0xff | (k[25] & 0xff)<<8 | (k[26] & 0xff)<<16 | (k[27] & 0xff)<<24,
    	      j14 = k[28] & 0xff | (k[29] & 0xff)<<8 | (k[30] & 0xff)<<16 | (k[31] & 0xff)<<24,
    	      j15 = c[12] & 0xff | (c[13] & 0xff)<<8 | (c[14] & 0xff)<<16 | (c[15] & 0xff)<<24;

    	  var x0 = j0, x1 = j1, x2 = j2, x3 = j3, x4 = j4, x5 = j5, x6 = j6, x7 = j7,
    	      x8 = j8, x9 = j9, x10 = j10, x11 = j11, x12 = j12, x13 = j13, x14 = j14,
    	      x15 = j15, u;

    	  for (var i = 0; i < 20; i += 2) {
    	    u = x0 + x12 | 0;
    	    x4 ^= u<<7 | u>>>(32-7);
    	    u = x4 + x0 | 0;
    	    x8 ^= u<<9 | u>>>(32-9);
    	    u = x8 + x4 | 0;
    	    x12 ^= u<<13 | u>>>(32-13);
    	    u = x12 + x8 | 0;
    	    x0 ^= u<<18 | u>>>(32-18);

    	    u = x5 + x1 | 0;
    	    x9 ^= u<<7 | u>>>(32-7);
    	    u = x9 + x5 | 0;
    	    x13 ^= u<<9 | u>>>(32-9);
    	    u = x13 + x9 | 0;
    	    x1 ^= u<<13 | u>>>(32-13);
    	    u = x1 + x13 | 0;
    	    x5 ^= u<<18 | u>>>(32-18);

    	    u = x10 + x6 | 0;
    	    x14 ^= u<<7 | u>>>(32-7);
    	    u = x14 + x10 | 0;
    	    x2 ^= u<<9 | u>>>(32-9);
    	    u = x2 + x14 | 0;
    	    x6 ^= u<<13 | u>>>(32-13);
    	    u = x6 + x2 | 0;
    	    x10 ^= u<<18 | u>>>(32-18);

    	    u = x15 + x11 | 0;
    	    x3 ^= u<<7 | u>>>(32-7);
    	    u = x3 + x15 | 0;
    	    x7 ^= u<<9 | u>>>(32-9);
    	    u = x7 + x3 | 0;
    	    x11 ^= u<<13 | u>>>(32-13);
    	    u = x11 + x7 | 0;
    	    x15 ^= u<<18 | u>>>(32-18);

    	    u = x0 + x3 | 0;
    	    x1 ^= u<<7 | u>>>(32-7);
    	    u = x1 + x0 | 0;
    	    x2 ^= u<<9 | u>>>(32-9);
    	    u = x2 + x1 | 0;
    	    x3 ^= u<<13 | u>>>(32-13);
    	    u = x3 + x2 | 0;
    	    x0 ^= u<<18 | u>>>(32-18);

    	    u = x5 + x4 | 0;
    	    x6 ^= u<<7 | u>>>(32-7);
    	    u = x6 + x5 | 0;
    	    x7 ^= u<<9 | u>>>(32-9);
    	    u = x7 + x6 | 0;
    	    x4 ^= u<<13 | u>>>(32-13);
    	    u = x4 + x7 | 0;
    	    x5 ^= u<<18 | u>>>(32-18);

    	    u = x10 + x9 | 0;
    	    x11 ^= u<<7 | u>>>(32-7);
    	    u = x11 + x10 | 0;
    	    x8 ^= u<<9 | u>>>(32-9);
    	    u = x8 + x11 | 0;
    	    x9 ^= u<<13 | u>>>(32-13);
    	    u = x9 + x8 | 0;
    	    x10 ^= u<<18 | u>>>(32-18);

    	    u = x15 + x14 | 0;
    	    x12 ^= u<<7 | u>>>(32-7);
    	    u = x12 + x15 | 0;
    	    x13 ^= u<<9 | u>>>(32-9);
    	    u = x13 + x12 | 0;
    	    x14 ^= u<<13 | u>>>(32-13);
    	    u = x14 + x13 | 0;
    	    x15 ^= u<<18 | u>>>(32-18);
    	  }
    	   x0 =  x0 +  j0 | 0;
    	   x1 =  x1 +  j1 | 0;
    	   x2 =  x2 +  j2 | 0;
    	   x3 =  x3 +  j3 | 0;
    	   x4 =  x4 +  j4 | 0;
    	   x5 =  x5 +  j5 | 0;
    	   x6 =  x6 +  j6 | 0;
    	   x7 =  x7 +  j7 | 0;
    	   x8 =  x8 +  j8 | 0;
    	   x9 =  x9 +  j9 | 0;
    	  x10 = x10 + j10 | 0;
    	  x11 = x11 + j11 | 0;
    	  x12 = x12 + j12 | 0;
    	  x13 = x13 + j13 | 0;
    	  x14 = x14 + j14 | 0;
    	  x15 = x15 + j15 | 0;

    	  o[ 0] = x0 >>>  0 & 0xff;
    	  o[ 1] = x0 >>>  8 & 0xff;
    	  o[ 2] = x0 >>> 16 & 0xff;
    	  o[ 3] = x0 >>> 24 & 0xff;

    	  o[ 4] = x1 >>>  0 & 0xff;
    	  o[ 5] = x1 >>>  8 & 0xff;
    	  o[ 6] = x1 >>> 16 & 0xff;
    	  o[ 7] = x1 >>> 24 & 0xff;

    	  o[ 8] = x2 >>>  0 & 0xff;
    	  o[ 9] = x2 >>>  8 & 0xff;
    	  o[10] = x2 >>> 16 & 0xff;
    	  o[11] = x2 >>> 24 & 0xff;

    	  o[12] = x3 >>>  0 & 0xff;
    	  o[13] = x3 >>>  8 & 0xff;
    	  o[14] = x3 >>> 16 & 0xff;
    	  o[15] = x3 >>> 24 & 0xff;

    	  o[16] = x4 >>>  0 & 0xff;
    	  o[17] = x4 >>>  8 & 0xff;
    	  o[18] = x4 >>> 16 & 0xff;
    	  o[19] = x4 >>> 24 & 0xff;

    	  o[20] = x5 >>>  0 & 0xff;
    	  o[21] = x5 >>>  8 & 0xff;
    	  o[22] = x5 >>> 16 & 0xff;
    	  o[23] = x5 >>> 24 & 0xff;

    	  o[24] = x6 >>>  0 & 0xff;
    	  o[25] = x6 >>>  8 & 0xff;
    	  o[26] = x6 >>> 16 & 0xff;
    	  o[27] = x6 >>> 24 & 0xff;

    	  o[28] = x7 >>>  0 & 0xff;
    	  o[29] = x7 >>>  8 & 0xff;
    	  o[30] = x7 >>> 16 & 0xff;
    	  o[31] = x7 >>> 24 & 0xff;

    	  o[32] = x8 >>>  0 & 0xff;
    	  o[33] = x8 >>>  8 & 0xff;
    	  o[34] = x8 >>> 16 & 0xff;
    	  o[35] = x8 >>> 24 & 0xff;

    	  o[36] = x9 >>>  0 & 0xff;
    	  o[37] = x9 >>>  8 & 0xff;
    	  o[38] = x9 >>> 16 & 0xff;
    	  o[39] = x9 >>> 24 & 0xff;

    	  o[40] = x10 >>>  0 & 0xff;
    	  o[41] = x10 >>>  8 & 0xff;
    	  o[42] = x10 >>> 16 & 0xff;
    	  o[43] = x10 >>> 24 & 0xff;

    	  o[44] = x11 >>>  0 & 0xff;
    	  o[45] = x11 >>>  8 & 0xff;
    	  o[46] = x11 >>> 16 & 0xff;
    	  o[47] = x11 >>> 24 & 0xff;

    	  o[48] = x12 >>>  0 & 0xff;
    	  o[49] = x12 >>>  8 & 0xff;
    	  o[50] = x12 >>> 16 & 0xff;
    	  o[51] = x12 >>> 24 & 0xff;

    	  o[52] = x13 >>>  0 & 0xff;
    	  o[53] = x13 >>>  8 & 0xff;
    	  o[54] = x13 >>> 16 & 0xff;
    	  o[55] = x13 >>> 24 & 0xff;

    	  o[56] = x14 >>>  0 & 0xff;
    	  o[57] = x14 >>>  8 & 0xff;
    	  o[58] = x14 >>> 16 & 0xff;
    	  o[59] = x14 >>> 24 & 0xff;

    	  o[60] = x15 >>>  0 & 0xff;
    	  o[61] = x15 >>>  8 & 0xff;
    	  o[62] = x15 >>> 16 & 0xff;
    	  o[63] = x15 >>> 24 & 0xff;
    	}

    	function core_hsalsa20(o,p,k,c) {
    	  var j0  = c[ 0] & 0xff | (c[ 1] & 0xff)<<8 | (c[ 2] & 0xff)<<16 | (c[ 3] & 0xff)<<24,
    	      j1  = k[ 0] & 0xff | (k[ 1] & 0xff)<<8 | (k[ 2] & 0xff)<<16 | (k[ 3] & 0xff)<<24,
    	      j2  = k[ 4] & 0xff | (k[ 5] & 0xff)<<8 | (k[ 6] & 0xff)<<16 | (k[ 7] & 0xff)<<24,
    	      j3  = k[ 8] & 0xff | (k[ 9] & 0xff)<<8 | (k[10] & 0xff)<<16 | (k[11] & 0xff)<<24,
    	      j4  = k[12] & 0xff | (k[13] & 0xff)<<8 | (k[14] & 0xff)<<16 | (k[15] & 0xff)<<24,
    	      j5  = c[ 4] & 0xff | (c[ 5] & 0xff)<<8 | (c[ 6] & 0xff)<<16 | (c[ 7] & 0xff)<<24,
    	      j6  = p[ 0] & 0xff | (p[ 1] & 0xff)<<8 | (p[ 2] & 0xff)<<16 | (p[ 3] & 0xff)<<24,
    	      j7  = p[ 4] & 0xff | (p[ 5] & 0xff)<<8 | (p[ 6] & 0xff)<<16 | (p[ 7] & 0xff)<<24,
    	      j8  = p[ 8] & 0xff | (p[ 9] & 0xff)<<8 | (p[10] & 0xff)<<16 | (p[11] & 0xff)<<24,
    	      j9  = p[12] & 0xff | (p[13] & 0xff)<<8 | (p[14] & 0xff)<<16 | (p[15] & 0xff)<<24,
    	      j10 = c[ 8] & 0xff | (c[ 9] & 0xff)<<8 | (c[10] & 0xff)<<16 | (c[11] & 0xff)<<24,
    	      j11 = k[16] & 0xff | (k[17] & 0xff)<<8 | (k[18] & 0xff)<<16 | (k[19] & 0xff)<<24,
    	      j12 = k[20] & 0xff | (k[21] & 0xff)<<8 | (k[22] & 0xff)<<16 | (k[23] & 0xff)<<24,
    	      j13 = k[24] & 0xff | (k[25] & 0xff)<<8 | (k[26] & 0xff)<<16 | (k[27] & 0xff)<<24,
    	      j14 = k[28] & 0xff | (k[29] & 0xff)<<8 | (k[30] & 0xff)<<16 | (k[31] & 0xff)<<24,
    	      j15 = c[12] & 0xff | (c[13] & 0xff)<<8 | (c[14] & 0xff)<<16 | (c[15] & 0xff)<<24;

    	  var x0 = j0, x1 = j1, x2 = j2, x3 = j3, x4 = j4, x5 = j5, x6 = j6, x7 = j7,
    	      x8 = j8, x9 = j9, x10 = j10, x11 = j11, x12 = j12, x13 = j13, x14 = j14,
    	      x15 = j15, u;

    	  for (var i = 0; i < 20; i += 2) {
    	    u = x0 + x12 | 0;
    	    x4 ^= u<<7 | u>>>(32-7);
    	    u = x4 + x0 | 0;
    	    x8 ^= u<<9 | u>>>(32-9);
    	    u = x8 + x4 | 0;
    	    x12 ^= u<<13 | u>>>(32-13);
    	    u = x12 + x8 | 0;
    	    x0 ^= u<<18 | u>>>(32-18);

    	    u = x5 + x1 | 0;
    	    x9 ^= u<<7 | u>>>(32-7);
    	    u = x9 + x5 | 0;
    	    x13 ^= u<<9 | u>>>(32-9);
    	    u = x13 + x9 | 0;
    	    x1 ^= u<<13 | u>>>(32-13);
    	    u = x1 + x13 | 0;
    	    x5 ^= u<<18 | u>>>(32-18);

    	    u = x10 + x6 | 0;
    	    x14 ^= u<<7 | u>>>(32-7);
    	    u = x14 + x10 | 0;
    	    x2 ^= u<<9 | u>>>(32-9);
    	    u = x2 + x14 | 0;
    	    x6 ^= u<<13 | u>>>(32-13);
    	    u = x6 + x2 | 0;
    	    x10 ^= u<<18 | u>>>(32-18);

    	    u = x15 + x11 | 0;
    	    x3 ^= u<<7 | u>>>(32-7);
    	    u = x3 + x15 | 0;
    	    x7 ^= u<<9 | u>>>(32-9);
    	    u = x7 + x3 | 0;
    	    x11 ^= u<<13 | u>>>(32-13);
    	    u = x11 + x7 | 0;
    	    x15 ^= u<<18 | u>>>(32-18);

    	    u = x0 + x3 | 0;
    	    x1 ^= u<<7 | u>>>(32-7);
    	    u = x1 + x0 | 0;
    	    x2 ^= u<<9 | u>>>(32-9);
    	    u = x2 + x1 | 0;
    	    x3 ^= u<<13 | u>>>(32-13);
    	    u = x3 + x2 | 0;
    	    x0 ^= u<<18 | u>>>(32-18);

    	    u = x5 + x4 | 0;
    	    x6 ^= u<<7 | u>>>(32-7);
    	    u = x6 + x5 | 0;
    	    x7 ^= u<<9 | u>>>(32-9);
    	    u = x7 + x6 | 0;
    	    x4 ^= u<<13 | u>>>(32-13);
    	    u = x4 + x7 | 0;
    	    x5 ^= u<<18 | u>>>(32-18);

    	    u = x10 + x9 | 0;
    	    x11 ^= u<<7 | u>>>(32-7);
    	    u = x11 + x10 | 0;
    	    x8 ^= u<<9 | u>>>(32-9);
    	    u = x8 + x11 | 0;
    	    x9 ^= u<<13 | u>>>(32-13);
    	    u = x9 + x8 | 0;
    	    x10 ^= u<<18 | u>>>(32-18);

    	    u = x15 + x14 | 0;
    	    x12 ^= u<<7 | u>>>(32-7);
    	    u = x12 + x15 | 0;
    	    x13 ^= u<<9 | u>>>(32-9);
    	    u = x13 + x12 | 0;
    	    x14 ^= u<<13 | u>>>(32-13);
    	    u = x14 + x13 | 0;
    	    x15 ^= u<<18 | u>>>(32-18);
    	  }

    	  o[ 0] = x0 >>>  0 & 0xff;
    	  o[ 1] = x0 >>>  8 & 0xff;
    	  o[ 2] = x0 >>> 16 & 0xff;
    	  o[ 3] = x0 >>> 24 & 0xff;

    	  o[ 4] = x5 >>>  0 & 0xff;
    	  o[ 5] = x5 >>>  8 & 0xff;
    	  o[ 6] = x5 >>> 16 & 0xff;
    	  o[ 7] = x5 >>> 24 & 0xff;

    	  o[ 8] = x10 >>>  0 & 0xff;
    	  o[ 9] = x10 >>>  8 & 0xff;
    	  o[10] = x10 >>> 16 & 0xff;
    	  o[11] = x10 >>> 24 & 0xff;

    	  o[12] = x15 >>>  0 & 0xff;
    	  o[13] = x15 >>>  8 & 0xff;
    	  o[14] = x15 >>> 16 & 0xff;
    	  o[15] = x15 >>> 24 & 0xff;

    	  o[16] = x6 >>>  0 & 0xff;
    	  o[17] = x6 >>>  8 & 0xff;
    	  o[18] = x6 >>> 16 & 0xff;
    	  o[19] = x6 >>> 24 & 0xff;

    	  o[20] = x7 >>>  0 & 0xff;
    	  o[21] = x7 >>>  8 & 0xff;
    	  o[22] = x7 >>> 16 & 0xff;
    	  o[23] = x7 >>> 24 & 0xff;

    	  o[24] = x8 >>>  0 & 0xff;
    	  o[25] = x8 >>>  8 & 0xff;
    	  o[26] = x8 >>> 16 & 0xff;
    	  o[27] = x8 >>> 24 & 0xff;

    	  o[28] = x9 >>>  0 & 0xff;
    	  o[29] = x9 >>>  8 & 0xff;
    	  o[30] = x9 >>> 16 & 0xff;
    	  o[31] = x9 >>> 24 & 0xff;
    	}

    	function crypto_core_salsa20(out,inp,k,c) {
    	  core_salsa20(out,inp,k,c);
    	}

    	function crypto_core_hsalsa20(out,inp,k,c) {
    	  core_hsalsa20(out,inp,k,c);
    	}

    	var sigma = new Uint8Array([101, 120, 112, 97, 110, 100, 32, 51, 50, 45, 98, 121, 116, 101, 32, 107]);
    	            // "expand 32-byte k"

    	function crypto_stream_salsa20_xor(c,cpos,m,mpos,b,n,k) {
    	  var z = new Uint8Array(16), x = new Uint8Array(64);
    	  var u, i;
    	  for (i = 0; i < 16; i++) z[i] = 0;
    	  for (i = 0; i < 8; i++) z[i] = n[i];
    	  while (b >= 64) {
    	    crypto_core_salsa20(x,z,k,sigma);
    	    for (i = 0; i < 64; i++) c[cpos+i] = m[mpos+i] ^ x[i];
    	    u = 1;
    	    for (i = 8; i < 16; i++) {
    	      u = u + (z[i] & 0xff) | 0;
    	      z[i] = u & 0xff;
    	      u >>>= 8;
    	    }
    	    b -= 64;
    	    cpos += 64;
    	    mpos += 64;
    	  }
    	  if (b > 0) {
    	    crypto_core_salsa20(x,z,k,sigma);
    	    for (i = 0; i < b; i++) c[cpos+i] = m[mpos+i] ^ x[i];
    	  }
    	  return 0;
    	}

    	function crypto_stream_salsa20(c,cpos,b,n,k) {
    	  var z = new Uint8Array(16), x = new Uint8Array(64);
    	  var u, i;
    	  for (i = 0; i < 16; i++) z[i] = 0;
    	  for (i = 0; i < 8; i++) z[i] = n[i];
    	  while (b >= 64) {
    	    crypto_core_salsa20(x,z,k,sigma);
    	    for (i = 0; i < 64; i++) c[cpos+i] = x[i];
    	    u = 1;
    	    for (i = 8; i < 16; i++) {
    	      u = u + (z[i] & 0xff) | 0;
    	      z[i] = u & 0xff;
    	      u >>>= 8;
    	    }
    	    b -= 64;
    	    cpos += 64;
    	  }
    	  if (b > 0) {
    	    crypto_core_salsa20(x,z,k,sigma);
    	    for (i = 0; i < b; i++) c[cpos+i] = x[i];
    	  }
    	  return 0;
    	}

    	function crypto_stream(c,cpos,d,n,k) {
    	  var s = new Uint8Array(32);
    	  crypto_core_hsalsa20(s,n,k,sigma);
    	  var sn = new Uint8Array(8);
    	  for (var i = 0; i < 8; i++) sn[i] = n[i+16];
    	  return crypto_stream_salsa20(c,cpos,d,sn,s);
    	}

    	function crypto_stream_xor(c,cpos,m,mpos,d,n,k) {
    	  var s = new Uint8Array(32);
    	  crypto_core_hsalsa20(s,n,k,sigma);
    	  var sn = new Uint8Array(8);
    	  for (var i = 0; i < 8; i++) sn[i] = n[i+16];
    	  return crypto_stream_salsa20_xor(c,cpos,m,mpos,d,sn,s);
    	}

    	/*
    	* Port of Andrew Moon's Poly1305-donna-16. Public domain.
    	* https://github.com/floodyberry/poly1305-donna
    	*/

    	var poly1305 = function(key) {
    	  this.buffer = new Uint8Array(16);
    	  this.r = new Uint16Array(10);
    	  this.h = new Uint16Array(10);
    	  this.pad = new Uint16Array(8);
    	  this.leftover = 0;
    	  this.fin = 0;

    	  var t0, t1, t2, t3, t4, t5, t6, t7;

    	  t0 = key[ 0] & 0xff | (key[ 1] & 0xff) << 8; this.r[0] = ( t0                     ) & 0x1fff;
    	  t1 = key[ 2] & 0xff | (key[ 3] & 0xff) << 8; this.r[1] = ((t0 >>> 13) | (t1 <<  3)) & 0x1fff;
    	  t2 = key[ 4] & 0xff | (key[ 5] & 0xff) << 8; this.r[2] = ((t1 >>> 10) | (t2 <<  6)) & 0x1f03;
    	  t3 = key[ 6] & 0xff | (key[ 7] & 0xff) << 8; this.r[3] = ((t2 >>>  7) | (t3 <<  9)) & 0x1fff;
    	  t4 = key[ 8] & 0xff | (key[ 9] & 0xff) << 8; this.r[4] = ((t3 >>>  4) | (t4 << 12)) & 0x00ff;
    	  this.r[5] = ((t4 >>>  1)) & 0x1ffe;
    	  t5 = key[10] & 0xff | (key[11] & 0xff) << 8; this.r[6] = ((t4 >>> 14) | (t5 <<  2)) & 0x1fff;
    	  t6 = key[12] & 0xff | (key[13] & 0xff) << 8; this.r[7] = ((t5 >>> 11) | (t6 <<  5)) & 0x1f81;
    	  t7 = key[14] & 0xff | (key[15] & 0xff) << 8; this.r[8] = ((t6 >>>  8) | (t7 <<  8)) & 0x1fff;
    	  this.r[9] = ((t7 >>>  5)) & 0x007f;

    	  this.pad[0] = key[16] & 0xff | (key[17] & 0xff) << 8;
    	  this.pad[1] = key[18] & 0xff | (key[19] & 0xff) << 8;
    	  this.pad[2] = key[20] & 0xff | (key[21] & 0xff) << 8;
    	  this.pad[3] = key[22] & 0xff | (key[23] & 0xff) << 8;
    	  this.pad[4] = key[24] & 0xff | (key[25] & 0xff) << 8;
    	  this.pad[5] = key[26] & 0xff | (key[27] & 0xff) << 8;
    	  this.pad[6] = key[28] & 0xff | (key[29] & 0xff) << 8;
    	  this.pad[7] = key[30] & 0xff | (key[31] & 0xff) << 8;
    	};

    	poly1305.prototype.blocks = function(m, mpos, bytes) {
    	  var hibit = this.fin ? 0 : (1 << 11);
    	  var t0, t1, t2, t3, t4, t5, t6, t7, c;
    	  var d0, d1, d2, d3, d4, d5, d6, d7, d8, d9;

    	  var h0 = this.h[0],
    	      h1 = this.h[1],
    	      h2 = this.h[2],
    	      h3 = this.h[3],
    	      h4 = this.h[4],
    	      h5 = this.h[5],
    	      h6 = this.h[6],
    	      h7 = this.h[7],
    	      h8 = this.h[8],
    	      h9 = this.h[9];

    	  var r0 = this.r[0],
    	      r1 = this.r[1],
    	      r2 = this.r[2],
    	      r3 = this.r[3],
    	      r4 = this.r[4],
    	      r5 = this.r[5],
    	      r6 = this.r[6],
    	      r7 = this.r[7],
    	      r8 = this.r[8],
    	      r9 = this.r[9];

    	  while (bytes >= 16) {
    	    t0 = m[mpos+ 0] & 0xff | (m[mpos+ 1] & 0xff) << 8; h0 += ( t0                     ) & 0x1fff;
    	    t1 = m[mpos+ 2] & 0xff | (m[mpos+ 3] & 0xff) << 8; h1 += ((t0 >>> 13) | (t1 <<  3)) & 0x1fff;
    	    t2 = m[mpos+ 4] & 0xff | (m[mpos+ 5] & 0xff) << 8; h2 += ((t1 >>> 10) | (t2 <<  6)) & 0x1fff;
    	    t3 = m[mpos+ 6] & 0xff | (m[mpos+ 7] & 0xff) << 8; h3 += ((t2 >>>  7) | (t3 <<  9)) & 0x1fff;
    	    t4 = m[mpos+ 8] & 0xff | (m[mpos+ 9] & 0xff) << 8; h4 += ((t3 >>>  4) | (t4 << 12)) & 0x1fff;
    	    h5 += ((t4 >>>  1)) & 0x1fff;
    	    t5 = m[mpos+10] & 0xff | (m[mpos+11] & 0xff) << 8; h6 += ((t4 >>> 14) | (t5 <<  2)) & 0x1fff;
    	    t6 = m[mpos+12] & 0xff | (m[mpos+13] & 0xff) << 8; h7 += ((t5 >>> 11) | (t6 <<  5)) & 0x1fff;
    	    t7 = m[mpos+14] & 0xff | (m[mpos+15] & 0xff) << 8; h8 += ((t6 >>>  8) | (t7 <<  8)) & 0x1fff;
    	    h9 += ((t7 >>> 5)) | hibit;

    	    c = 0;

    	    d0 = c;
    	    d0 += h0 * r0;
    	    d0 += h1 * (5 * r9);
    	    d0 += h2 * (5 * r8);
    	    d0 += h3 * (5 * r7);
    	    d0 += h4 * (5 * r6);
    	    c = (d0 >>> 13); d0 &= 0x1fff;
    	    d0 += h5 * (5 * r5);
    	    d0 += h6 * (5 * r4);
    	    d0 += h7 * (5 * r3);
    	    d0 += h8 * (5 * r2);
    	    d0 += h9 * (5 * r1);
    	    c += (d0 >>> 13); d0 &= 0x1fff;

    	    d1 = c;
    	    d1 += h0 * r1;
    	    d1 += h1 * r0;
    	    d1 += h2 * (5 * r9);
    	    d1 += h3 * (5 * r8);
    	    d1 += h4 * (5 * r7);
    	    c = (d1 >>> 13); d1 &= 0x1fff;
    	    d1 += h5 * (5 * r6);
    	    d1 += h6 * (5 * r5);
    	    d1 += h7 * (5 * r4);
    	    d1 += h8 * (5 * r3);
    	    d1 += h9 * (5 * r2);
    	    c += (d1 >>> 13); d1 &= 0x1fff;

    	    d2 = c;
    	    d2 += h0 * r2;
    	    d2 += h1 * r1;
    	    d2 += h2 * r0;
    	    d2 += h3 * (5 * r9);
    	    d2 += h4 * (5 * r8);
    	    c = (d2 >>> 13); d2 &= 0x1fff;
    	    d2 += h5 * (5 * r7);
    	    d2 += h6 * (5 * r6);
    	    d2 += h7 * (5 * r5);
    	    d2 += h8 * (5 * r4);
    	    d2 += h9 * (5 * r3);
    	    c += (d2 >>> 13); d2 &= 0x1fff;

    	    d3 = c;
    	    d3 += h0 * r3;
    	    d3 += h1 * r2;
    	    d3 += h2 * r1;
    	    d3 += h3 * r0;
    	    d3 += h4 * (5 * r9);
    	    c = (d3 >>> 13); d3 &= 0x1fff;
    	    d3 += h5 * (5 * r8);
    	    d3 += h6 * (5 * r7);
    	    d3 += h7 * (5 * r6);
    	    d3 += h8 * (5 * r5);
    	    d3 += h9 * (5 * r4);
    	    c += (d3 >>> 13); d3 &= 0x1fff;

    	    d4 = c;
    	    d4 += h0 * r4;
    	    d4 += h1 * r3;
    	    d4 += h2 * r2;
    	    d4 += h3 * r1;
    	    d4 += h4 * r0;
    	    c = (d4 >>> 13); d4 &= 0x1fff;
    	    d4 += h5 * (5 * r9);
    	    d4 += h6 * (5 * r8);
    	    d4 += h7 * (5 * r7);
    	    d4 += h8 * (5 * r6);
    	    d4 += h9 * (5 * r5);
    	    c += (d4 >>> 13); d4 &= 0x1fff;

    	    d5 = c;
    	    d5 += h0 * r5;
    	    d5 += h1 * r4;
    	    d5 += h2 * r3;
    	    d5 += h3 * r2;
    	    d5 += h4 * r1;
    	    c = (d5 >>> 13); d5 &= 0x1fff;
    	    d5 += h5 * r0;
    	    d5 += h6 * (5 * r9);
    	    d5 += h7 * (5 * r8);
    	    d5 += h8 * (5 * r7);
    	    d5 += h9 * (5 * r6);
    	    c += (d5 >>> 13); d5 &= 0x1fff;

    	    d6 = c;
    	    d6 += h0 * r6;
    	    d6 += h1 * r5;
    	    d6 += h2 * r4;
    	    d6 += h3 * r3;
    	    d6 += h4 * r2;
    	    c = (d6 >>> 13); d6 &= 0x1fff;
    	    d6 += h5 * r1;
    	    d6 += h6 * r0;
    	    d6 += h7 * (5 * r9);
    	    d6 += h8 * (5 * r8);
    	    d6 += h9 * (5 * r7);
    	    c += (d6 >>> 13); d6 &= 0x1fff;

    	    d7 = c;
    	    d7 += h0 * r7;
    	    d7 += h1 * r6;
    	    d7 += h2 * r5;
    	    d7 += h3 * r4;
    	    d7 += h4 * r3;
    	    c = (d7 >>> 13); d7 &= 0x1fff;
    	    d7 += h5 * r2;
    	    d7 += h6 * r1;
    	    d7 += h7 * r0;
    	    d7 += h8 * (5 * r9);
    	    d7 += h9 * (5 * r8);
    	    c += (d7 >>> 13); d7 &= 0x1fff;

    	    d8 = c;
    	    d8 += h0 * r8;
    	    d8 += h1 * r7;
    	    d8 += h2 * r6;
    	    d8 += h3 * r5;
    	    d8 += h4 * r4;
    	    c = (d8 >>> 13); d8 &= 0x1fff;
    	    d8 += h5 * r3;
    	    d8 += h6 * r2;
    	    d8 += h7 * r1;
    	    d8 += h8 * r0;
    	    d8 += h9 * (5 * r9);
    	    c += (d8 >>> 13); d8 &= 0x1fff;

    	    d9 = c;
    	    d9 += h0 * r9;
    	    d9 += h1 * r8;
    	    d9 += h2 * r7;
    	    d9 += h3 * r6;
    	    d9 += h4 * r5;
    	    c = (d9 >>> 13); d9 &= 0x1fff;
    	    d9 += h5 * r4;
    	    d9 += h6 * r3;
    	    d9 += h7 * r2;
    	    d9 += h8 * r1;
    	    d9 += h9 * r0;
    	    c += (d9 >>> 13); d9 &= 0x1fff;

    	    c = (((c << 2) + c)) | 0;
    	    c = (c + d0) | 0;
    	    d0 = c & 0x1fff;
    	    c = (c >>> 13);
    	    d1 += c;

    	    h0 = d0;
    	    h1 = d1;
    	    h2 = d2;
    	    h3 = d3;
    	    h4 = d4;
    	    h5 = d5;
    	    h6 = d6;
    	    h7 = d7;
    	    h8 = d8;
    	    h9 = d9;

    	    mpos += 16;
    	    bytes -= 16;
    	  }
    	  this.h[0] = h0;
    	  this.h[1] = h1;
    	  this.h[2] = h2;
    	  this.h[3] = h3;
    	  this.h[4] = h4;
    	  this.h[5] = h5;
    	  this.h[6] = h6;
    	  this.h[7] = h7;
    	  this.h[8] = h8;
    	  this.h[9] = h9;
    	};

    	poly1305.prototype.finish = function(mac, macpos) {
    	  var g = new Uint16Array(10);
    	  var c, mask, f, i;

    	  if (this.leftover) {
    	    i = this.leftover;
    	    this.buffer[i++] = 1;
    	    for (; i < 16; i++) this.buffer[i] = 0;
    	    this.fin = 1;
    	    this.blocks(this.buffer, 0, 16);
    	  }

    	  c = this.h[1] >>> 13;
    	  this.h[1] &= 0x1fff;
    	  for (i = 2; i < 10; i++) {
    	    this.h[i] += c;
    	    c = this.h[i] >>> 13;
    	    this.h[i] &= 0x1fff;
    	  }
    	  this.h[0] += (c * 5);
    	  c = this.h[0] >>> 13;
    	  this.h[0] &= 0x1fff;
    	  this.h[1] += c;
    	  c = this.h[1] >>> 13;
    	  this.h[1] &= 0x1fff;
    	  this.h[2] += c;

    	  g[0] = this.h[0] + 5;
    	  c = g[0] >>> 13;
    	  g[0] &= 0x1fff;
    	  for (i = 1; i < 10; i++) {
    	    g[i] = this.h[i] + c;
    	    c = g[i] >>> 13;
    	    g[i] &= 0x1fff;
    	  }
    	  g[9] -= (1 << 13);

    	  mask = (c ^ 1) - 1;
    	  for (i = 0; i < 10; i++) g[i] &= mask;
    	  mask = ~mask;
    	  for (i = 0; i < 10; i++) this.h[i] = (this.h[i] & mask) | g[i];

    	  this.h[0] = ((this.h[0]       ) | (this.h[1] << 13)                    ) & 0xffff;
    	  this.h[1] = ((this.h[1] >>>  3) | (this.h[2] << 10)                    ) & 0xffff;
    	  this.h[2] = ((this.h[2] >>>  6) | (this.h[3] <<  7)                    ) & 0xffff;
    	  this.h[3] = ((this.h[3] >>>  9) | (this.h[4] <<  4)                    ) & 0xffff;
    	  this.h[4] = ((this.h[4] >>> 12) | (this.h[5] <<  1) | (this.h[6] << 14)) & 0xffff;
    	  this.h[5] = ((this.h[6] >>>  2) | (this.h[7] << 11)                    ) & 0xffff;
    	  this.h[6] = ((this.h[7] >>>  5) | (this.h[8] <<  8)                    ) & 0xffff;
    	  this.h[7] = ((this.h[8] >>>  8) | (this.h[9] <<  5)                    ) & 0xffff;

    	  f = this.h[0] + this.pad[0];
    	  this.h[0] = f & 0xffff;
    	  for (i = 1; i < 8; i++) {
    	    f = (((this.h[i] + this.pad[i]) | 0) + (f >>> 16)) | 0;
    	    this.h[i] = f & 0xffff;
    	  }

    	  mac[macpos+ 0] = (this.h[0] >>> 0) & 0xff;
    	  mac[macpos+ 1] = (this.h[0] >>> 8) & 0xff;
    	  mac[macpos+ 2] = (this.h[1] >>> 0) & 0xff;
    	  mac[macpos+ 3] = (this.h[1] >>> 8) & 0xff;
    	  mac[macpos+ 4] = (this.h[2] >>> 0) & 0xff;
    	  mac[macpos+ 5] = (this.h[2] >>> 8) & 0xff;
    	  mac[macpos+ 6] = (this.h[3] >>> 0) & 0xff;
    	  mac[macpos+ 7] = (this.h[3] >>> 8) & 0xff;
    	  mac[macpos+ 8] = (this.h[4] >>> 0) & 0xff;
    	  mac[macpos+ 9] = (this.h[4] >>> 8) & 0xff;
    	  mac[macpos+10] = (this.h[5] >>> 0) & 0xff;
    	  mac[macpos+11] = (this.h[5] >>> 8) & 0xff;
    	  mac[macpos+12] = (this.h[6] >>> 0) & 0xff;
    	  mac[macpos+13] = (this.h[6] >>> 8) & 0xff;
    	  mac[macpos+14] = (this.h[7] >>> 0) & 0xff;
    	  mac[macpos+15] = (this.h[7] >>> 8) & 0xff;
    	};

    	poly1305.prototype.update = function(m, mpos, bytes) {
    	  var i, want;

    	  if (this.leftover) {
    	    want = (16 - this.leftover);
    	    if (want > bytes)
    	      want = bytes;
    	    for (i = 0; i < want; i++)
    	      this.buffer[this.leftover + i] = m[mpos+i];
    	    bytes -= want;
    	    mpos += want;
    	    this.leftover += want;
    	    if (this.leftover < 16)
    	      return;
    	    this.blocks(this.buffer, 0, 16);
    	    this.leftover = 0;
    	  }

    	  if (bytes >= 16) {
    	    want = bytes - (bytes % 16);
    	    this.blocks(m, mpos, want);
    	    mpos += want;
    	    bytes -= want;
    	  }

    	  if (bytes) {
    	    for (i = 0; i < bytes; i++)
    	      this.buffer[this.leftover + i] = m[mpos+i];
    	    this.leftover += bytes;
    	  }
    	};

    	function crypto_onetimeauth(out, outpos, m, mpos, n, k) {
    	  var s = new poly1305(k);
    	  s.update(m, mpos, n);
    	  s.finish(out, outpos);
    	  return 0;
    	}

    	function crypto_onetimeauth_verify(h, hpos, m, mpos, n, k) {
    	  var x = new Uint8Array(16);
    	  crypto_onetimeauth(x,0,m,mpos,n,k);
    	  return crypto_verify_16(h,hpos,x,0);
    	}

    	function crypto_secretbox(c,m,d,n,k) {
    	  var i;
    	  if (d < 32) return -1;
    	  crypto_stream_xor(c,0,m,0,d,n,k);
    	  crypto_onetimeauth(c, 16, c, 32, d - 32, c);
    	  for (i = 0; i < 16; i++) c[i] = 0;
    	  return 0;
    	}

    	function crypto_secretbox_open(m,c,d,n,k) {
    	  var i;
    	  var x = new Uint8Array(32);
    	  if (d < 32) return -1;
    	  crypto_stream(x,0,32,n,k);
    	  if (crypto_onetimeauth_verify(c, 16,c, 32,d - 32,x) !== 0) return -1;
    	  crypto_stream_xor(m,0,c,0,d,n,k);
    	  for (i = 0; i < 32; i++) m[i] = 0;
    	  return 0;
    	}

    	function set25519(r, a) {
    	  var i;
    	  for (i = 0; i < 16; i++) r[i] = a[i]|0;
    	}

    	function car25519(o) {
    	  var i, v, c = 1;
    	  for (i = 0; i < 16; i++) {
    	    v = o[i] + c + 65535;
    	    c = Math.floor(v / 65536);
    	    o[i] = v - c * 65536;
    	  }
    	  o[0] += c-1 + 37 * (c-1);
    	}

    	function sel25519(p, q, b) {
    	  var t, c = ~(b-1);
    	  for (var i = 0; i < 16; i++) {
    	    t = c & (p[i] ^ q[i]);
    	    p[i] ^= t;
    	    q[i] ^= t;
    	  }
    	}

    	function pack25519(o, n) {
    	  var i, j, b;
    	  var m = gf(), t = gf();
    	  for (i = 0; i < 16; i++) t[i] = n[i];
    	  car25519(t);
    	  car25519(t);
    	  car25519(t);
    	  for (j = 0; j < 2; j++) {
    	    m[0] = t[0] - 0xffed;
    	    for (i = 1; i < 15; i++) {
    	      m[i] = t[i] - 0xffff - ((m[i-1]>>16) & 1);
    	      m[i-1] &= 0xffff;
    	    }
    	    m[15] = t[15] - 0x7fff - ((m[14]>>16) & 1);
    	    b = (m[15]>>16) & 1;
    	    m[14] &= 0xffff;
    	    sel25519(t, m, 1-b);
    	  }
    	  for (i = 0; i < 16; i++) {
    	    o[2*i] = t[i] & 0xff;
    	    o[2*i+1] = t[i]>>8;
    	  }
    	}

    	function neq25519(a, b) {
    	  var c = new Uint8Array(32), d = new Uint8Array(32);
    	  pack25519(c, a);
    	  pack25519(d, b);
    	  return crypto_verify_32(c, 0, d, 0);
    	}

    	function par25519(a) {
    	  var d = new Uint8Array(32);
    	  pack25519(d, a);
    	  return d[0] & 1;
    	}

    	function unpack25519(o, n) {
    	  var i;
    	  for (i = 0; i < 16; i++) o[i] = n[2*i] + (n[2*i+1] << 8);
    	  o[15] &= 0x7fff;
    	}

    	function A(o, a, b) {
    	  for (var i = 0; i < 16; i++) o[i] = a[i] + b[i];
    	}

    	function Z(o, a, b) {
    	  for (var i = 0; i < 16; i++) o[i] = a[i] - b[i];
    	}

    	function M(o, a, b) {
    	  var v, c,
    	     t0 = 0,  t1 = 0,  t2 = 0,  t3 = 0,  t4 = 0,  t5 = 0,  t6 = 0,  t7 = 0,
    	     t8 = 0,  t9 = 0, t10 = 0, t11 = 0, t12 = 0, t13 = 0, t14 = 0, t15 = 0,
    	    t16 = 0, t17 = 0, t18 = 0, t19 = 0, t20 = 0, t21 = 0, t22 = 0, t23 = 0,
    	    t24 = 0, t25 = 0, t26 = 0, t27 = 0, t28 = 0, t29 = 0, t30 = 0,
    	    b0 = b[0],
    	    b1 = b[1],
    	    b2 = b[2],
    	    b3 = b[3],
    	    b4 = b[4],
    	    b5 = b[5],
    	    b6 = b[6],
    	    b7 = b[7],
    	    b8 = b[8],
    	    b9 = b[9],
    	    b10 = b[10],
    	    b11 = b[11],
    	    b12 = b[12],
    	    b13 = b[13],
    	    b14 = b[14],
    	    b15 = b[15];

    	  v = a[0];
    	  t0 += v * b0;
    	  t1 += v * b1;
    	  t2 += v * b2;
    	  t3 += v * b3;
    	  t4 += v * b4;
    	  t5 += v * b5;
    	  t6 += v * b6;
    	  t7 += v * b7;
    	  t8 += v * b8;
    	  t9 += v * b9;
    	  t10 += v * b10;
    	  t11 += v * b11;
    	  t12 += v * b12;
    	  t13 += v * b13;
    	  t14 += v * b14;
    	  t15 += v * b15;
    	  v = a[1];
    	  t1 += v * b0;
    	  t2 += v * b1;
    	  t3 += v * b2;
    	  t4 += v * b3;
    	  t5 += v * b4;
    	  t6 += v * b5;
    	  t7 += v * b6;
    	  t8 += v * b7;
    	  t9 += v * b8;
    	  t10 += v * b9;
    	  t11 += v * b10;
    	  t12 += v * b11;
    	  t13 += v * b12;
    	  t14 += v * b13;
    	  t15 += v * b14;
    	  t16 += v * b15;
    	  v = a[2];
    	  t2 += v * b0;
    	  t3 += v * b1;
    	  t4 += v * b2;
    	  t5 += v * b3;
    	  t6 += v * b4;
    	  t7 += v * b5;
    	  t8 += v * b6;
    	  t9 += v * b7;
    	  t10 += v * b8;
    	  t11 += v * b9;
    	  t12 += v * b10;
    	  t13 += v * b11;
    	  t14 += v * b12;
    	  t15 += v * b13;
    	  t16 += v * b14;
    	  t17 += v * b15;
    	  v = a[3];
    	  t3 += v * b0;
    	  t4 += v * b1;
    	  t5 += v * b2;
    	  t6 += v * b3;
    	  t7 += v * b4;
    	  t8 += v * b5;
    	  t9 += v * b6;
    	  t10 += v * b7;
    	  t11 += v * b8;
    	  t12 += v * b9;
    	  t13 += v * b10;
    	  t14 += v * b11;
    	  t15 += v * b12;
    	  t16 += v * b13;
    	  t17 += v * b14;
    	  t18 += v * b15;
    	  v = a[4];
    	  t4 += v * b0;
    	  t5 += v * b1;
    	  t6 += v * b2;
    	  t7 += v * b3;
    	  t8 += v * b4;
    	  t9 += v * b5;
    	  t10 += v * b6;
    	  t11 += v * b7;
    	  t12 += v * b8;
    	  t13 += v * b9;
    	  t14 += v * b10;
    	  t15 += v * b11;
    	  t16 += v * b12;
    	  t17 += v * b13;
    	  t18 += v * b14;
    	  t19 += v * b15;
    	  v = a[5];
    	  t5 += v * b0;
    	  t6 += v * b1;
    	  t7 += v * b2;
    	  t8 += v * b3;
    	  t9 += v * b4;
    	  t10 += v * b5;
    	  t11 += v * b6;
    	  t12 += v * b7;
    	  t13 += v * b8;
    	  t14 += v * b9;
    	  t15 += v * b10;
    	  t16 += v * b11;
    	  t17 += v * b12;
    	  t18 += v * b13;
    	  t19 += v * b14;
    	  t20 += v * b15;
    	  v = a[6];
    	  t6 += v * b0;
    	  t7 += v * b1;
    	  t8 += v * b2;
    	  t9 += v * b3;
    	  t10 += v * b4;
    	  t11 += v * b5;
    	  t12 += v * b6;
    	  t13 += v * b7;
    	  t14 += v * b8;
    	  t15 += v * b9;
    	  t16 += v * b10;
    	  t17 += v * b11;
    	  t18 += v * b12;
    	  t19 += v * b13;
    	  t20 += v * b14;
    	  t21 += v * b15;
    	  v = a[7];
    	  t7 += v * b0;
    	  t8 += v * b1;
    	  t9 += v * b2;
    	  t10 += v * b3;
    	  t11 += v * b4;
    	  t12 += v * b5;
    	  t13 += v * b6;
    	  t14 += v * b7;
    	  t15 += v * b8;
    	  t16 += v * b9;
    	  t17 += v * b10;
    	  t18 += v * b11;
    	  t19 += v * b12;
    	  t20 += v * b13;
    	  t21 += v * b14;
    	  t22 += v * b15;
    	  v = a[8];
    	  t8 += v * b0;
    	  t9 += v * b1;
    	  t10 += v * b2;
    	  t11 += v * b3;
    	  t12 += v * b4;
    	  t13 += v * b5;
    	  t14 += v * b6;
    	  t15 += v * b7;
    	  t16 += v * b8;
    	  t17 += v * b9;
    	  t18 += v * b10;
    	  t19 += v * b11;
    	  t20 += v * b12;
    	  t21 += v * b13;
    	  t22 += v * b14;
    	  t23 += v * b15;
    	  v = a[9];
    	  t9 += v * b0;
    	  t10 += v * b1;
    	  t11 += v * b2;
    	  t12 += v * b3;
    	  t13 += v * b4;
    	  t14 += v * b5;
    	  t15 += v * b6;
    	  t16 += v * b7;
    	  t17 += v * b8;
    	  t18 += v * b9;
    	  t19 += v * b10;
    	  t20 += v * b11;
    	  t21 += v * b12;
    	  t22 += v * b13;
    	  t23 += v * b14;
    	  t24 += v * b15;
    	  v = a[10];
    	  t10 += v * b0;
    	  t11 += v * b1;
    	  t12 += v * b2;
    	  t13 += v * b3;
    	  t14 += v * b4;
    	  t15 += v * b5;
    	  t16 += v * b6;
    	  t17 += v * b7;
    	  t18 += v * b8;
    	  t19 += v * b9;
    	  t20 += v * b10;
    	  t21 += v * b11;
    	  t22 += v * b12;
    	  t23 += v * b13;
    	  t24 += v * b14;
    	  t25 += v * b15;
    	  v = a[11];
    	  t11 += v * b0;
    	  t12 += v * b1;
    	  t13 += v * b2;
    	  t14 += v * b3;
    	  t15 += v * b4;
    	  t16 += v * b5;
    	  t17 += v * b6;
    	  t18 += v * b7;
    	  t19 += v * b8;
    	  t20 += v * b9;
    	  t21 += v * b10;
    	  t22 += v * b11;
    	  t23 += v * b12;
    	  t24 += v * b13;
    	  t25 += v * b14;
    	  t26 += v * b15;
    	  v = a[12];
    	  t12 += v * b0;
    	  t13 += v * b1;
    	  t14 += v * b2;
    	  t15 += v * b3;
    	  t16 += v * b4;
    	  t17 += v * b5;
    	  t18 += v * b6;
    	  t19 += v * b7;
    	  t20 += v * b8;
    	  t21 += v * b9;
    	  t22 += v * b10;
    	  t23 += v * b11;
    	  t24 += v * b12;
    	  t25 += v * b13;
    	  t26 += v * b14;
    	  t27 += v * b15;
    	  v = a[13];
    	  t13 += v * b0;
    	  t14 += v * b1;
    	  t15 += v * b2;
    	  t16 += v * b3;
    	  t17 += v * b4;
    	  t18 += v * b5;
    	  t19 += v * b6;
    	  t20 += v * b7;
    	  t21 += v * b8;
    	  t22 += v * b9;
    	  t23 += v * b10;
    	  t24 += v * b11;
    	  t25 += v * b12;
    	  t26 += v * b13;
    	  t27 += v * b14;
    	  t28 += v * b15;
    	  v = a[14];
    	  t14 += v * b0;
    	  t15 += v * b1;
    	  t16 += v * b2;
    	  t17 += v * b3;
    	  t18 += v * b4;
    	  t19 += v * b5;
    	  t20 += v * b6;
    	  t21 += v * b7;
    	  t22 += v * b8;
    	  t23 += v * b9;
    	  t24 += v * b10;
    	  t25 += v * b11;
    	  t26 += v * b12;
    	  t27 += v * b13;
    	  t28 += v * b14;
    	  t29 += v * b15;
    	  v = a[15];
    	  t15 += v * b0;
    	  t16 += v * b1;
    	  t17 += v * b2;
    	  t18 += v * b3;
    	  t19 += v * b4;
    	  t20 += v * b5;
    	  t21 += v * b6;
    	  t22 += v * b7;
    	  t23 += v * b8;
    	  t24 += v * b9;
    	  t25 += v * b10;
    	  t26 += v * b11;
    	  t27 += v * b12;
    	  t28 += v * b13;
    	  t29 += v * b14;
    	  t30 += v * b15;

    	  t0  += 38 * t16;
    	  t1  += 38 * t17;
    	  t2  += 38 * t18;
    	  t3  += 38 * t19;
    	  t4  += 38 * t20;
    	  t5  += 38 * t21;
    	  t6  += 38 * t22;
    	  t7  += 38 * t23;
    	  t8  += 38 * t24;
    	  t9  += 38 * t25;
    	  t10 += 38 * t26;
    	  t11 += 38 * t27;
    	  t12 += 38 * t28;
    	  t13 += 38 * t29;
    	  t14 += 38 * t30;
    	  // t15 left as is

    	  // first car
    	  c = 1;
    	  v =  t0 + c + 65535; c = Math.floor(v / 65536);  t0 = v - c * 65536;
    	  v =  t1 + c + 65535; c = Math.floor(v / 65536);  t1 = v - c * 65536;
    	  v =  t2 + c + 65535; c = Math.floor(v / 65536);  t2 = v - c * 65536;
    	  v =  t3 + c + 65535; c = Math.floor(v / 65536);  t3 = v - c * 65536;
    	  v =  t4 + c + 65535; c = Math.floor(v / 65536);  t4 = v - c * 65536;
    	  v =  t5 + c + 65535; c = Math.floor(v / 65536);  t5 = v - c * 65536;
    	  v =  t6 + c + 65535; c = Math.floor(v / 65536);  t6 = v - c * 65536;
    	  v =  t7 + c + 65535; c = Math.floor(v / 65536);  t7 = v - c * 65536;
    	  v =  t8 + c + 65535; c = Math.floor(v / 65536);  t8 = v - c * 65536;
    	  v =  t9 + c + 65535; c = Math.floor(v / 65536);  t9 = v - c * 65536;
    	  v = t10 + c + 65535; c = Math.floor(v / 65536); t10 = v - c * 65536;
    	  v = t11 + c + 65535; c = Math.floor(v / 65536); t11 = v - c * 65536;
    	  v = t12 + c + 65535; c = Math.floor(v / 65536); t12 = v - c * 65536;
    	  v = t13 + c + 65535; c = Math.floor(v / 65536); t13 = v - c * 65536;
    	  v = t14 + c + 65535; c = Math.floor(v / 65536); t14 = v - c * 65536;
    	  v = t15 + c + 65535; c = Math.floor(v / 65536); t15 = v - c * 65536;
    	  t0 += c-1 + 37 * (c-1);

    	  // second car
    	  c = 1;
    	  v =  t0 + c + 65535; c = Math.floor(v / 65536);  t0 = v - c * 65536;
    	  v =  t1 + c + 65535; c = Math.floor(v / 65536);  t1 = v - c * 65536;
    	  v =  t2 + c + 65535; c = Math.floor(v / 65536);  t2 = v - c * 65536;
    	  v =  t3 + c + 65535; c = Math.floor(v / 65536);  t3 = v - c * 65536;
    	  v =  t4 + c + 65535; c = Math.floor(v / 65536);  t4 = v - c * 65536;
    	  v =  t5 + c + 65535; c = Math.floor(v / 65536);  t5 = v - c * 65536;
    	  v =  t6 + c + 65535; c = Math.floor(v / 65536);  t6 = v - c * 65536;
    	  v =  t7 + c + 65535; c = Math.floor(v / 65536);  t7 = v - c * 65536;
    	  v =  t8 + c + 65535; c = Math.floor(v / 65536);  t8 = v - c * 65536;
    	  v =  t9 + c + 65535; c = Math.floor(v / 65536);  t9 = v - c * 65536;
    	  v = t10 + c + 65535; c = Math.floor(v / 65536); t10 = v - c * 65536;
    	  v = t11 + c + 65535; c = Math.floor(v / 65536); t11 = v - c * 65536;
    	  v = t12 + c + 65535; c = Math.floor(v / 65536); t12 = v - c * 65536;
    	  v = t13 + c + 65535; c = Math.floor(v / 65536); t13 = v - c * 65536;
    	  v = t14 + c + 65535; c = Math.floor(v / 65536); t14 = v - c * 65536;
    	  v = t15 + c + 65535; c = Math.floor(v / 65536); t15 = v - c * 65536;
    	  t0 += c-1 + 37 * (c-1);

    	  o[ 0] = t0;
    	  o[ 1] = t1;
    	  o[ 2] = t2;
    	  o[ 3] = t3;
    	  o[ 4] = t4;
    	  o[ 5] = t5;
    	  o[ 6] = t6;
    	  o[ 7] = t7;
    	  o[ 8] = t8;
    	  o[ 9] = t9;
    	  o[10] = t10;
    	  o[11] = t11;
    	  o[12] = t12;
    	  o[13] = t13;
    	  o[14] = t14;
    	  o[15] = t15;
    	}

    	function S(o, a) {
    	  M(o, a, a);
    	}

    	function inv25519(o, i) {
    	  var c = gf();
    	  var a;
    	  for (a = 0; a < 16; a++) c[a] = i[a];
    	  for (a = 253; a >= 0; a--) {
    	    S(c, c);
    	    if(a !== 2 && a !== 4) M(c, c, i);
    	  }
    	  for (a = 0; a < 16; a++) o[a] = c[a];
    	}

    	function pow2523(o, i) {
    	  var c = gf();
    	  var a;
    	  for (a = 0; a < 16; a++) c[a] = i[a];
    	  for (a = 250; a >= 0; a--) {
    	      S(c, c);
    	      if(a !== 1) M(c, c, i);
    	  }
    	  for (a = 0; a < 16; a++) o[a] = c[a];
    	}

    	function crypto_scalarmult(q, n, p) {
    	  var z = new Uint8Array(32);
    	  var x = new Float64Array(80), r, i;
    	  var a = gf(), b = gf(), c = gf(),
    	      d = gf(), e = gf(), f = gf();
    	  for (i = 0; i < 31; i++) z[i] = n[i];
    	  z[31]=(n[31]&127)|64;
    	  z[0]&=248;
    	  unpack25519(x,p);
    	  for (i = 0; i < 16; i++) {
    	    b[i]=x[i];
    	    d[i]=a[i]=c[i]=0;
    	  }
    	  a[0]=d[0]=1;
    	  for (i=254; i>=0; --i) {
    	    r=(z[i>>>3]>>>(i&7))&1;
    	    sel25519(a,b,r);
    	    sel25519(c,d,r);
    	    A(e,a,c);
    	    Z(a,a,c);
    	    A(c,b,d);
    	    Z(b,b,d);
    	    S(d,e);
    	    S(f,a);
    	    M(a,c,a);
    	    M(c,b,e);
    	    A(e,a,c);
    	    Z(a,a,c);
    	    S(b,a);
    	    Z(c,d,f);
    	    M(a,c,_121665);
    	    A(a,a,d);
    	    M(c,c,a);
    	    M(a,d,f);
    	    M(d,b,x);
    	    S(b,e);
    	    sel25519(a,b,r);
    	    sel25519(c,d,r);
    	  }
    	  for (i = 0; i < 16; i++) {
    	    x[i+16]=a[i];
    	    x[i+32]=c[i];
    	    x[i+48]=b[i];
    	    x[i+64]=d[i];
    	  }
    	  var x32 = x.subarray(32);
    	  var x16 = x.subarray(16);
    	  inv25519(x32,x32);
    	  M(x16,x16,x32);
    	  pack25519(q,x16);
    	  return 0;
    	}

    	function crypto_scalarmult_base(q, n) {
    	  return crypto_scalarmult(q, n, _9);
    	}

    	function crypto_box_keypair(y, x) {
    	  randombytes(x, 32);
    	  return crypto_scalarmult_base(y, x);
    	}

    	function crypto_box_beforenm(k, y, x) {
    	  var s = new Uint8Array(32);
    	  crypto_scalarmult(s, x, y);
    	  return crypto_core_hsalsa20(k, _0, s, sigma);
    	}

    	var crypto_box_afternm = crypto_secretbox;
    	var crypto_box_open_afternm = crypto_secretbox_open;

    	function crypto_box(c, m, d, n, y, x) {
    	  var k = new Uint8Array(32);
    	  crypto_box_beforenm(k, y, x);
    	  return crypto_box_afternm(c, m, d, n, k);
    	}

    	function crypto_box_open(m, c, d, n, y, x) {
    	  var k = new Uint8Array(32);
    	  crypto_box_beforenm(k, y, x);
    	  return crypto_box_open_afternm(m, c, d, n, k);
    	}

    	var K = [
    	  0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd,
    	  0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc,
    	  0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019,
    	  0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118,
    	  0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe,
    	  0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2,
    	  0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1,
    	  0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694,
    	  0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3,
    	  0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65,
    	  0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483,
    	  0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5,
    	  0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210,
    	  0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4,
    	  0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725,
    	  0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70,
    	  0x27b70a85, 0x46d22ffc, 0x2e1b2138, 0x5c26c926,
    	  0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df,
    	  0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8,
    	  0x81c2c92e, 0x47edaee6, 0x92722c85, 0x1482353b,
    	  0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001,
    	  0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30,
    	  0xd192e819, 0xd6ef5218, 0xd6990624, 0x5565a910,
    	  0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8,
    	  0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53,
    	  0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8,
    	  0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb,
    	  0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3,
    	  0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60,
    	  0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec,
    	  0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9,
    	  0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b,
    	  0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207,
    	  0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178,
    	  0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6,
    	  0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b,
    	  0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493,
    	  0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c,
    	  0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a,
    	  0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817
    	];

    	function crypto_hashblocks_hl(hh, hl, m, n) {
    	  var wh = new Int32Array(16), wl = new Int32Array(16),
    	      bh0, bh1, bh2, bh3, bh4, bh5, bh6, bh7,
    	      bl0, bl1, bl2, bl3, bl4, bl5, bl6, bl7,
    	      th, tl, i, j, h, l, a, b, c, d;

    	  var ah0 = hh[0],
    	      ah1 = hh[1],
    	      ah2 = hh[2],
    	      ah3 = hh[3],
    	      ah4 = hh[4],
    	      ah5 = hh[5],
    	      ah6 = hh[6],
    	      ah7 = hh[7],

    	      al0 = hl[0],
    	      al1 = hl[1],
    	      al2 = hl[2],
    	      al3 = hl[3],
    	      al4 = hl[4],
    	      al5 = hl[5],
    	      al6 = hl[6],
    	      al7 = hl[7];

    	  var pos = 0;
    	  while (n >= 128) {
    	    for (i = 0; i < 16; i++) {
    	      j = 8 * i + pos;
    	      wh[i] = (m[j+0] << 24) | (m[j+1] << 16) | (m[j+2] << 8) | m[j+3];
    	      wl[i] = (m[j+4] << 24) | (m[j+5] << 16) | (m[j+6] << 8) | m[j+7];
    	    }
    	    for (i = 0; i < 80; i++) {
    	      bh0 = ah0;
    	      bh1 = ah1;
    	      bh2 = ah2;
    	      bh3 = ah3;
    	      bh4 = ah4;
    	      bh5 = ah5;
    	      bh6 = ah6;
    	      bh7 = ah7;

    	      bl0 = al0;
    	      bl1 = al1;
    	      bl2 = al2;
    	      bl3 = al3;
    	      bl4 = al4;
    	      bl5 = al5;
    	      bl6 = al6;
    	      bl7 = al7;

    	      // add
    	      h = ah7;
    	      l = al7;

    	      a = l & 0xffff; b = l >>> 16;
    	      c = h & 0xffff; d = h >>> 16;

    	      // Sigma1
    	      h = ((ah4 >>> 14) | (al4 << (32-14))) ^ ((ah4 >>> 18) | (al4 << (32-18))) ^ ((al4 >>> (41-32)) | (ah4 << (32-(41-32))));
    	      l = ((al4 >>> 14) | (ah4 << (32-14))) ^ ((al4 >>> 18) | (ah4 << (32-18))) ^ ((ah4 >>> (41-32)) | (al4 << (32-(41-32))));

    	      a += l & 0xffff; b += l >>> 16;
    	      c += h & 0xffff; d += h >>> 16;

    	      // Ch
    	      h = (ah4 & ah5) ^ (~ah4 & ah6);
    	      l = (al4 & al5) ^ (~al4 & al6);

    	      a += l & 0xffff; b += l >>> 16;
    	      c += h & 0xffff; d += h >>> 16;

    	      // K
    	      h = K[i*2];
    	      l = K[i*2+1];

    	      a += l & 0xffff; b += l >>> 16;
    	      c += h & 0xffff; d += h >>> 16;

    	      // w
    	      h = wh[i%16];
    	      l = wl[i%16];

    	      a += l & 0xffff; b += l >>> 16;
    	      c += h & 0xffff; d += h >>> 16;

    	      b += a >>> 16;
    	      c += b >>> 16;
    	      d += c >>> 16;

    	      th = c & 0xffff | d << 16;
    	      tl = a & 0xffff | b << 16;

    	      // add
    	      h = th;
    	      l = tl;

    	      a = l & 0xffff; b = l >>> 16;
    	      c = h & 0xffff; d = h >>> 16;

    	      // Sigma0
    	      h = ((ah0 >>> 28) | (al0 << (32-28))) ^ ((al0 >>> (34-32)) | (ah0 << (32-(34-32)))) ^ ((al0 >>> (39-32)) | (ah0 << (32-(39-32))));
    	      l = ((al0 >>> 28) | (ah0 << (32-28))) ^ ((ah0 >>> (34-32)) | (al0 << (32-(34-32)))) ^ ((ah0 >>> (39-32)) | (al0 << (32-(39-32))));

    	      a += l & 0xffff; b += l >>> 16;
    	      c += h & 0xffff; d += h >>> 16;

    	      // Maj
    	      h = (ah0 & ah1) ^ (ah0 & ah2) ^ (ah1 & ah2);
    	      l = (al0 & al1) ^ (al0 & al2) ^ (al1 & al2);

    	      a += l & 0xffff; b += l >>> 16;
    	      c += h & 0xffff; d += h >>> 16;

    	      b += a >>> 16;
    	      c += b >>> 16;
    	      d += c >>> 16;

    	      bh7 = (c & 0xffff) | (d << 16);
    	      bl7 = (a & 0xffff) | (b << 16);

    	      // add
    	      h = bh3;
    	      l = bl3;

    	      a = l & 0xffff; b = l >>> 16;
    	      c = h & 0xffff; d = h >>> 16;

    	      h = th;
    	      l = tl;

    	      a += l & 0xffff; b += l >>> 16;
    	      c += h & 0xffff; d += h >>> 16;

    	      b += a >>> 16;
    	      c += b >>> 16;
    	      d += c >>> 16;

    	      bh3 = (c & 0xffff) | (d << 16);
    	      bl3 = (a & 0xffff) | (b << 16);

    	      ah1 = bh0;
    	      ah2 = bh1;
    	      ah3 = bh2;
    	      ah4 = bh3;
    	      ah5 = bh4;
    	      ah6 = bh5;
    	      ah7 = bh6;
    	      ah0 = bh7;

    	      al1 = bl0;
    	      al2 = bl1;
    	      al3 = bl2;
    	      al4 = bl3;
    	      al5 = bl4;
    	      al6 = bl5;
    	      al7 = bl6;
    	      al0 = bl7;

    	      if (i%16 === 15) {
    	        for (j = 0; j < 16; j++) {
    	          // add
    	          h = wh[j];
    	          l = wl[j];

    	          a = l & 0xffff; b = l >>> 16;
    	          c = h & 0xffff; d = h >>> 16;

    	          h = wh[(j+9)%16];
    	          l = wl[(j+9)%16];

    	          a += l & 0xffff; b += l >>> 16;
    	          c += h & 0xffff; d += h >>> 16;

    	          // sigma0
    	          th = wh[(j+1)%16];
    	          tl = wl[(j+1)%16];
    	          h = ((th >>> 1) | (tl << (32-1))) ^ ((th >>> 8) | (tl << (32-8))) ^ (th >>> 7);
    	          l = ((tl >>> 1) | (th << (32-1))) ^ ((tl >>> 8) | (th << (32-8))) ^ ((tl >>> 7) | (th << (32-7)));

    	          a += l & 0xffff; b += l >>> 16;
    	          c += h & 0xffff; d += h >>> 16;

    	          // sigma1
    	          th = wh[(j+14)%16];
    	          tl = wl[(j+14)%16];
    	          h = ((th >>> 19) | (tl << (32-19))) ^ ((tl >>> (61-32)) | (th << (32-(61-32)))) ^ (th >>> 6);
    	          l = ((tl >>> 19) | (th << (32-19))) ^ ((th >>> (61-32)) | (tl << (32-(61-32)))) ^ ((tl >>> 6) | (th << (32-6)));

    	          a += l & 0xffff; b += l >>> 16;
    	          c += h & 0xffff; d += h >>> 16;

    	          b += a >>> 16;
    	          c += b >>> 16;
    	          d += c >>> 16;

    	          wh[j] = (c & 0xffff) | (d << 16);
    	          wl[j] = (a & 0xffff) | (b << 16);
    	        }
    	      }
    	    }

    	    // add
    	    h = ah0;
    	    l = al0;

    	    a = l & 0xffff; b = l >>> 16;
    	    c = h & 0xffff; d = h >>> 16;

    	    h = hh[0];
    	    l = hl[0];

    	    a += l & 0xffff; b += l >>> 16;
    	    c += h & 0xffff; d += h >>> 16;

    	    b += a >>> 16;
    	    c += b >>> 16;
    	    d += c >>> 16;

    	    hh[0] = ah0 = (c & 0xffff) | (d << 16);
    	    hl[0] = al0 = (a & 0xffff) | (b << 16);

    	    h = ah1;
    	    l = al1;

    	    a = l & 0xffff; b = l >>> 16;
    	    c = h & 0xffff; d = h >>> 16;

    	    h = hh[1];
    	    l = hl[1];

    	    a += l & 0xffff; b += l >>> 16;
    	    c += h & 0xffff; d += h >>> 16;

    	    b += a >>> 16;
    	    c += b >>> 16;
    	    d += c >>> 16;

    	    hh[1] = ah1 = (c & 0xffff) | (d << 16);
    	    hl[1] = al1 = (a & 0xffff) | (b << 16);

    	    h = ah2;
    	    l = al2;

    	    a = l & 0xffff; b = l >>> 16;
    	    c = h & 0xffff; d = h >>> 16;

    	    h = hh[2];
    	    l = hl[2];

    	    a += l & 0xffff; b += l >>> 16;
    	    c += h & 0xffff; d += h >>> 16;

    	    b += a >>> 16;
    	    c += b >>> 16;
    	    d += c >>> 16;

    	    hh[2] = ah2 = (c & 0xffff) | (d << 16);
    	    hl[2] = al2 = (a & 0xffff) | (b << 16);

    	    h = ah3;
    	    l = al3;

    	    a = l & 0xffff; b = l >>> 16;
    	    c = h & 0xffff; d = h >>> 16;

    	    h = hh[3];
    	    l = hl[3];

    	    a += l & 0xffff; b += l >>> 16;
    	    c += h & 0xffff; d += h >>> 16;

    	    b += a >>> 16;
    	    c += b >>> 16;
    	    d += c >>> 16;

    	    hh[3] = ah3 = (c & 0xffff) | (d << 16);
    	    hl[3] = al3 = (a & 0xffff) | (b << 16);

    	    h = ah4;
    	    l = al4;

    	    a = l & 0xffff; b = l >>> 16;
    	    c = h & 0xffff; d = h >>> 16;

    	    h = hh[4];
    	    l = hl[4];

    	    a += l & 0xffff; b += l >>> 16;
    	    c += h & 0xffff; d += h >>> 16;

    	    b += a >>> 16;
    	    c += b >>> 16;
    	    d += c >>> 16;

    	    hh[4] = ah4 = (c & 0xffff) | (d << 16);
    	    hl[4] = al4 = (a & 0xffff) | (b << 16);

    	    h = ah5;
    	    l = al5;

    	    a = l & 0xffff; b = l >>> 16;
    	    c = h & 0xffff; d = h >>> 16;

    	    h = hh[5];
    	    l = hl[5];

    	    a += l & 0xffff; b += l >>> 16;
    	    c += h & 0xffff; d += h >>> 16;

    	    b += a >>> 16;
    	    c += b >>> 16;
    	    d += c >>> 16;

    	    hh[5] = ah5 = (c & 0xffff) | (d << 16);
    	    hl[5] = al5 = (a & 0xffff) | (b << 16);

    	    h = ah6;
    	    l = al6;

    	    a = l & 0xffff; b = l >>> 16;
    	    c = h & 0xffff; d = h >>> 16;

    	    h = hh[6];
    	    l = hl[6];

    	    a += l & 0xffff; b += l >>> 16;
    	    c += h & 0xffff; d += h >>> 16;

    	    b += a >>> 16;
    	    c += b >>> 16;
    	    d += c >>> 16;

    	    hh[6] = ah6 = (c & 0xffff) | (d << 16);
    	    hl[6] = al6 = (a & 0xffff) | (b << 16);

    	    h = ah7;
    	    l = al7;

    	    a = l & 0xffff; b = l >>> 16;
    	    c = h & 0xffff; d = h >>> 16;

    	    h = hh[7];
    	    l = hl[7];

    	    a += l & 0xffff; b += l >>> 16;
    	    c += h & 0xffff; d += h >>> 16;

    	    b += a >>> 16;
    	    c += b >>> 16;
    	    d += c >>> 16;

    	    hh[7] = ah7 = (c & 0xffff) | (d << 16);
    	    hl[7] = al7 = (a & 0xffff) | (b << 16);

    	    pos += 128;
    	    n -= 128;
    	  }

    	  return n;
    	}

    	function crypto_hash(out, m, n) {
    	  var hh = new Int32Array(8),
    	      hl = new Int32Array(8),
    	      x = new Uint8Array(256),
    	      i, b = n;

    	  hh[0] = 0x6a09e667;
    	  hh[1] = 0xbb67ae85;
    	  hh[2] = 0x3c6ef372;
    	  hh[3] = 0xa54ff53a;
    	  hh[4] = 0x510e527f;
    	  hh[5] = 0x9b05688c;
    	  hh[6] = 0x1f83d9ab;
    	  hh[7] = 0x5be0cd19;

    	  hl[0] = 0xf3bcc908;
    	  hl[1] = 0x84caa73b;
    	  hl[2] = 0xfe94f82b;
    	  hl[3] = 0x5f1d36f1;
    	  hl[4] = 0xade682d1;
    	  hl[5] = 0x2b3e6c1f;
    	  hl[6] = 0xfb41bd6b;
    	  hl[7] = 0x137e2179;

    	  crypto_hashblocks_hl(hh, hl, m, n);
    	  n %= 128;

    	  for (i = 0; i < n; i++) x[i] = m[b-n+i];
    	  x[n] = 128;

    	  n = 256-128*(n<112?1:0);
    	  x[n-9] = 0;
    	  ts64(x, n-8,  (b / 0x20000000) | 0, b << 3);
    	  crypto_hashblocks_hl(hh, hl, x, n);

    	  for (i = 0; i < 8; i++) ts64(out, 8*i, hh[i], hl[i]);

    	  return 0;
    	}

    	function add(p, q) {
    	  var a = gf(), b = gf(), c = gf(),
    	      d = gf(), e = gf(), f = gf(),
    	      g = gf(), h = gf(), t = gf();

    	  Z(a, p[1], p[0]);
    	  Z(t, q[1], q[0]);
    	  M(a, a, t);
    	  A(b, p[0], p[1]);
    	  A(t, q[0], q[1]);
    	  M(b, b, t);
    	  M(c, p[3], q[3]);
    	  M(c, c, D2);
    	  M(d, p[2], q[2]);
    	  A(d, d, d);
    	  Z(e, b, a);
    	  Z(f, d, c);
    	  A(g, d, c);
    	  A(h, b, a);

    	  M(p[0], e, f);
    	  M(p[1], h, g);
    	  M(p[2], g, f);
    	  M(p[3], e, h);
    	}

    	function cswap(p, q, b) {
    	  var i;
    	  for (i = 0; i < 4; i++) {
    	    sel25519(p[i], q[i], b);
    	  }
    	}

    	function pack(r, p) {
    	  var tx = gf(), ty = gf(), zi = gf();
    	  inv25519(zi, p[2]);
    	  M(tx, p[0], zi);
    	  M(ty, p[1], zi);
    	  pack25519(r, ty);
    	  r[31] ^= par25519(tx) << 7;
    	}

    	function scalarmult(p, q, s) {
    	  var b, i;
    	  set25519(p[0], gf0);
    	  set25519(p[1], gf1);
    	  set25519(p[2], gf1);
    	  set25519(p[3], gf0);
    	  for (i = 255; i >= 0; --i) {
    	    b = (s[(i/8)|0] >> (i&7)) & 1;
    	    cswap(p, q, b);
    	    add(q, p);
    	    add(p, p);
    	    cswap(p, q, b);
    	  }
    	}

    	function scalarbase(p, s) {
    	  var q = [gf(), gf(), gf(), gf()];
    	  set25519(q[0], X);
    	  set25519(q[1], Y);
    	  set25519(q[2], gf1);
    	  M(q[3], X, Y);
    	  scalarmult(p, q, s);
    	}

    	function crypto_sign_keypair(pk, sk, seeded) {
    	  var d = new Uint8Array(64);
    	  var p = [gf(), gf(), gf(), gf()];
    	  var i;

    	  if (!seeded) randombytes(sk, 32);
    	  crypto_hash(d, sk, 32);
    	  d[0] &= 248;
    	  d[31] &= 127;
    	  d[31] |= 64;

    	  scalarbase(p, d);
    	  pack(pk, p);

    	  for (i = 0; i < 32; i++) sk[i+32] = pk[i];
    	  return 0;
    	}

    	var L = new Float64Array([0xed, 0xd3, 0xf5, 0x5c, 0x1a, 0x63, 0x12, 0x58, 0xd6, 0x9c, 0xf7, 0xa2, 0xde, 0xf9, 0xde, 0x14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x10]);

    	function modL(r, x) {
    	  var carry, i, j, k;
    	  for (i = 63; i >= 32; --i) {
    	    carry = 0;
    	    for (j = i - 32, k = i - 12; j < k; ++j) {
    	      x[j] += carry - 16 * x[i] * L[j - (i - 32)];
    	      carry = (x[j] + 128) >> 8;
    	      x[j] -= carry * 256;
    	    }
    	    x[j] += carry;
    	    x[i] = 0;
    	  }
    	  carry = 0;
    	  for (j = 0; j < 32; j++) {
    	    x[j] += carry - (x[31] >> 4) * L[j];
    	    carry = x[j] >> 8;
    	    x[j] &= 255;
    	  }
    	  for (j = 0; j < 32; j++) x[j] -= carry * L[j];
    	  for (i = 0; i < 32; i++) {
    	    x[i+1] += x[i] >> 8;
    	    r[i] = x[i] & 255;
    	  }
    	}

    	function reduce(r) {
    	  var x = new Float64Array(64), i;
    	  for (i = 0; i < 64; i++) x[i] = r[i];
    	  for (i = 0; i < 64; i++) r[i] = 0;
    	  modL(r, x);
    	}

    	// Note: difference from C - smlen returned, not passed as argument.
    	function crypto_sign(sm, m, n, sk) {
    	  var d = new Uint8Array(64), h = new Uint8Array(64), r = new Uint8Array(64);
    	  var i, j, x = new Float64Array(64);
    	  var p = [gf(), gf(), gf(), gf()];

    	  crypto_hash(d, sk, 32);
    	  d[0] &= 248;
    	  d[31] &= 127;
    	  d[31] |= 64;

    	  var smlen = n + 64;
    	  for (i = 0; i < n; i++) sm[64 + i] = m[i];
    	  for (i = 0; i < 32; i++) sm[32 + i] = d[32 + i];

    	  crypto_hash(r, sm.subarray(32), n+32);
    	  reduce(r);
    	  scalarbase(p, r);
    	  pack(sm, p);

    	  for (i = 32; i < 64; i++) sm[i] = sk[i];
    	  crypto_hash(h, sm, n + 64);
    	  reduce(h);

    	  for (i = 0; i < 64; i++) x[i] = 0;
    	  for (i = 0; i < 32; i++) x[i] = r[i];
    	  for (i = 0; i < 32; i++) {
    	    for (j = 0; j < 32; j++) {
    	      x[i+j] += h[i] * d[j];
    	    }
    	  }

    	  modL(sm.subarray(32), x);
    	  return smlen;
    	}

    	function unpackneg(r, p) {
    	  var t = gf(), chk = gf(), num = gf(),
    	      den = gf(), den2 = gf(), den4 = gf(),
    	      den6 = gf();

    	  set25519(r[2], gf1);
    	  unpack25519(r[1], p);
    	  S(num, r[1]);
    	  M(den, num, D);
    	  Z(num, num, r[2]);
    	  A(den, r[2], den);

    	  S(den2, den);
    	  S(den4, den2);
    	  M(den6, den4, den2);
    	  M(t, den6, num);
    	  M(t, t, den);

    	  pow2523(t, t);
    	  M(t, t, num);
    	  M(t, t, den);
    	  M(t, t, den);
    	  M(r[0], t, den);

    	  S(chk, r[0]);
    	  M(chk, chk, den);
    	  if (neq25519(chk, num)) M(r[0], r[0], I);

    	  S(chk, r[0]);
    	  M(chk, chk, den);
    	  if (neq25519(chk, num)) return -1;

    	  if (par25519(r[0]) === (p[31]>>7)) Z(r[0], gf0, r[0]);

    	  M(r[3], r[0], r[1]);
    	  return 0;
    	}

    	function crypto_sign_open(m, sm, n, pk) {
    	  var i, mlen;
    	  var t = new Uint8Array(32), h = new Uint8Array(64);
    	  var p = [gf(), gf(), gf(), gf()],
    	      q = [gf(), gf(), gf(), gf()];

    	  mlen = -1;
    	  if (n < 64) return -1;

    	  if (unpackneg(q, pk)) return -1;

    	  for (i = 0; i < n; i++) m[i] = sm[i];
    	  for (i = 0; i < 32; i++) m[i+32] = pk[i];
    	  crypto_hash(h, m, n);
    	  reduce(h);
    	  scalarmult(p, q, h);

    	  scalarbase(q, sm.subarray(32));
    	  add(p, q);
    	  pack(t, p);

    	  n -= 64;
    	  if (crypto_verify_32(sm, 0, t, 0)) {
    	    for (i = 0; i < n; i++) m[i] = 0;
    	    return -1;
    	  }

    	  for (i = 0; i < n; i++) m[i] = sm[i + 64];
    	  mlen = n;
    	  return mlen;
    	}

    	var crypto_secretbox_KEYBYTES = 32,
    	    crypto_secretbox_NONCEBYTES = 24,
    	    crypto_secretbox_ZEROBYTES = 32,
    	    crypto_secretbox_BOXZEROBYTES = 16,
    	    crypto_scalarmult_BYTES = 32,
    	    crypto_scalarmult_SCALARBYTES = 32,
    	    crypto_box_PUBLICKEYBYTES = 32,
    	    crypto_box_SECRETKEYBYTES = 32,
    	    crypto_box_BEFORENMBYTES = 32,
    	    crypto_box_NONCEBYTES = crypto_secretbox_NONCEBYTES,
    	    crypto_box_ZEROBYTES = crypto_secretbox_ZEROBYTES,
    	    crypto_box_BOXZEROBYTES = crypto_secretbox_BOXZEROBYTES,
    	    crypto_sign_BYTES = 64,
    	    crypto_sign_PUBLICKEYBYTES = 32,
    	    crypto_sign_SECRETKEYBYTES = 64,
    	    crypto_sign_SEEDBYTES = 32,
    	    crypto_hash_BYTES = 64;

    	nacl.lowlevel = {
    	  crypto_core_hsalsa20: crypto_core_hsalsa20,
    	  crypto_stream_xor: crypto_stream_xor,
    	  crypto_stream: crypto_stream,
    	  crypto_stream_salsa20_xor: crypto_stream_salsa20_xor,
    	  crypto_stream_salsa20: crypto_stream_salsa20,
    	  crypto_onetimeauth: crypto_onetimeauth,
    	  crypto_onetimeauth_verify: crypto_onetimeauth_verify,
    	  crypto_verify_16: crypto_verify_16,
    	  crypto_verify_32: crypto_verify_32,
    	  crypto_secretbox: crypto_secretbox,
    	  crypto_secretbox_open: crypto_secretbox_open,
    	  crypto_scalarmult: crypto_scalarmult,
    	  crypto_scalarmult_base: crypto_scalarmult_base,
    	  crypto_box_beforenm: crypto_box_beforenm,
    	  crypto_box_afternm: crypto_box_afternm,
    	  crypto_box: crypto_box,
    	  crypto_box_open: crypto_box_open,
    	  crypto_box_keypair: crypto_box_keypair,
    	  crypto_hash: crypto_hash,
    	  crypto_sign: crypto_sign,
    	  crypto_sign_keypair: crypto_sign_keypair,
    	  crypto_sign_open: crypto_sign_open,

    	  crypto_secretbox_KEYBYTES: crypto_secretbox_KEYBYTES,
    	  crypto_secretbox_NONCEBYTES: crypto_secretbox_NONCEBYTES,
    	  crypto_secretbox_ZEROBYTES: crypto_secretbox_ZEROBYTES,
    	  crypto_secretbox_BOXZEROBYTES: crypto_secretbox_BOXZEROBYTES,
    	  crypto_scalarmult_BYTES: crypto_scalarmult_BYTES,
    	  crypto_scalarmult_SCALARBYTES: crypto_scalarmult_SCALARBYTES,
    	  crypto_box_PUBLICKEYBYTES: crypto_box_PUBLICKEYBYTES,
    	  crypto_box_SECRETKEYBYTES: crypto_box_SECRETKEYBYTES,
    	  crypto_box_BEFORENMBYTES: crypto_box_BEFORENMBYTES,
    	  crypto_box_NONCEBYTES: crypto_box_NONCEBYTES,
    	  crypto_box_ZEROBYTES: crypto_box_ZEROBYTES,
    	  crypto_box_BOXZEROBYTES: crypto_box_BOXZEROBYTES,
    	  crypto_sign_BYTES: crypto_sign_BYTES,
    	  crypto_sign_PUBLICKEYBYTES: crypto_sign_PUBLICKEYBYTES,
    	  crypto_sign_SECRETKEYBYTES: crypto_sign_SECRETKEYBYTES,
    	  crypto_sign_SEEDBYTES: crypto_sign_SEEDBYTES,
    	  crypto_hash_BYTES: crypto_hash_BYTES
    	};

    	/* High-level API */

    	function checkLengths(k, n) {
    	  if (k.length !== crypto_secretbox_KEYBYTES) throw new Error('bad key size');
    	  if (n.length !== crypto_secretbox_NONCEBYTES) throw new Error('bad nonce size');
    	}

    	function checkBoxLengths(pk, sk) {
    	  if (pk.length !== crypto_box_PUBLICKEYBYTES) throw new Error('bad public key size');
    	  if (sk.length !== crypto_box_SECRETKEYBYTES) throw new Error('bad secret key size');
    	}

    	function checkArrayTypes() {
    	  for (var i = 0; i < arguments.length; i++) {
    	    if (!(arguments[i] instanceof Uint8Array))
    	      throw new TypeError('unexpected type, use Uint8Array');
    	  }
    	}

    	function cleanup(arr) {
    	  for (var i = 0; i < arr.length; i++) arr[i] = 0;
    	}

    	nacl.randomBytes = function(n) {
    	  var b = new Uint8Array(n);
    	  randombytes(b, n);
    	  return b;
    	};

    	nacl.secretbox = function(msg, nonce, key) {
    	  checkArrayTypes(msg, nonce, key);
    	  checkLengths(key, nonce);
    	  var m = new Uint8Array(crypto_secretbox_ZEROBYTES + msg.length);
    	  var c = new Uint8Array(m.length);
    	  for (var i = 0; i < msg.length; i++) m[i+crypto_secretbox_ZEROBYTES] = msg[i];
    	  crypto_secretbox(c, m, m.length, nonce, key);
    	  return c.subarray(crypto_secretbox_BOXZEROBYTES);
    	};

    	nacl.secretbox.open = function(box, nonce, key) {
    	  checkArrayTypes(box, nonce, key);
    	  checkLengths(key, nonce);
    	  var c = new Uint8Array(crypto_secretbox_BOXZEROBYTES + box.length);
    	  var m = new Uint8Array(c.length);
    	  for (var i = 0; i < box.length; i++) c[i+crypto_secretbox_BOXZEROBYTES] = box[i];
    	  if (c.length < 32) return null;
    	  if (crypto_secretbox_open(m, c, c.length, nonce, key) !== 0) return null;
    	  return m.subarray(crypto_secretbox_ZEROBYTES);
    	};

    	nacl.secretbox.keyLength = crypto_secretbox_KEYBYTES;
    	nacl.secretbox.nonceLength = crypto_secretbox_NONCEBYTES;
    	nacl.secretbox.overheadLength = crypto_secretbox_BOXZEROBYTES;

    	nacl.scalarMult = function(n, p) {
    	  checkArrayTypes(n, p);
    	  if (n.length !== crypto_scalarmult_SCALARBYTES) throw new Error('bad n size');
    	  if (p.length !== crypto_scalarmult_BYTES) throw new Error('bad p size');
    	  var q = new Uint8Array(crypto_scalarmult_BYTES);
    	  crypto_scalarmult(q, n, p);
    	  return q;
    	};

    	nacl.scalarMult.base = function(n) {
    	  checkArrayTypes(n);
    	  if (n.length !== crypto_scalarmult_SCALARBYTES) throw new Error('bad n size');
    	  var q = new Uint8Array(crypto_scalarmult_BYTES);
    	  crypto_scalarmult_base(q, n);
    	  return q;
    	};

    	nacl.scalarMult.scalarLength = crypto_scalarmult_SCALARBYTES;
    	nacl.scalarMult.groupElementLength = crypto_scalarmult_BYTES;

    	nacl.box = function(msg, nonce, publicKey, secretKey) {
    	  var k = nacl.box.before(publicKey, secretKey);
    	  return nacl.secretbox(msg, nonce, k);
    	};

    	nacl.box.before = function(publicKey, secretKey) {
    	  checkArrayTypes(publicKey, secretKey);
    	  checkBoxLengths(publicKey, secretKey);
    	  var k = new Uint8Array(crypto_box_BEFORENMBYTES);
    	  crypto_box_beforenm(k, publicKey, secretKey);
    	  return k;
    	};

    	nacl.box.after = nacl.secretbox;

    	nacl.box.open = function(msg, nonce, publicKey, secretKey) {
    	  var k = nacl.box.before(publicKey, secretKey);
    	  return nacl.secretbox.open(msg, nonce, k);
    	};

    	nacl.box.open.after = nacl.secretbox.open;

    	nacl.box.keyPair = function() {
    	  var pk = new Uint8Array(crypto_box_PUBLICKEYBYTES);
    	  var sk = new Uint8Array(crypto_box_SECRETKEYBYTES);
    	  crypto_box_keypair(pk, sk);
    	  return {publicKey: pk, secretKey: sk};
    	};

    	nacl.box.keyPair.fromSecretKey = function(secretKey) {
    	  checkArrayTypes(secretKey);
    	  if (secretKey.length !== crypto_box_SECRETKEYBYTES)
    	    throw new Error('bad secret key size');
    	  var pk = new Uint8Array(crypto_box_PUBLICKEYBYTES);
    	  crypto_scalarmult_base(pk, secretKey);
    	  return {publicKey: pk, secretKey: new Uint8Array(secretKey)};
    	};

    	nacl.box.publicKeyLength = crypto_box_PUBLICKEYBYTES;
    	nacl.box.secretKeyLength = crypto_box_SECRETKEYBYTES;
    	nacl.box.sharedKeyLength = crypto_box_BEFORENMBYTES;
    	nacl.box.nonceLength = crypto_box_NONCEBYTES;
    	nacl.box.overheadLength = nacl.secretbox.overheadLength;

    	nacl.sign = function(msg, secretKey) {
    	  checkArrayTypes(msg, secretKey);
    	  if (secretKey.length !== crypto_sign_SECRETKEYBYTES)
    	    throw new Error('bad secret key size');
    	  var signedMsg = new Uint8Array(crypto_sign_BYTES+msg.length);
    	  crypto_sign(signedMsg, msg, msg.length, secretKey);
    	  return signedMsg;
    	};

    	nacl.sign.open = function(signedMsg, publicKey) {
    	  checkArrayTypes(signedMsg, publicKey);
    	  if (publicKey.length !== crypto_sign_PUBLICKEYBYTES)
    	    throw new Error('bad public key size');
    	  var tmp = new Uint8Array(signedMsg.length);
    	  var mlen = crypto_sign_open(tmp, signedMsg, signedMsg.length, publicKey);
    	  if (mlen < 0) return null;
    	  var m = new Uint8Array(mlen);
    	  for (var i = 0; i < m.length; i++) m[i] = tmp[i];
    	  return m;
    	};

    	nacl.sign.detached = function(msg, secretKey) {
    	  var signedMsg = nacl.sign(msg, secretKey);
    	  var sig = new Uint8Array(crypto_sign_BYTES);
    	  for (var i = 0; i < sig.length; i++) sig[i] = signedMsg[i];
    	  return sig;
    	};

    	nacl.sign.detached.verify = function(msg, sig, publicKey) {
    	  checkArrayTypes(msg, sig, publicKey);
    	  if (sig.length !== crypto_sign_BYTES)
    	    throw new Error('bad signature size');
    	  if (publicKey.length !== crypto_sign_PUBLICKEYBYTES)
    	    throw new Error('bad public key size');
    	  var sm = new Uint8Array(crypto_sign_BYTES + msg.length);
    	  var m = new Uint8Array(crypto_sign_BYTES + msg.length);
    	  var i;
    	  for (i = 0; i < crypto_sign_BYTES; i++) sm[i] = sig[i];
    	  for (i = 0; i < msg.length; i++) sm[i+crypto_sign_BYTES] = msg[i];
    	  return (crypto_sign_open(m, sm, sm.length, publicKey) >= 0);
    	};

    	nacl.sign.keyPair = function() {
    	  var pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
    	  var sk = new Uint8Array(crypto_sign_SECRETKEYBYTES);
    	  crypto_sign_keypair(pk, sk);
    	  return {publicKey: pk, secretKey: sk};
    	};

    	nacl.sign.keyPair.fromSecretKey = function(secretKey) {
    	  checkArrayTypes(secretKey);
    	  if (secretKey.length !== crypto_sign_SECRETKEYBYTES)
    	    throw new Error('bad secret key size');
    	  var pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
    	  for (var i = 0; i < pk.length; i++) pk[i] = secretKey[32+i];
    	  return {publicKey: pk, secretKey: new Uint8Array(secretKey)};
    	};

    	nacl.sign.keyPair.fromSeed = function(seed) {
    	  checkArrayTypes(seed);
    	  if (seed.length !== crypto_sign_SEEDBYTES)
    	    throw new Error('bad seed size');
    	  var pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
    	  var sk = new Uint8Array(crypto_sign_SECRETKEYBYTES);
    	  for (var i = 0; i < 32; i++) sk[i] = seed[i];
    	  crypto_sign_keypair(pk, sk, true);
    	  return {publicKey: pk, secretKey: sk};
    	};

    	nacl.sign.publicKeyLength = crypto_sign_PUBLICKEYBYTES;
    	nacl.sign.secretKeyLength = crypto_sign_SECRETKEYBYTES;
    	nacl.sign.seedLength = crypto_sign_SEEDBYTES;
    	nacl.sign.signatureLength = crypto_sign_BYTES;

    	nacl.hash = function(msg) {
    	  checkArrayTypes(msg);
    	  var h = new Uint8Array(crypto_hash_BYTES);
    	  crypto_hash(h, msg, msg.length);
    	  return h;
    	};

    	nacl.hash.hashLength = crypto_hash_BYTES;

    	nacl.verify = function(x, y) {
    	  checkArrayTypes(x, y);
    	  // Zero length arguments are considered not equal.
    	  if (x.length === 0 || y.length === 0) return false;
    	  if (x.length !== y.length) return false;
    	  return (vn(x, 0, y, 0, x.length) === 0) ? true : false;
    	};

    	nacl.setPRNG = function(fn) {
    	  randombytes = fn;
    	};

    	(function() {
    	  // Initialize PRNG if environment provides CSPRNG.
    	  // If not, methods calling randombytes will throw.
    	  var crypto = typeof self !== 'undefined' ? (self.crypto || self.msCrypto) : null;
    	  if (crypto && crypto.getRandomValues) {
    	    // Browsers.
    	    var QUOTA = 65536;
    	    nacl.setPRNG(function(x, n) {
    	      var i, v = new Uint8Array(n);
    	      for (i = 0; i < n; i += QUOTA) {
    	        crypto.getRandomValues(v.subarray(i, i + Math.min(n - i, QUOTA)));
    	      }
    	      for (i = 0; i < n; i++) x[i] = v[i];
    	      cleanup(v);
    	    });
    	  } else {
    	    // Node.js.
    	    crypto = __webpack_require__(56);
    	    if (crypto && crypto.randomBytes) {
    	      nacl.setPRNG(function(x, n) {
    	        var i, v = crypto.randomBytes(n);
    	        for (i = 0; i < n; i++) x[i] = v[i];
    	        cleanup(v);
    	      });
    	    }
    	  }
    	})();

    	})(typeof module !== 'undefined' && module.exports ? module.exports : (self.nacl = self.nacl || {}));


    /***/ }),
    /* 56 */
    /***/ (function(module, exports) {

    	/* (ignored) */

    /***/ }),
    /* 57 */
    /***/ (function(module, exports, __webpack_require__) {

    	/* WEBPACK VAR INJECTION */(function(Buffer) {// Written in 2014-2016 by Dmitry Chestnykh and Devi Mandiri.
    	// Public domain.
    	(function(root, f) {
    	  if (typeof module !== 'undefined' && module.exports) module.exports = f();
    	  else if (root.nacl) root.nacl.util = f();
    	  else {
    	    root.nacl = {};
    	    root.nacl.util = f();
    	  }
    	}(this, function() {

    	  var util = {};

    	  function validateBase64(s) {
    	    if (!(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))) {
    	      throw new TypeError('invalid encoding');
    	    }
    	  }

    	  util.decodeUTF8 = function(s) {
    	    if (typeof s !== 'string') throw new TypeError('expected string');
    	    var i, d = unescape(encodeURIComponent(s)), b = new Uint8Array(d.length);
    	    for (i = 0; i < d.length; i++) b[i] = d.charCodeAt(i);
    	    return b;
    	  };

    	  util.encodeUTF8 = function(arr) {
    	    var i, s = [];
    	    for (i = 0; i < arr.length; i++) s.push(String.fromCharCode(arr[i]));
    	    return decodeURIComponent(escape(s.join('')));
    	  };

    	  if (typeof atob === 'undefined') {
    	    // Node.js

    	    if (typeof Buffer.from !== 'undefined') {
    	       // Node v6 and later
    	      util.encodeBase64 = function (arr) { // v6 and later
    	          return Buffer.from(arr).toString('base64');
    	      };

    	      util.decodeBase64 = function (s) {
    	        validateBase64(s);
    	        return new Uint8Array(Array.prototype.slice.call(Buffer.from(s, 'base64'), 0));
    	      };

    	    } else {
    	      // Node earlier than v6
    	      util.encodeBase64 = function (arr) { // v6 and later
    	        return (new Buffer(arr)).toString('base64');
    	      };

    	      util.decodeBase64 = function(s) {
    	        validateBase64(s);
    	        return new Uint8Array(Array.prototype.slice.call(new Buffer(s, 'base64'), 0));
    	      };
    	    }

    	  } else {
    	    // Browsers

    	    util.encodeBase64 = function(arr) {
    	      var i, s = [], len = arr.length;
    	      for (i = 0; i < len; i++) s.push(String.fromCharCode(arr[i]));
    	      return btoa(s.join(''));
    	    };

    	    util.decodeBase64 = function(s) {
    	      validateBase64(s);
    	      var i, d = atob(s), b = new Uint8Array(d.length);
    	      for (i = 0; i < d.length; i++) b[i] = d.charCodeAt(i);
    	      return b;
    	    };

    	  }

    	  return util;

    	}));

    	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(58).Buffer));

    /***/ }),
    /* 58 */
    /***/ (function(module, exports, __webpack_require__) {

    	var base64 = __webpack_require__(59);
    	var ieee754 = __webpack_require__(60);
    	var isArray = __webpack_require__(61);

    	exports.Buffer = Buffer;
    	exports.SlowBuffer = SlowBuffer;
    	exports.INSPECT_MAX_BYTES = 50;

    	/**
    	 * If `Buffer.TYPED_ARRAY_SUPPORT`:
    	 *   === true    Use Uint8Array implementation (fastest)
    	 *   === false   Use Object implementation (most compatible, even IE6)
    	 *
    	 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
    	 * Opera 11.6+, iOS 4.2+.
    	 *
    	 * Due to various browser bugs, sometimes the Object implementation will be used even
    	 * when the browser supports typed arrays.
    	 *
    	 * Note:
    	 *
    	 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
    	 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
    	 *
    	 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
    	 *
    	 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
    	 *     incorrect length in some situations.

    	 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
    	 * get the Object implementation, which is slower but behaves correctly.
    	 */
    	Buffer.TYPED_ARRAY_SUPPORT = (window).TYPED_ARRAY_SUPPORT !== undefined
    	  ? (window).TYPED_ARRAY_SUPPORT
    	  : typedArraySupport();

    	/*
    	 * Export kMaxLength after typed array support is determined.
    	 */
    	exports.kMaxLength = kMaxLength();

    	function typedArraySupport () {
    	  try {
    	    var arr = new Uint8Array(1);
    	    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }};
    	    return arr.foo() === 42 && // typed array instances can be augmented
    	        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
    	        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
    	  } catch (e) {
    	    return false
    	  }
    	}

    	function kMaxLength () {
    	  return Buffer.TYPED_ARRAY_SUPPORT
    	    ? 0x7fffffff
    	    : 0x3fffffff
    	}

    	function createBuffer (that, length) {
    	  if (kMaxLength() < length) {
    	    throw new RangeError('Invalid typed array length')
    	  }
    	  if (Buffer.TYPED_ARRAY_SUPPORT) {
    	    // Return an augmented `Uint8Array` instance, for best performance
    	    that = new Uint8Array(length);
    	    that.__proto__ = Buffer.prototype;
    	  } else {
    	    // Fallback: Return an object instance of the Buffer class
    	    if (that === null) {
    	      that = new Buffer(length);
    	    }
    	    that.length = length;
    	  }

    	  return that
    	}

    	/**
    	 * The Buffer constructor returns instances of `Uint8Array` that have their
    	 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
    	 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
    	 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
    	 * returns a single octet.
    	 *
    	 * The `Uint8Array` prototype remains unmodified.
    	 */

    	function Buffer (arg, encodingOrOffset, length) {
    	  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    	    return new Buffer(arg, encodingOrOffset, length)
    	  }

    	  // Common case.
    	  if (typeof arg === 'number') {
    	    if (typeof encodingOrOffset === 'string') {
    	      throw new Error(
    	        'If encoding is specified then the first argument must be a string'
    	      )
    	    }
    	    return allocUnsafe(this, arg)
    	  }
    	  return from(this, arg, encodingOrOffset, length)
    	}

    	Buffer.poolSize = 8192; // not used by this implementation

    	// TODO: Legacy, not needed anymore. Remove in next major version.
    	Buffer._augment = function (arr) {
    	  arr.__proto__ = Buffer.prototype;
    	  return arr
    	};

    	function from (that, value, encodingOrOffset, length) {
    	  if (typeof value === 'number') {
    	    throw new TypeError('"value" argument must not be a number')
    	  }

    	  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    	    return fromArrayBuffer(that, value, encodingOrOffset, length)
    	  }

    	  if (typeof value === 'string') {
    	    return fromString(that, value, encodingOrOffset)
    	  }

    	  return fromObject(that, value)
    	}

    	/**
    	 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
    	 * if value is a number.
    	 * Buffer.from(str[, encoding])
    	 * Buffer.from(array)
    	 * Buffer.from(buffer)
    	 * Buffer.from(arrayBuffer[, byteOffset[, length]])
    	 **/
    	Buffer.from = function (value, encodingOrOffset, length) {
    	  return from(null, value, encodingOrOffset, length)
    	};

    	if (Buffer.TYPED_ARRAY_SUPPORT) {
    	  Buffer.prototype.__proto__ = Uint8Array.prototype;
    	  Buffer.__proto__ = Uint8Array;
    	  if (typeof Symbol !== 'undefined' && Symbol.species &&
    	      Buffer[Symbol.species] === Buffer) {
    	    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    	    Object.defineProperty(Buffer, Symbol.species, {
    	      value: null,
    	      configurable: true
    	    });
    	  }
    	}

    	function assertSize (size) {
    	  if (typeof size !== 'number') {
    	    throw new TypeError('"size" argument must be a number')
    	  } else if (size < 0) {
    	    throw new RangeError('"size" argument must not be negative')
    	  }
    	}

    	function alloc (that, size, fill, encoding) {
    	  assertSize(size);
    	  if (size <= 0) {
    	    return createBuffer(that, size)
    	  }
    	  if (fill !== undefined) {
    	    // Only pay attention to encoding if it's a string. This
    	    // prevents accidentally sending in a number that would
    	    // be interpretted as a start offset.
    	    return typeof encoding === 'string'
    	      ? createBuffer(that, size).fill(fill, encoding)
    	      : createBuffer(that, size).fill(fill)
    	  }
    	  return createBuffer(that, size)
    	}

    	/**
    	 * Creates a new filled Buffer instance.
    	 * alloc(size[, fill[, encoding]])
    	 **/
    	Buffer.alloc = function (size, fill, encoding) {
    	  return alloc(null, size, fill, encoding)
    	};

    	function allocUnsafe (that, size) {
    	  assertSize(size);
    	  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
    	  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    	    for (var i = 0; i < size; ++i) {
    	      that[i] = 0;
    	    }
    	  }
    	  return that
    	}

    	/**
    	 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
    	 * */
    	Buffer.allocUnsafe = function (size) {
    	  return allocUnsafe(null, size)
    	};
    	/**
    	 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
    	 */
    	Buffer.allocUnsafeSlow = function (size) {
    	  return allocUnsafe(null, size)
    	};

    	function fromString (that, string, encoding) {
    	  if (typeof encoding !== 'string' || encoding === '') {
    	    encoding = 'utf8';
    	  }

    	  if (!Buffer.isEncoding(encoding)) {
    	    throw new TypeError('"encoding" must be a valid string encoding')
    	  }

    	  var length = byteLength(string, encoding) | 0;
    	  that = createBuffer(that, length);

    	  var actual = that.write(string, encoding);

    	  if (actual !== length) {
    	    // Writing a hex string, for example, that contains invalid characters will
    	    // cause everything after the first invalid character to be ignored. (e.g.
    	    // 'abxxcd' will be treated as 'ab')
    	    that = that.slice(0, actual);
    	  }

    	  return that
    	}

    	function fromArrayLike (that, array) {
    	  var length = array.length < 0 ? 0 : checked(array.length) | 0;
    	  that = createBuffer(that, length);
    	  for (var i = 0; i < length; i += 1) {
    	    that[i] = array[i] & 255;
    	  }
    	  return that
    	}

    	function fromArrayBuffer (that, array, byteOffset, length) {
    	  array.byteLength; // this throws if `array` is not a valid ArrayBuffer

    	  if (byteOffset < 0 || array.byteLength < byteOffset) {
    	    throw new RangeError('\'offset\' is out of bounds')
    	  }

    	  if (array.byteLength < byteOffset + (length || 0)) {
    	    throw new RangeError('\'length\' is out of bounds')
    	  }

    	  if (byteOffset === undefined && length === undefined) {
    	    array = new Uint8Array(array);
    	  } else if (length === undefined) {
    	    array = new Uint8Array(array, byteOffset);
    	  } else {
    	    array = new Uint8Array(array, byteOffset, length);
    	  }

    	  if (Buffer.TYPED_ARRAY_SUPPORT) {
    	    // Return an augmented `Uint8Array` instance, for best performance
    	    that = array;
    	    that.__proto__ = Buffer.prototype;
    	  } else {
    	    // Fallback: Return an object instance of the Buffer class
    	    that = fromArrayLike(that, array);
    	  }
    	  return that
    	}

    	function fromObject (that, obj) {
    	  if (Buffer.isBuffer(obj)) {
    	    var len = checked(obj.length) | 0;
    	    that = createBuffer(that, len);

    	    if (that.length === 0) {
    	      return that
    	    }

    	    obj.copy(that, 0, 0, len);
    	    return that
    	  }

    	  if (obj) {
    	    if ((typeof ArrayBuffer !== 'undefined' &&
    	        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
    	      if (typeof obj.length !== 'number' || isnan(obj.length)) {
    	        return createBuffer(that, 0)
    	      }
    	      return fromArrayLike(that, obj)
    	    }

    	    if (obj.type === 'Buffer' && isArray(obj.data)) {
    	      return fromArrayLike(that, obj.data)
    	    }
    	  }

    	  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
    	}

    	function checked (length) {
    	  // Note: cannot use `length < kMaxLength()` here because that fails when
    	  // length is NaN (which is otherwise coerced to zero.)
    	  if (length >= kMaxLength()) {
    	    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
    	                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
    	  }
    	  return length | 0
    	}

    	function SlowBuffer (length) {
    	  if (+length != length) { // eslint-disable-line eqeqeq
    	    length = 0;
    	  }
    	  return Buffer.alloc(+length)
    	}

    	Buffer.isBuffer = function isBuffer (b) {
    	  return !!(b != null && b._isBuffer)
    	};

    	Buffer.compare = function compare (a, b) {
    	  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    	    throw new TypeError('Arguments must be Buffers')
    	  }

    	  if (a === b) return 0

    	  var x = a.length;
    	  var y = b.length;

    	  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    	    if (a[i] !== b[i]) {
    	      x = a[i];
    	      y = b[i];
    	      break
    	    }
    	  }

    	  if (x < y) return -1
    	  if (y < x) return 1
    	  return 0
    	};

    	Buffer.isEncoding = function isEncoding (encoding) {
    	  switch (String(encoding).toLowerCase()) {
    	    case 'hex':
    	    case 'utf8':
    	    case 'utf-8':
    	    case 'ascii':
    	    case 'latin1':
    	    case 'binary':
    	    case 'base64':
    	    case 'ucs2':
    	    case 'ucs-2':
    	    case 'utf16le':
    	    case 'utf-16le':
    	      return true
    	    default:
    	      return false
    	  }
    	};

    	Buffer.concat = function concat (list, length) {
    	  if (!isArray(list)) {
    	    throw new TypeError('"list" argument must be an Array of Buffers')
    	  }

    	  if (list.length === 0) {
    	    return Buffer.alloc(0)
    	  }

    	  var i;
    	  if (length === undefined) {
    	    length = 0;
    	    for (i = 0; i < list.length; ++i) {
    	      length += list[i].length;
    	    }
    	  }

    	  var buffer = Buffer.allocUnsafe(length);
    	  var pos = 0;
    	  for (i = 0; i < list.length; ++i) {
    	    var buf = list[i];
    	    if (!Buffer.isBuffer(buf)) {
    	      throw new TypeError('"list" argument must be an Array of Buffers')
    	    }
    	    buf.copy(buffer, pos);
    	    pos += buf.length;
    	  }
    	  return buffer
    	};

    	function byteLength (string, encoding) {
    	  if (Buffer.isBuffer(string)) {
    	    return string.length
    	  }
    	  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
    	      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    	    return string.byteLength
    	  }
    	  if (typeof string !== 'string') {
    	    string = '' + string;
    	  }

    	  var len = string.length;
    	  if (len === 0) return 0

    	  // Use a for loop to avoid recursion
    	  var loweredCase = false;
    	  for (;;) {
    	    switch (encoding) {
    	      case 'ascii':
    	      case 'latin1':
    	      case 'binary':
    	        return len
    	      case 'utf8':
    	      case 'utf-8':
    	      case undefined:
    	        return utf8ToBytes(string).length
    	      case 'ucs2':
    	      case 'ucs-2':
    	      case 'utf16le':
    	      case 'utf-16le':
    	        return len * 2
    	      case 'hex':
    	        return len >>> 1
    	      case 'base64':
    	        return base64ToBytes(string).length
    	      default:
    	        if (loweredCase) return utf8ToBytes(string).length // assume utf8
    	        encoding = ('' + encoding).toLowerCase();
    	        loweredCase = true;
    	    }
    	  }
    	}
    	Buffer.byteLength = byteLength;

    	function slowToString (encoding, start, end) {
    	  var loweredCase = false;

    	  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
    	  // property of a typed array.

    	  // This behaves neither like String nor Uint8Array in that we set start/end
    	  // to their upper/lower bounds if the value passed is out of range.
    	  // undefined is handled specially as per ECMA-262 6th Edition,
    	  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
    	  if (start === undefined || start < 0) {
    	    start = 0;
    	  }
    	  // Return early if start > this.length. Done here to prevent potential uint32
    	  // coercion fail below.
    	  if (start > this.length) {
    	    return ''
    	  }

    	  if (end === undefined || end > this.length) {
    	    end = this.length;
    	  }

    	  if (end <= 0) {
    	    return ''
    	  }

    	  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
    	  end >>>= 0;
    	  start >>>= 0;

    	  if (end <= start) {
    	    return ''
    	  }

    	  if (!encoding) encoding = 'utf8';

    	  while (true) {
    	    switch (encoding) {
    	      case 'hex':
    	        return hexSlice(this, start, end)

    	      case 'utf8':
    	      case 'utf-8':
    	        return utf8Slice(this, start, end)

    	      case 'ascii':
    	        return asciiSlice(this, start, end)

    	      case 'latin1':
    	      case 'binary':
    	        return latin1Slice(this, start, end)

    	      case 'base64':
    	        return base64Slice(this, start, end)

    	      case 'ucs2':
    	      case 'ucs-2':
    	      case 'utf16le':
    	      case 'utf-16le':
    	        return utf16leSlice(this, start, end)

    	      default:
    	        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
    	        encoding = (encoding + '').toLowerCase();
    	        loweredCase = true;
    	    }
    	  }
    	}

    	// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
    	// Buffer instances.
    	Buffer.prototype._isBuffer = true;

    	function swap (b, n, m) {
    	  var i = b[n];
    	  b[n] = b[m];
    	  b[m] = i;
    	}

    	Buffer.prototype.swap16 = function swap16 () {
    	  var len = this.length;
    	  if (len % 2 !== 0) {
    	    throw new RangeError('Buffer size must be a multiple of 16-bits')
    	  }
    	  for (var i = 0; i < len; i += 2) {
    	    swap(this, i, i + 1);
    	  }
    	  return this
    	};

    	Buffer.prototype.swap32 = function swap32 () {
    	  var len = this.length;
    	  if (len % 4 !== 0) {
    	    throw new RangeError('Buffer size must be a multiple of 32-bits')
    	  }
    	  for (var i = 0; i < len; i += 4) {
    	    swap(this, i, i + 3);
    	    swap(this, i + 1, i + 2);
    	  }
    	  return this
    	};

    	Buffer.prototype.swap64 = function swap64 () {
    	  var len = this.length;
    	  if (len % 8 !== 0) {
    	    throw new RangeError('Buffer size must be a multiple of 64-bits')
    	  }
    	  for (var i = 0; i < len; i += 8) {
    	    swap(this, i, i + 7);
    	    swap(this, i + 1, i + 6);
    	    swap(this, i + 2, i + 5);
    	    swap(this, i + 3, i + 4);
    	  }
    	  return this
    	};

    	Buffer.prototype.toString = function toString () {
    	  var length = this.length | 0;
    	  if (length === 0) return ''
    	  if (arguments.length === 0) return utf8Slice(this, 0, length)
    	  return slowToString.apply(this, arguments)
    	};

    	Buffer.prototype.equals = function equals (b) {
    	  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
    	  if (this === b) return true
    	  return Buffer.compare(this, b) === 0
    	};

    	Buffer.prototype.inspect = function inspect () {
    	  var str = '';
    	  var max = exports.INSPECT_MAX_BYTES;
    	  if (this.length > 0) {
    	    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
    	    if (this.length > max) str += ' ... ';
    	  }
    	  return '<Buffer ' + str + '>'
    	};

    	Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
    	  if (!Buffer.isBuffer(target)) {
    	    throw new TypeError('Argument must be a Buffer')
    	  }

    	  if (start === undefined) {
    	    start = 0;
    	  }
    	  if (end === undefined) {
    	    end = target ? target.length : 0;
    	  }
    	  if (thisStart === undefined) {
    	    thisStart = 0;
    	  }
    	  if (thisEnd === undefined) {
    	    thisEnd = this.length;
    	  }

    	  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    	    throw new RangeError('out of range index')
    	  }

    	  if (thisStart >= thisEnd && start >= end) {
    	    return 0
    	  }
    	  if (thisStart >= thisEnd) {
    	    return -1
    	  }
    	  if (start >= end) {
    	    return 1
    	  }

    	  start >>>= 0;
    	  end >>>= 0;
    	  thisStart >>>= 0;
    	  thisEnd >>>= 0;

    	  if (this === target) return 0

    	  var x = thisEnd - thisStart;
    	  var y = end - start;
    	  var len = Math.min(x, y);

    	  var thisCopy = this.slice(thisStart, thisEnd);
    	  var targetCopy = target.slice(start, end);

    	  for (var i = 0; i < len; ++i) {
    	    if (thisCopy[i] !== targetCopy[i]) {
    	      x = thisCopy[i];
    	      y = targetCopy[i];
    	      break
    	    }
    	  }

    	  if (x < y) return -1
    	  if (y < x) return 1
    	  return 0
    	};

    	// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
    	// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
    	//
    	// Arguments:
    	// - buffer - a Buffer to search
    	// - val - a string, Buffer, or number
    	// - byteOffset - an index into `buffer`; will be clamped to an int32
    	// - encoding - an optional encoding, relevant is val is a string
    	// - dir - true for indexOf, false for lastIndexOf
    	function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
    	  // Empty buffer means no match
    	  if (buffer.length === 0) return -1

    	  // Normalize byteOffset
    	  if (typeof byteOffset === 'string') {
    	    encoding = byteOffset;
    	    byteOffset = 0;
    	  } else if (byteOffset > 0x7fffffff) {
    	    byteOffset = 0x7fffffff;
    	  } else if (byteOffset < -0x80000000) {
    	    byteOffset = -0x80000000;
    	  }
    	  byteOffset = +byteOffset;  // Coerce to Number.
    	  if (isNaN(byteOffset)) {
    	    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    	    byteOffset = dir ? 0 : (buffer.length - 1);
    	  }

    	  // Normalize byteOffset: negative offsets start from the end of the buffer
    	  if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
    	  if (byteOffset >= buffer.length) {
    	    if (dir) return -1
    	    else byteOffset = buffer.length - 1;
    	  } else if (byteOffset < 0) {
    	    if (dir) byteOffset = 0;
    	    else return -1
    	  }

    	  // Normalize val
    	  if (typeof val === 'string') {
    	    val = Buffer.from(val, encoding);
    	  }

    	  // Finally, search either indexOf (if dir is true) or lastIndexOf
    	  if (Buffer.isBuffer(val)) {
    	    // Special case: looking for empty string/buffer always fails
    	    if (val.length === 0) {
    	      return -1
    	    }
    	    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
    	  } else if (typeof val === 'number') {
    	    val = val & 0xFF; // Search for a byte value [0-255]
    	    if (Buffer.TYPED_ARRAY_SUPPORT &&
    	        typeof Uint8Array.prototype.indexOf === 'function') {
    	      if (dir) {
    	        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
    	      } else {
    	        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
    	      }
    	    }
    	    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
    	  }

    	  throw new TypeError('val must be string, number or Buffer')
    	}

    	function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
    	  var indexSize = 1;
    	  var arrLength = arr.length;
    	  var valLength = val.length;

    	  if (encoding !== undefined) {
    	    encoding = String(encoding).toLowerCase();
    	    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
    	        encoding === 'utf16le' || encoding === 'utf-16le') {
    	      if (arr.length < 2 || val.length < 2) {
    	        return -1
    	      }
    	      indexSize = 2;
    	      arrLength /= 2;
    	      valLength /= 2;
    	      byteOffset /= 2;
    	    }
    	  }

    	  function read (buf, i) {
    	    if (indexSize === 1) {
    	      return buf[i]
    	    } else {
    	      return buf.readUInt16BE(i * indexSize)
    	    }
    	  }

    	  var i;
    	  if (dir) {
    	    var foundIndex = -1;
    	    for (i = byteOffset; i < arrLength; i++) {
    	      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
    	        if (foundIndex === -1) foundIndex = i;
    	        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
    	      } else {
    	        if (foundIndex !== -1) i -= i - foundIndex;
    	        foundIndex = -1;
    	      }
    	    }
    	  } else {
    	    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
    	    for (i = byteOffset; i >= 0; i--) {
    	      var found = true;
    	      for (var j = 0; j < valLength; j++) {
    	        if (read(arr, i + j) !== read(val, j)) {
    	          found = false;
    	          break
    	        }
    	      }
    	      if (found) return i
    	    }
    	  }

    	  return -1
    	}

    	Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
    	  return this.indexOf(val, byteOffset, encoding) !== -1
    	};

    	Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
    	  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
    	};

    	Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
    	  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
    	};

    	function hexWrite (buf, string, offset, length) {
    	  offset = Number(offset) || 0;
    	  var remaining = buf.length - offset;
    	  if (!length) {
    	    length = remaining;
    	  } else {
    	    length = Number(length);
    	    if (length > remaining) {
    	      length = remaining;
    	    }
    	  }

    	  // must be an even number of digits
    	  var strLen = string.length;
    	  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

    	  if (length > strLen / 2) {
    	    length = strLen / 2;
    	  }
    	  for (var i = 0; i < length; ++i) {
    	    var parsed = parseInt(string.substr(i * 2, 2), 16);
    	    if (isNaN(parsed)) return i
    	    buf[offset + i] = parsed;
    	  }
    	  return i
    	}

    	function utf8Write (buf, string, offset, length) {
    	  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
    	}

    	function asciiWrite (buf, string, offset, length) {
    	  return blitBuffer(asciiToBytes(string), buf, offset, length)
    	}

    	function latin1Write (buf, string, offset, length) {
    	  return asciiWrite(buf, string, offset, length)
    	}

    	function base64Write (buf, string, offset, length) {
    	  return blitBuffer(base64ToBytes(string), buf, offset, length)
    	}

    	function ucs2Write (buf, string, offset, length) {
    	  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
    	}

    	Buffer.prototype.write = function write (string, offset, length, encoding) {
    	  // Buffer#write(string)
    	  if (offset === undefined) {
    	    encoding = 'utf8';
    	    length = this.length;
    	    offset = 0;
    	  // Buffer#write(string, encoding)
    	  } else if (length === undefined && typeof offset === 'string') {
    	    encoding = offset;
    	    length = this.length;
    	    offset = 0;
    	  // Buffer#write(string, offset[, length][, encoding])
    	  } else if (isFinite(offset)) {
    	    offset = offset | 0;
    	    if (isFinite(length)) {
    	      length = length | 0;
    	      if (encoding === undefined) encoding = 'utf8';
    	    } else {
    	      encoding = length;
    	      length = undefined;
    	    }
    	  // legacy write(string, encoding, offset, length) - remove in v0.13
    	  } else {
    	    throw new Error(
    	      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    	    )
    	  }

    	  var remaining = this.length - offset;
    	  if (length === undefined || length > remaining) length = remaining;

    	  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    	    throw new RangeError('Attempt to write outside buffer bounds')
    	  }

    	  if (!encoding) encoding = 'utf8';

    	  var loweredCase = false;
    	  for (;;) {
    	    switch (encoding) {
    	      case 'hex':
    	        return hexWrite(this, string, offset, length)

    	      case 'utf8':
    	      case 'utf-8':
    	        return utf8Write(this, string, offset, length)

    	      case 'ascii':
    	        return asciiWrite(this, string, offset, length)

    	      case 'latin1':
    	      case 'binary':
    	        return latin1Write(this, string, offset, length)

    	      case 'base64':
    	        // Warning: maxLength not taken into account in base64Write
    	        return base64Write(this, string, offset, length)

    	      case 'ucs2':
    	      case 'ucs-2':
    	      case 'utf16le':
    	      case 'utf-16le':
    	        return ucs2Write(this, string, offset, length)

    	      default:
    	        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
    	        encoding = ('' + encoding).toLowerCase();
    	        loweredCase = true;
    	    }
    	  }
    	};

    	Buffer.prototype.toJSON = function toJSON () {
    	  return {
    	    type: 'Buffer',
    	    data: Array.prototype.slice.call(this._arr || this, 0)
    	  }
    	};

    	function base64Slice (buf, start, end) {
    	  if (start === 0 && end === buf.length) {
    	    return base64.fromByteArray(buf)
    	  } else {
    	    return base64.fromByteArray(buf.slice(start, end))
    	  }
    	}

    	function utf8Slice (buf, start, end) {
    	  end = Math.min(buf.length, end);
    	  var res = [];

    	  var i = start;
    	  while (i < end) {
    	    var firstByte = buf[i];
    	    var codePoint = null;
    	    var bytesPerSequence = (firstByte > 0xEF) ? 4
    	      : (firstByte > 0xDF) ? 3
    	      : (firstByte > 0xBF) ? 2
    	      : 1;

    	    if (i + bytesPerSequence <= end) {
    	      var secondByte, thirdByte, fourthByte, tempCodePoint;

    	      switch (bytesPerSequence) {
    	        case 1:
    	          if (firstByte < 0x80) {
    	            codePoint = firstByte;
    	          }
    	          break
    	        case 2:
    	          secondByte = buf[i + 1];
    	          if ((secondByte & 0xC0) === 0x80) {
    	            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
    	            if (tempCodePoint > 0x7F) {
    	              codePoint = tempCodePoint;
    	            }
    	          }
    	          break
    	        case 3:
    	          secondByte = buf[i + 1];
    	          thirdByte = buf[i + 2];
    	          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
    	            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
    	            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
    	              codePoint = tempCodePoint;
    	            }
    	          }
    	          break
    	        case 4:
    	          secondByte = buf[i + 1];
    	          thirdByte = buf[i + 2];
    	          fourthByte = buf[i + 3];
    	          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
    	            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
    	            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
    	              codePoint = tempCodePoint;
    	            }
    	          }
    	      }
    	    }

    	    if (codePoint === null) {
    	      // we did not generate a valid codePoint so insert a
    	      // replacement char (U+FFFD) and advance only 1 byte
    	      codePoint = 0xFFFD;
    	      bytesPerSequence = 1;
    	    } else if (codePoint > 0xFFFF) {
    	      // encode to utf16 (surrogate pair dance)
    	      codePoint -= 0x10000;
    	      res.push(codePoint >>> 10 & 0x3FF | 0xD800);
    	      codePoint = 0xDC00 | codePoint & 0x3FF;
    	    }

    	    res.push(codePoint);
    	    i += bytesPerSequence;
    	  }

    	  return decodeCodePointsArray(res)
    	}

    	// Based on http://stackoverflow.com/a/22747272/680742, the browser with
    	// the lowest limit is Chrome, with 0x10000 args.
    	// We go 1 magnitude less, for safety
    	var MAX_ARGUMENTS_LENGTH = 0x1000;

    	function decodeCodePointsArray (codePoints) {
    	  var len = codePoints.length;
    	  if (len <= MAX_ARGUMENTS_LENGTH) {
    	    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
    	  }

    	  // Decode in chunks to avoid "call stack size exceeded".
    	  var res = '';
    	  var i = 0;
    	  while (i < len) {
    	    res += String.fromCharCode.apply(
    	      String,
    	      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    	    );
    	  }
    	  return res
    	}

    	function asciiSlice (buf, start, end) {
    	  var ret = '';
    	  end = Math.min(buf.length, end);

    	  for (var i = start; i < end; ++i) {
    	    ret += String.fromCharCode(buf[i] & 0x7F);
    	  }
    	  return ret
    	}

    	function latin1Slice (buf, start, end) {
    	  var ret = '';
    	  end = Math.min(buf.length, end);

    	  for (var i = start; i < end; ++i) {
    	    ret += String.fromCharCode(buf[i]);
    	  }
    	  return ret
    	}

    	function hexSlice (buf, start, end) {
    	  var len = buf.length;

    	  if (!start || start < 0) start = 0;
    	  if (!end || end < 0 || end > len) end = len;

    	  var out = '';
    	  for (var i = start; i < end; ++i) {
    	    out += toHex(buf[i]);
    	  }
    	  return out
    	}

    	function utf16leSlice (buf, start, end) {
    	  var bytes = buf.slice(start, end);
    	  var res = '';
    	  for (var i = 0; i < bytes.length; i += 2) {
    	    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
    	  }
    	  return res
    	}

    	Buffer.prototype.slice = function slice (start, end) {
    	  var len = this.length;
    	  start = ~~start;
    	  end = end === undefined ? len : ~~end;

    	  if (start < 0) {
    	    start += len;
    	    if (start < 0) start = 0;
    	  } else if (start > len) {
    	    start = len;
    	  }

    	  if (end < 0) {
    	    end += len;
    	    if (end < 0) end = 0;
    	  } else if (end > len) {
    	    end = len;
    	  }

    	  if (end < start) end = start;

    	  var newBuf;
    	  if (Buffer.TYPED_ARRAY_SUPPORT) {
    	    newBuf = this.subarray(start, end);
    	    newBuf.__proto__ = Buffer.prototype;
    	  } else {
    	    var sliceLen = end - start;
    	    newBuf = new Buffer(sliceLen, undefined);
    	    for (var i = 0; i < sliceLen; ++i) {
    	      newBuf[i] = this[i + start];
    	    }
    	  }

    	  return newBuf
    	};

    	/*
    	 * Need to make sure that buffer isn't trying to write out of bounds.
    	 */
    	function checkOffset (offset, ext, length) {
    	  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
    	  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
    	}

    	Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
    	  offset = offset | 0;
    	  byteLength = byteLength | 0;
    	  if (!noAssert) checkOffset(offset, byteLength, this.length);

    	  var val = this[offset];
    	  var mul = 1;
    	  var i = 0;
    	  while (++i < byteLength && (mul *= 0x100)) {
    	    val += this[offset + i] * mul;
    	  }

    	  return val
    	};

    	Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
    	  offset = offset | 0;
    	  byteLength = byteLength | 0;
    	  if (!noAssert) {
    	    checkOffset(offset, byteLength, this.length);
    	  }

    	  var val = this[offset + --byteLength];
    	  var mul = 1;
    	  while (byteLength > 0 && (mul *= 0x100)) {
    	    val += this[offset + --byteLength] * mul;
    	  }

    	  return val
    	};

    	Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
    	  if (!noAssert) checkOffset(offset, 1, this.length);
    	  return this[offset]
    	};

    	Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
    	  if (!noAssert) checkOffset(offset, 2, this.length);
    	  return this[offset] | (this[offset + 1] << 8)
    	};

    	Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
    	  if (!noAssert) checkOffset(offset, 2, this.length);
    	  return (this[offset] << 8) | this[offset + 1]
    	};

    	Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
    	  if (!noAssert) checkOffset(offset, 4, this.length);

    	  return ((this[offset]) |
    	      (this[offset + 1] << 8) |
    	      (this[offset + 2] << 16)) +
    	      (this[offset + 3] * 0x1000000)
    	};

    	Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
    	  if (!noAssert) checkOffset(offset, 4, this.length);

    	  return (this[offset] * 0x1000000) +
    	    ((this[offset + 1] << 16) |
    	    (this[offset + 2] << 8) |
    	    this[offset + 3])
    	};

    	Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
    	  offset = offset | 0;
    	  byteLength = byteLength | 0;
    	  if (!noAssert) checkOffset(offset, byteLength, this.length);

    	  var val = this[offset];
    	  var mul = 1;
    	  var i = 0;
    	  while (++i < byteLength && (mul *= 0x100)) {
    	    val += this[offset + i] * mul;
    	  }
    	  mul *= 0x80;

    	  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

    	  return val
    	};

    	Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
    	  offset = offset | 0;
    	  byteLength = byteLength | 0;
    	  if (!noAssert) checkOffset(offset, byteLength, this.length);

    	  var i = byteLength;
    	  var mul = 1;
    	  var val = this[offset + --i];
    	  while (i > 0 && (mul *= 0x100)) {
    	    val += this[offset + --i] * mul;
    	  }
    	  mul *= 0x80;

    	  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

    	  return val
    	};

    	Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
    	  if (!noAssert) checkOffset(offset, 1, this.length);
    	  if (!(this[offset] & 0x80)) return (this[offset])
    	  return ((0xff - this[offset] + 1) * -1)
    	};

    	Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
    	  if (!noAssert) checkOffset(offset, 2, this.length);
    	  var val = this[offset] | (this[offset + 1] << 8);
    	  return (val & 0x8000) ? val | 0xFFFF0000 : val
    	};

    	Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
    	  if (!noAssert) checkOffset(offset, 2, this.length);
    	  var val = this[offset + 1] | (this[offset] << 8);
    	  return (val & 0x8000) ? val | 0xFFFF0000 : val
    	};

    	Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
    	  if (!noAssert) checkOffset(offset, 4, this.length);

    	  return (this[offset]) |
    	    (this[offset + 1] << 8) |
    	    (this[offset + 2] << 16) |
    	    (this[offset + 3] << 24)
    	};

    	Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
    	  if (!noAssert) checkOffset(offset, 4, this.length);

    	  return (this[offset] << 24) |
    	    (this[offset + 1] << 16) |
    	    (this[offset + 2] << 8) |
    	    (this[offset + 3])
    	};

    	Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
    	  if (!noAssert) checkOffset(offset, 4, this.length);
    	  return ieee754.read(this, offset, true, 23, 4)
    	};

    	Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
    	  if (!noAssert) checkOffset(offset, 4, this.length);
    	  return ieee754.read(this, offset, false, 23, 4)
    	};

    	Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
    	  if (!noAssert) checkOffset(offset, 8, this.length);
    	  return ieee754.read(this, offset, true, 52, 8)
    	};

    	Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
    	  if (!noAssert) checkOffset(offset, 8, this.length);
    	  return ieee754.read(this, offset, false, 52, 8)
    	};

    	function checkInt (buf, value, offset, ext, max, min) {
    	  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
    	  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
    	  if (offset + ext > buf.length) throw new RangeError('Index out of range')
    	}

    	Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
    	  value = +value;
    	  offset = offset | 0;
    	  byteLength = byteLength | 0;
    	  if (!noAssert) {
    	    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
    	    checkInt(this, value, offset, byteLength, maxBytes, 0);
    	  }

    	  var mul = 1;
    	  var i = 0;
    	  this[offset] = value & 0xFF;
    	  while (++i < byteLength && (mul *= 0x100)) {
    	    this[offset + i] = (value / mul) & 0xFF;
    	  }

    	  return offset + byteLength
    	};

    	Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
    	  value = +value;
    	  offset = offset | 0;
    	  byteLength = byteLength | 0;
    	  if (!noAssert) {
    	    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
    	    checkInt(this, value, offset, byteLength, maxBytes, 0);
    	  }

    	  var i = byteLength - 1;
    	  var mul = 1;
    	  this[offset + i] = value & 0xFF;
    	  while (--i >= 0 && (mul *= 0x100)) {
    	    this[offset + i] = (value / mul) & 0xFF;
    	  }

    	  return offset + byteLength
    	};

    	Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
    	  value = +value;
    	  offset = offset | 0;
    	  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
    	  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
    	  this[offset] = (value & 0xff);
    	  return offset + 1
    	};

    	function objectWriteUInt16 (buf, value, offset, littleEndian) {
    	  if (value < 0) value = 0xffff + value + 1;
    	  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    	    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
    	      (littleEndian ? i : 1 - i) * 8;
    	  }
    	}

    	Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
    	  value = +value;
    	  offset = offset | 0;
    	  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
    	  if (Buffer.TYPED_ARRAY_SUPPORT) {
    	    this[offset] = (value & 0xff);
    	    this[offset + 1] = (value >>> 8);
    	  } else {
    	    objectWriteUInt16(this, value, offset, true);
    	  }
    	  return offset + 2
    	};

    	Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
    	  value = +value;
    	  offset = offset | 0;
    	  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
    	  if (Buffer.TYPED_ARRAY_SUPPORT) {
    	    this[offset] = (value >>> 8);
    	    this[offset + 1] = (value & 0xff);
    	  } else {
    	    objectWriteUInt16(this, value, offset, false);
    	  }
    	  return offset + 2
    	};

    	function objectWriteUInt32 (buf, value, offset, littleEndian) {
    	  if (value < 0) value = 0xffffffff + value + 1;
    	  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    	    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff;
    	  }
    	}

    	Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
    	  value = +value;
    	  offset = offset | 0;
    	  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
    	  if (Buffer.TYPED_ARRAY_SUPPORT) {
    	    this[offset + 3] = (value >>> 24);
    	    this[offset + 2] = (value >>> 16);
    	    this[offset + 1] = (value >>> 8);
    	    this[offset] = (value & 0xff);
    	  } else {
    	    objectWriteUInt32(this, value, offset, true);
    	  }
    	  return offset + 4
    	};

    	Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
    	  value = +value;
    	  offset = offset | 0;
    	  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
    	  if (Buffer.TYPED_ARRAY_SUPPORT) {
    	    this[offset] = (value >>> 24);
    	    this[offset + 1] = (value >>> 16);
    	    this[offset + 2] = (value >>> 8);
    	    this[offset + 3] = (value & 0xff);
    	  } else {
    	    objectWriteUInt32(this, value, offset, false);
    	  }
    	  return offset + 4
    	};

    	Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
    	  value = +value;
    	  offset = offset | 0;
    	  if (!noAssert) {
    	    var limit = Math.pow(2, 8 * byteLength - 1);

    	    checkInt(this, value, offset, byteLength, limit - 1, -limit);
    	  }

    	  var i = 0;
    	  var mul = 1;
    	  var sub = 0;
    	  this[offset] = value & 0xFF;
    	  while (++i < byteLength && (mul *= 0x100)) {
    	    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
    	      sub = 1;
    	    }
    	    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
    	  }

    	  return offset + byteLength
    	};

    	Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
    	  value = +value;
    	  offset = offset | 0;
    	  if (!noAssert) {
    	    var limit = Math.pow(2, 8 * byteLength - 1);

    	    checkInt(this, value, offset, byteLength, limit - 1, -limit);
    	  }

    	  var i = byteLength - 1;
    	  var mul = 1;
    	  var sub = 0;
    	  this[offset + i] = value & 0xFF;
    	  while (--i >= 0 && (mul *= 0x100)) {
    	    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
    	      sub = 1;
    	    }
    	    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
    	  }

    	  return offset + byteLength
    	};

    	Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
    	  value = +value;
    	  offset = offset | 0;
    	  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
    	  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
    	  if (value < 0) value = 0xff + value + 1;
    	  this[offset] = (value & 0xff);
    	  return offset + 1
    	};

    	Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
    	  value = +value;
    	  offset = offset | 0;
    	  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
    	  if (Buffer.TYPED_ARRAY_SUPPORT) {
    	    this[offset] = (value & 0xff);
    	    this[offset + 1] = (value >>> 8);
    	  } else {
    	    objectWriteUInt16(this, value, offset, true);
    	  }
    	  return offset + 2
    	};

    	Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
    	  value = +value;
    	  offset = offset | 0;
    	  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
    	  if (Buffer.TYPED_ARRAY_SUPPORT) {
    	    this[offset] = (value >>> 8);
    	    this[offset + 1] = (value & 0xff);
    	  } else {
    	    objectWriteUInt16(this, value, offset, false);
    	  }
    	  return offset + 2
    	};

    	Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
    	  value = +value;
    	  offset = offset | 0;
    	  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
    	  if (Buffer.TYPED_ARRAY_SUPPORT) {
    	    this[offset] = (value & 0xff);
    	    this[offset + 1] = (value >>> 8);
    	    this[offset + 2] = (value >>> 16);
    	    this[offset + 3] = (value >>> 24);
    	  } else {
    	    objectWriteUInt32(this, value, offset, true);
    	  }
    	  return offset + 4
    	};

    	Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
    	  value = +value;
    	  offset = offset | 0;
    	  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
    	  if (value < 0) value = 0xffffffff + value + 1;
    	  if (Buffer.TYPED_ARRAY_SUPPORT) {
    	    this[offset] = (value >>> 24);
    	    this[offset + 1] = (value >>> 16);
    	    this[offset + 2] = (value >>> 8);
    	    this[offset + 3] = (value & 0xff);
    	  } else {
    	    objectWriteUInt32(this, value, offset, false);
    	  }
    	  return offset + 4
    	};

    	function checkIEEE754 (buf, value, offset, ext, max, min) {
    	  if (offset + ext > buf.length) throw new RangeError('Index out of range')
    	  if (offset < 0) throw new RangeError('Index out of range')
    	}

    	function writeFloat (buf, value, offset, littleEndian, noAssert) {
    	  if (!noAssert) {
    	    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38);
    	  }
    	  ieee754.write(buf, value, offset, littleEndian, 23, 4);
    	  return offset + 4
    	}

    	Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
    	  return writeFloat(this, value, offset, true, noAssert)
    	};

    	Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
    	  return writeFloat(this, value, offset, false, noAssert)
    	};

    	function writeDouble (buf, value, offset, littleEndian, noAssert) {
    	  if (!noAssert) {
    	    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308);
    	  }
    	  ieee754.write(buf, value, offset, littleEndian, 52, 8);
    	  return offset + 8
    	}

    	Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
    	  return writeDouble(this, value, offset, true, noAssert)
    	};

    	Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
    	  return writeDouble(this, value, offset, false, noAssert)
    	};

    	// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
    	Buffer.prototype.copy = function copy (target, targetStart, start, end) {
    	  if (!start) start = 0;
    	  if (!end && end !== 0) end = this.length;
    	  if (targetStart >= target.length) targetStart = target.length;
    	  if (!targetStart) targetStart = 0;
    	  if (end > 0 && end < start) end = start;

    	  // Copy 0 bytes; we're done
    	  if (end === start) return 0
    	  if (target.length === 0 || this.length === 0) return 0

    	  // Fatal error conditions
    	  if (targetStart < 0) {
    	    throw new RangeError('targetStart out of bounds')
    	  }
    	  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
    	  if (end < 0) throw new RangeError('sourceEnd out of bounds')

    	  // Are we oob?
    	  if (end > this.length) end = this.length;
    	  if (target.length - targetStart < end - start) {
    	    end = target.length - targetStart + start;
    	  }

    	  var len = end - start;
    	  var i;

    	  if (this === target && start < targetStart && targetStart < end) {
    	    // descending copy from end
    	    for (i = len - 1; i >= 0; --i) {
    	      target[i + targetStart] = this[i + start];
    	    }
    	  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    	    // ascending copy from start
    	    for (i = 0; i < len; ++i) {
    	      target[i + targetStart] = this[i + start];
    	    }
    	  } else {
    	    Uint8Array.prototype.set.call(
    	      target,
    	      this.subarray(start, start + len),
    	      targetStart
    	    );
    	  }

    	  return len
    	};

    	// Usage:
    	//    buffer.fill(number[, offset[, end]])
    	//    buffer.fill(buffer[, offset[, end]])
    	//    buffer.fill(string[, offset[, end]][, encoding])
    	Buffer.prototype.fill = function fill (val, start, end, encoding) {
    	  // Handle string cases:
    	  if (typeof val === 'string') {
    	    if (typeof start === 'string') {
    	      encoding = start;
    	      start = 0;
    	      end = this.length;
    	    } else if (typeof end === 'string') {
    	      encoding = end;
    	      end = this.length;
    	    }
    	    if (val.length === 1) {
    	      var code = val.charCodeAt(0);
    	      if (code < 256) {
    	        val = code;
    	      }
    	    }
    	    if (encoding !== undefined && typeof encoding !== 'string') {
    	      throw new TypeError('encoding must be a string')
    	    }
    	    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
    	      throw new TypeError('Unknown encoding: ' + encoding)
    	    }
    	  } else if (typeof val === 'number') {
    	    val = val & 255;
    	  }

    	  // Invalid ranges are not set to a default, so can range check early.
    	  if (start < 0 || this.length < start || this.length < end) {
    	    throw new RangeError('Out of range index')
    	  }

    	  if (end <= start) {
    	    return this
    	  }

    	  start = start >>> 0;
    	  end = end === undefined ? this.length : end >>> 0;

    	  if (!val) val = 0;

    	  var i;
    	  if (typeof val === 'number') {
    	    for (i = start; i < end; ++i) {
    	      this[i] = val;
    	    }
    	  } else {
    	    var bytes = Buffer.isBuffer(val)
    	      ? val
    	      : utf8ToBytes(new Buffer(val, encoding).toString());
    	    var len = bytes.length;
    	    for (i = 0; i < end - start; ++i) {
    	      this[i + start] = bytes[i % len];
    	    }
    	  }

    	  return this
    	};

    	// HELPER FUNCTIONS
    	// ================

    	var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;

    	function base64clean (str) {
    	  // Node strips out invalid characters like \n and \t from the string, base64-js does not
    	  str = stringtrim(str).replace(INVALID_BASE64_RE, '');
    	  // Node converts strings with length < 2 to ''
    	  if (str.length < 2) return ''
    	  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
    	  while (str.length % 4 !== 0) {
    	    str = str + '=';
    	  }
    	  return str
    	}

    	function stringtrim (str) {
    	  if (str.trim) return str.trim()
    	  return str.replace(/^\s+|\s+$/g, '')
    	}

    	function toHex (n) {
    	  if (n < 16) return '0' + n.toString(16)
    	  return n.toString(16)
    	}

    	function utf8ToBytes (string, units) {
    	  units = units || Infinity;
    	  var codePoint;
    	  var length = string.length;
    	  var leadSurrogate = null;
    	  var bytes = [];

    	  for (var i = 0; i < length; ++i) {
    	    codePoint = string.charCodeAt(i);

    	    // is surrogate component
    	    if (codePoint > 0xD7FF && codePoint < 0xE000) {
    	      // last char was a lead
    	      if (!leadSurrogate) {
    	        // no lead yet
    	        if (codePoint > 0xDBFF) {
    	          // unexpected trail
    	          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
    	          continue
    	        } else if (i + 1 === length) {
    	          // unpaired lead
    	          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
    	          continue
    	        }

    	        // valid lead
    	        leadSurrogate = codePoint;

    	        continue
    	      }

    	      // 2 leads in a row
    	      if (codePoint < 0xDC00) {
    	        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
    	        leadSurrogate = codePoint;
    	        continue
    	      }

    	      // valid surrogate pair
    	      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
    	    } else if (leadSurrogate) {
    	      // valid bmp char, but last char was a lead
    	      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
    	    }

    	    leadSurrogate = null;

    	    // encode utf8
    	    if (codePoint < 0x80) {
    	      if ((units -= 1) < 0) break
    	      bytes.push(codePoint);
    	    } else if (codePoint < 0x800) {
    	      if ((units -= 2) < 0) break
    	      bytes.push(
    	        codePoint >> 0x6 | 0xC0,
    	        codePoint & 0x3F | 0x80
    	      );
    	    } else if (codePoint < 0x10000) {
    	      if ((units -= 3) < 0) break
    	      bytes.push(
    	        codePoint >> 0xC | 0xE0,
    	        codePoint >> 0x6 & 0x3F | 0x80,
    	        codePoint & 0x3F | 0x80
    	      );
    	    } else if (codePoint < 0x110000) {
    	      if ((units -= 4) < 0) break
    	      bytes.push(
    	        codePoint >> 0x12 | 0xF0,
    	        codePoint >> 0xC & 0x3F | 0x80,
    	        codePoint >> 0x6 & 0x3F | 0x80,
    	        codePoint & 0x3F | 0x80
    	      );
    	    } else {
    	      throw new Error('Invalid code point')
    	    }
    	  }

    	  return bytes
    	}

    	function asciiToBytes (str) {
    	  var byteArray = [];
    	  for (var i = 0; i < str.length; ++i) {
    	    // Node's code seems to be doing this and not & 0x7F..
    	    byteArray.push(str.charCodeAt(i) & 0xFF);
    	  }
    	  return byteArray
    	}

    	function utf16leToBytes (str, units) {
    	  var c, hi, lo;
    	  var byteArray = [];
    	  for (var i = 0; i < str.length; ++i) {
    	    if ((units -= 2) < 0) break

    	    c = str.charCodeAt(i);
    	    hi = c >> 8;
    	    lo = c % 256;
    	    byteArray.push(lo);
    	    byteArray.push(hi);
    	  }

    	  return byteArray
    	}

    	function base64ToBytes (str) {
    	  return base64.toByteArray(base64clean(str))
    	}

    	function blitBuffer (src, dst, offset, length) {
    	  for (var i = 0; i < length; ++i) {
    	    if ((i + offset >= dst.length) || (i >= src.length)) break
    	    dst[i + offset] = src[i];
    	  }
    	  return i
    	}

    	function isnan (val) {
    	  return val !== val // eslint-disable-line no-self-compare
    	}


    /***/ }),
    /* 59 */
    /***/ (function(module, exports) {

    	exports.byteLength = byteLength;
    	exports.toByteArray = toByteArray;
    	exports.fromByteArray = fromByteArray;

    	var lookup = [];
    	var revLookup = [];
    	var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;

    	var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    	for (var i = 0, len = code.length; i < len; ++i) {
    	  lookup[i] = code[i];
    	  revLookup[code.charCodeAt(i)] = i;
    	}

    	// Support decoding URL-safe base64 strings, as Node.js does.
    	// See: https://en.wikipedia.org/wiki/Base64#URL_applications
    	revLookup['-'.charCodeAt(0)] = 62;
    	revLookup['_'.charCodeAt(0)] = 63;

    	function getLens (b64) {
    	  var len = b64.length;

    	  if (len % 4 > 0) {
    	    throw new Error('Invalid string. Length must be a multiple of 4')
    	  }

    	  // Trim off extra bytes after placeholder bytes are found
    	  // See: https://github.com/beatgammit/base64-js/issues/42
    	  var validLen = b64.indexOf('=');
    	  if (validLen === -1) validLen = len;

    	  var placeHoldersLen = validLen === len
    	    ? 0
    	    : 4 - (validLen % 4);

    	  return [validLen, placeHoldersLen]
    	}

    	// base64 is 4/3 + up to two characters of the original data
    	function byteLength (b64) {
    	  var lens = getLens(b64);
    	  var validLen = lens[0];
    	  var placeHoldersLen = lens[1];
    	  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
    	}

    	function _byteLength (b64, validLen, placeHoldersLen) {
    	  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
    	}

    	function toByteArray (b64) {
    	  var tmp;
    	  var lens = getLens(b64);
    	  var validLen = lens[0];
    	  var placeHoldersLen = lens[1];

    	  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));

    	  var curByte = 0;

    	  // if there are placeholders, only get up to the last complete 4 chars
    	  var len = placeHoldersLen > 0
    	    ? validLen - 4
    	    : validLen;

    	  for (var i = 0; i < len; i += 4) {
    	    tmp =
    	      (revLookup[b64.charCodeAt(i)] << 18) |
    	      (revLookup[b64.charCodeAt(i + 1)] << 12) |
    	      (revLookup[b64.charCodeAt(i + 2)] << 6) |
    	      revLookup[b64.charCodeAt(i + 3)];
    	    arr[curByte++] = (tmp >> 16) & 0xFF;
    	    arr[curByte++] = (tmp >> 8) & 0xFF;
    	    arr[curByte++] = tmp & 0xFF;
    	  }

    	  if (placeHoldersLen === 2) {
    	    tmp =
    	      (revLookup[b64.charCodeAt(i)] << 2) |
    	      (revLookup[b64.charCodeAt(i + 1)] >> 4);
    	    arr[curByte++] = tmp & 0xFF;
    	  }

    	  if (placeHoldersLen === 1) {
    	    tmp =
    	      (revLookup[b64.charCodeAt(i)] << 10) |
    	      (revLookup[b64.charCodeAt(i + 1)] << 4) |
    	      (revLookup[b64.charCodeAt(i + 2)] >> 2);
    	    arr[curByte++] = (tmp >> 8) & 0xFF;
    	    arr[curByte++] = tmp & 0xFF;
    	  }

    	  return arr
    	}

    	function tripletToBase64 (num) {
    	  return lookup[num >> 18 & 0x3F] +
    	    lookup[num >> 12 & 0x3F] +
    	    lookup[num >> 6 & 0x3F] +
    	    lookup[num & 0x3F]
    	}

    	function encodeChunk (uint8, start, end) {
    	  var tmp;
    	  var output = [];
    	  for (var i = start; i < end; i += 3) {
    	    tmp =
    	      ((uint8[i] << 16) & 0xFF0000) +
    	      ((uint8[i + 1] << 8) & 0xFF00) +
    	      (uint8[i + 2] & 0xFF);
    	    output.push(tripletToBase64(tmp));
    	  }
    	  return output.join('')
    	}

    	function fromByteArray (uint8) {
    	  var tmp;
    	  var len = uint8.length;
    	  var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
    	  var parts = [];
    	  var maxChunkLength = 16383; // must be multiple of 3

    	  // go through the array every three bytes, we'll deal with trailing stuff later
    	  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    	    parts.push(encodeChunk(
    	      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    	    ));
    	  }

    	  // pad the end with zeros, but make sure to not forget the extra bytes
    	  if (extraBytes === 1) {
    	    tmp = uint8[len - 1];
    	    parts.push(
    	      lookup[tmp >> 2] +
    	      lookup[(tmp << 4) & 0x3F] +
    	      '=='
    	    );
    	  } else if (extraBytes === 2) {
    	    tmp = (uint8[len - 2] << 8) + uint8[len - 1];
    	    parts.push(
    	      lookup[tmp >> 10] +
    	      lookup[(tmp >> 4) & 0x3F] +
    	      lookup[(tmp << 2) & 0x3F] +
    	      '='
    	    );
    	  }

    	  return parts.join('')
    	}


    /***/ }),
    /* 60 */
    /***/ (function(module, exports) {

    	exports.read = function (buffer, offset, isLE, mLen, nBytes) {
    	  var e, m;
    	  var eLen = (nBytes * 8) - mLen - 1;
    	  var eMax = (1 << eLen) - 1;
    	  var eBias = eMax >> 1;
    	  var nBits = -7;
    	  var i = isLE ? (nBytes - 1) : 0;
    	  var d = isLE ? -1 : 1;
    	  var s = buffer[offset + i];

    	  i += d;

    	  e = s & ((1 << (-nBits)) - 1);
    	  s >>= (-nBits);
    	  nBits += eLen;
    	  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

    	  m = e & ((1 << (-nBits)) - 1);
    	  e >>= (-nBits);
    	  nBits += mLen;
    	  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

    	  if (e === 0) {
    	    e = 1 - eBias;
    	  } else if (e === eMax) {
    	    return m ? NaN : ((s ? -1 : 1) * Infinity)
    	  } else {
    	    m = m + Math.pow(2, mLen);
    	    e = e - eBias;
    	  }
    	  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
    	};

    	exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
    	  var e, m, c;
    	  var eLen = (nBytes * 8) - mLen - 1;
    	  var eMax = (1 << eLen) - 1;
    	  var eBias = eMax >> 1;
    	  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
    	  var i = isLE ? 0 : (nBytes - 1);
    	  var d = isLE ? 1 : -1;
    	  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

    	  value = Math.abs(value);

    	  if (isNaN(value) || value === Infinity) {
    	    m = isNaN(value) ? 1 : 0;
    	    e = eMax;
    	  } else {
    	    e = Math.floor(Math.log(value) / Math.LN2);
    	    if (value * (c = Math.pow(2, -e)) < 1) {
    	      e--;
    	      c *= 2;
    	    }
    	    if (e + eBias >= 1) {
    	      value += rt / c;
    	    } else {
    	      value += rt * Math.pow(2, 1 - eBias);
    	    }
    	    if (value * c >= 2) {
    	      e++;
    	      c /= 2;
    	    }

    	    if (e + eBias >= eMax) {
    	      m = 0;
    	      e = eMax;
    	    } else if (e + eBias >= 1) {
    	      m = ((value * c) - 1) * Math.pow(2, mLen);
    	      e = e + eBias;
    	    } else {
    	      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
    	      e = 0;
    	    }
    	  }

    	  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

    	  e = (e << mLen) | m;
    	  eLen += mLen;
    	  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

    	  buffer[offset + i - d] |= s * 128;
    	};


    /***/ }),
    /* 61 */
    /***/ (function(module, exports) {

    	var toString = {}.toString;

    	module.exports = Array.isArray || function (arr) {
    	  return toString.call(arr) == '[object Array]';
    	};


    /***/ }),
    /* 62 */
    /***/ (function(module, exports, __webpack_require__) {
    	var __extends = (this && this.__extends) || function (d, b) {
    	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    	    function __() { this.constructor = d; }
    	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    	};
    	var dispatcher_1 = __webpack_require__(24);
    	var timers_1 = __webpack_require__(12);
    	var logger_1 = __webpack_require__(8);
    	var Collections = __webpack_require__(9);
    	var runtime_1 = __webpack_require__(2);
    	var ConnectionManager = (function (_super) {
    	    __extends(ConnectionManager, _super);
    	    function ConnectionManager(key, options) {
    	        var _this = this;
    	        _super.call(this);
    	        this.key = key;
    	        this.options = options || {};
    	        this.state = "initialized";
    	        this.connection = null;
    	        this.usingTLS = !!options.useTLS;
    	        this.timeline = this.options.timeline;
    	        this.errorCallbacks = this.buildErrorCallbacks();
    	        this.connectionCallbacks = this.buildConnectionCallbacks(this.errorCallbacks);
    	        this.handshakeCallbacks = this.buildHandshakeCallbacks(this.errorCallbacks);
    	        var Network = runtime_1["default"].getNetwork();
    	        Network.bind("online", function () {
    	            _this.timeline.info({ netinfo: "online" });
    	            if (_this.state === "connecting" || _this.state === "unavailable") {
    	                _this.retryIn(0);
    	            }
    	        });
    	        Network.bind("offline", function () {
    	            _this.timeline.info({ netinfo: "offline" });
    	            if (_this.connection) {
    	                _this.sendActivityCheck();
    	            }
    	        });
    	        this.updateStrategy();
    	    }
    	    ConnectionManager.prototype.connect = function () {
    	        if (this.connection || this.runner) {
    	            return;
    	        }
    	        if (!this.strategy.isSupported()) {
    	            this.updateState("failed");
    	            return;
    	        }
    	        this.updateState("connecting");
    	        this.startConnecting();
    	        this.setUnavailableTimer();
    	    };
    	    ConnectionManager.prototype.send = function (data) {
    	        if (this.connection) {
    	            return this.connection.send(data);
    	        }
    	        else {
    	            return false;
    	        }
    	    };
    	    ConnectionManager.prototype.send_event = function (name, data, channel) {
    	        if (this.connection) {
    	            return this.connection.send_event(name, data, channel);
    	        }
    	        else {
    	            return false;
    	        }
    	    };
    	    ConnectionManager.prototype.disconnect = function () {
    	        this.disconnectInternally();
    	        this.updateState("disconnected");
    	    };
    	    ConnectionManager.prototype.isUsingTLS = function () {
    	        return this.usingTLS;
    	    };
    	    ConnectionManager.prototype.startConnecting = function () {
    	        var _this = this;
    	        var callback = function (error, handshake) {
    	            if (error) {
    	                _this.runner = _this.strategy.connect(0, callback);
    	            }
    	            else {
    	                if (handshake.action === "error") {
    	                    _this.emit("error", { type: "HandshakeError", error: handshake.error });
    	                    _this.timeline.error({ handshakeError: handshake.error });
    	                }
    	                else {
    	                    _this.abortConnecting();
    	                    _this.handshakeCallbacks[handshake.action](handshake);
    	                }
    	            }
    	        };
    	        this.runner = this.strategy.connect(0, callback);
    	    };
    	    ConnectionManager.prototype.abortConnecting = function () {
    	        if (this.runner) {
    	            this.runner.abort();
    	            this.runner = null;
    	        }
    	    };
    	    ConnectionManager.prototype.disconnectInternally = function () {
    	        this.abortConnecting();
    	        this.clearRetryTimer();
    	        this.clearUnavailableTimer();
    	        if (this.connection) {
    	            var connection = this.abandonConnection();
    	            connection.close();
    	        }
    	    };
    	    ConnectionManager.prototype.updateStrategy = function () {
    	        this.strategy = this.options.getStrategy({
    	            key: this.key,
    	            timeline: this.timeline,
    	            useTLS: this.usingTLS
    	        });
    	    };
    	    ConnectionManager.prototype.retryIn = function (delay) {
    	        var _this = this;
    	        this.timeline.info({ action: "retry", delay: delay });
    	        if (delay > 0) {
    	            this.emit("connecting_in", Math.round(delay / 1000));
    	        }
    	        this.retryTimer = new timers_1.OneOffTimer(delay || 0, function () {
    	            _this.disconnectInternally();
    	            _this.connect();
    	        });
    	    };
    	    ConnectionManager.prototype.clearRetryTimer = function () {
    	        if (this.retryTimer) {
    	            this.retryTimer.ensureAborted();
    	            this.retryTimer = null;
    	        }
    	    };
    	    ConnectionManager.prototype.setUnavailableTimer = function () {
    	        var _this = this;
    	        this.unavailableTimer = new timers_1.OneOffTimer(this.options.unavailableTimeout, function () {
    	            _this.updateState("unavailable");
    	        });
    	    };
    	    ConnectionManager.prototype.clearUnavailableTimer = function () {
    	        if (this.unavailableTimer) {
    	            this.unavailableTimer.ensureAborted();
    	        }
    	    };
    	    ConnectionManager.prototype.sendActivityCheck = function () {
    	        var _this = this;
    	        this.stopActivityCheck();
    	        this.connection.ping();
    	        this.activityTimer = new timers_1.OneOffTimer(this.options.pongTimeout, function () {
    	            _this.timeline.error({ pong_timed_out: _this.options.pongTimeout });
    	            _this.retryIn(0);
    	        });
    	    };
    	    ConnectionManager.prototype.resetActivityCheck = function () {
    	        var _this = this;
    	        this.stopActivityCheck();
    	        if (this.connection && !this.connection.handlesActivityChecks()) {
    	            this.activityTimer = new timers_1.OneOffTimer(this.activityTimeout, function () {
    	                _this.sendActivityCheck();
    	            });
    	        }
    	    };
    	    ConnectionManager.prototype.stopActivityCheck = function () {
    	        if (this.activityTimer) {
    	            this.activityTimer.ensureAborted();
    	        }
    	    };
    	    ConnectionManager.prototype.buildConnectionCallbacks = function (errorCallbacks) {
    	        var _this = this;
    	        return Collections.extend({}, errorCallbacks, {
    	            message: function (message) {
    	                _this.resetActivityCheck();
    	                _this.emit('message', message);
    	            },
    	            ping: function () {
    	                _this.send_event('pusher:pong', {});
    	            },
    	            activity: function () {
    	                _this.resetActivityCheck();
    	            },
    	            error: function (error) {
    	                _this.emit("error", { type: "WebSocketError", error: error });
    	            },
    	            closed: function () {
    	                _this.abandonConnection();
    	                if (_this.shouldRetry()) {
    	                    _this.retryIn(1000);
    	                }
    	            }
    	        });
    	    };
    	    ConnectionManager.prototype.buildHandshakeCallbacks = function (errorCallbacks) {
    	        var _this = this;
    	        return Collections.extend({}, errorCallbacks, {
    	            connected: function (handshake) {
    	                _this.activityTimeout = Math.min(_this.options.activityTimeout, handshake.activityTimeout, handshake.connection.activityTimeout || Infinity);
    	                _this.clearUnavailableTimer();
    	                _this.setConnection(handshake.connection);
    	                _this.socket_id = _this.connection.id;
    	                _this.updateState("connected", { socket_id: _this.socket_id });
    	            }
    	        });
    	    };
    	    ConnectionManager.prototype.buildErrorCallbacks = function () {
    	        var _this = this;
    	        var withErrorEmitted = function (callback) {
    	            return function (result) {
    	                if (result.error) {
    	                    _this.emit("error", { type: "WebSocketError", error: result.error });
    	                }
    	                callback(result);
    	            };
    	        };
    	        return {
    	            tls_only: withErrorEmitted(function () {
    	                _this.usingTLS = true;
    	                _this.updateStrategy();
    	                _this.retryIn(0);
    	            }),
    	            refused: withErrorEmitted(function () {
    	                _this.disconnect();
    	            }),
    	            backoff: withErrorEmitted(function () {
    	                _this.retryIn(1000);
    	            }),
    	            retry: withErrorEmitted(function () {
    	                _this.retryIn(0);
    	            })
    	        };
    	    };
    	    ConnectionManager.prototype.setConnection = function (connection) {
    	        this.connection = connection;
    	        for (var event in this.connectionCallbacks) {
    	            this.connection.bind(event, this.connectionCallbacks[event]);
    	        }
    	        this.resetActivityCheck();
    	    };
    	    ConnectionManager.prototype.abandonConnection = function () {
    	        if (!this.connection) {
    	            return;
    	        }
    	        this.stopActivityCheck();
    	        for (var event in this.connectionCallbacks) {
    	            this.connection.unbind(event, this.connectionCallbacks[event]);
    	        }
    	        var connection = this.connection;
    	        this.connection = null;
    	        return connection;
    	    };
    	    ConnectionManager.prototype.updateState = function (newState, data) {
    	        var previousState = this.state;
    	        this.state = newState;
    	        if (previousState !== newState) {
    	            var newStateDescription = newState;
    	            if (newStateDescription === "connected") {
    	                newStateDescription += " with new socket ID " + data.socket_id;
    	            }
    	            logger_1["default"].debug('State changed', previousState + ' -> ' + newStateDescription);
    	            this.timeline.info({ state: newState, params: data });
    	            this.emit('state_change', { previous: previousState, current: newState });
    	            this.emit(newState, data);
    	        }
    	    };
    	    ConnectionManager.prototype.shouldRetry = function () {
    	        return this.state === "connecting" || this.state === "connected";
    	    };
    	    return ConnectionManager;
    	}(dispatcher_1["default"]));
    	exports.__esModule = true;
    	exports["default"] = ConnectionManager;


    /***/ }),
    /* 63 */
    /***/ (function(module, exports, __webpack_require__) {
    	var Collections = __webpack_require__(9);
    	var factory_1 = __webpack_require__(43);
    	var Errors = __webpack_require__(31);
    	var Channels = (function () {
    	    function Channels() {
    	        this.channels = {};
    	    }
    	    Channels.prototype.add = function (name, pusher) {
    	        if (!this.channels[name]) {
    	            this.channels[name] = createChannel(name, pusher);
    	        }
    	        return this.channels[name];
    	    };
    	    Channels.prototype.all = function () {
    	        return Collections.values(this.channels);
    	    };
    	    Channels.prototype.find = function (name) {
    	        return this.channels[name];
    	    };
    	    Channels.prototype.remove = function (name) {
    	        var channel = this.channels[name];
    	        delete this.channels[name];
    	        return channel;
    	    };
    	    Channels.prototype.disconnect = function () {
    	        Collections.objectApply(this.channels, function (channel) {
    	            channel.disconnect();
    	        });
    	    };
    	    return Channels;
    	}());
    	exports.__esModule = true;
    	exports["default"] = Channels;
    	function createChannel(name, pusher) {
    	    if (name.indexOf('private-encrypted-') === 0) {
    	        if (navigator.product == "ReactNative") {
    	            var errorMsg = "Encrypted channels are not yet supported when using React Native builds.";
    	            throw new Errors.UnsupportedFeature(errorMsg);
    	        }
    	        return factory_1["default"].createEncryptedChannel(name, pusher);
    	    }
    	    else if (name.indexOf('private-') === 0) {
    	        return factory_1["default"].createPrivateChannel(name, pusher);
    	    }
    	    else if (name.indexOf('presence-') === 0) {
    	        return factory_1["default"].createPresenceChannel(name, pusher);
    	    }
    	    else {
    	        return factory_1["default"].createChannel(name, pusher);
    	    }
    	}


    /***/ }),
    /* 64 */
    /***/ (function(module, exports, __webpack_require__) {
    	var factory_1 = __webpack_require__(43);
    	var util_1 = __webpack_require__(11);
    	var Errors = __webpack_require__(31);
    	var Collections = __webpack_require__(9);
    	var TransportStrategy = (function () {
    	    function TransportStrategy(name, priority, transport, options) {
    	        this.name = name;
    	        this.priority = priority;
    	        this.transport = transport;
    	        this.options = options || {};
    	    }
    	    TransportStrategy.prototype.isSupported = function () {
    	        return this.transport.isSupported({
    	            useTLS: this.options.useTLS
    	        });
    	    };
    	    TransportStrategy.prototype.connect = function (minPriority, callback) {
    	        var _this = this;
    	        if (!this.isSupported()) {
    	            return failAttempt(new Errors.UnsupportedStrategy(), callback);
    	        }
    	        else if (this.priority < minPriority) {
    	            return failAttempt(new Errors.TransportPriorityTooLow(), callback);
    	        }
    	        var connected = false;
    	        var transport = this.transport.createConnection(this.name, this.priority, this.options.key, this.options);
    	        var handshake = null;
    	        var onInitialized = function () {
    	            transport.unbind("initialized", onInitialized);
    	            transport.connect();
    	        };
    	        var onOpen = function () {
    	            handshake = factory_1["default"].createHandshake(transport, function (result) {
    	                connected = true;
    	                unbindListeners();
    	                callback(null, result);
    	            });
    	        };
    	        var onError = function (error) {
    	            unbindListeners();
    	            callback(error);
    	        };
    	        var onClosed = function () {
    	            unbindListeners();
    	            var serializedTransport;
    	            serializedTransport = Collections.safeJSONStringify(transport);
    	            callback(new Errors.TransportClosed(serializedTransport));
    	        };
    	        var unbindListeners = function () {
    	            transport.unbind("initialized", onInitialized);
    	            transport.unbind("open", onOpen);
    	            transport.unbind("error", onError);
    	            transport.unbind("closed", onClosed);
    	        };
    	        transport.bind("initialized", onInitialized);
    	        transport.bind("open", onOpen);
    	        transport.bind("error", onError);
    	        transport.bind("closed", onClosed);
    	        transport.initialize();
    	        return {
    	            abort: function () {
    	                if (connected) {
    	                    return;
    	                }
    	                unbindListeners();
    	                if (handshake) {
    	                    handshake.close();
    	                }
    	                else {
    	                    transport.close();
    	                }
    	            },
    	            forceMinPriority: function (p) {
    	                if (connected) {
    	                    return;
    	                }
    	                if (_this.priority < p) {
    	                    if (handshake) {
    	                        handshake.close();
    	                    }
    	                    else {
    	                        transport.close();
    	                    }
    	                }
    	            }
    	        };
    	    };
    	    return TransportStrategy;
    	}());
    	exports.__esModule = true;
    	exports["default"] = TransportStrategy;
    	function failAttempt(error, callback) {
    	    util_1["default"].defer(function () {
    	        callback(error);
    	    });
    	    return {
    	        abort: function () { },
    	        forceMinPriority: function () { }
    	    };
    	}


    /***/ }),
    /* 65 */
    /***/ (function(module, exports, __webpack_require__) {
    	var Collections = __webpack_require__(9);
    	var util_1 = __webpack_require__(11);
    	var timers_1 = __webpack_require__(12);
    	var SequentialStrategy = (function () {
    	    function SequentialStrategy(strategies, options) {
    	        this.strategies = strategies;
    	        this.loop = Boolean(options.loop);
    	        this.failFast = Boolean(options.failFast);
    	        this.timeout = options.timeout;
    	        this.timeoutLimit = options.timeoutLimit;
    	    }
    	    SequentialStrategy.prototype.isSupported = function () {
    	        return Collections.any(this.strategies, util_1["default"].method("isSupported"));
    	    };
    	    SequentialStrategy.prototype.connect = function (minPriority, callback) {
    	        var _this = this;
    	        var strategies = this.strategies;
    	        var current = 0;
    	        var timeout = this.timeout;
    	        var runner = null;
    	        var tryNextStrategy = function (error, handshake) {
    	            if (handshake) {
    	                callback(null, handshake);
    	            }
    	            else {
    	                current = current + 1;
    	                if (_this.loop) {
    	                    current = current % strategies.length;
    	                }
    	                if (current < strategies.length) {
    	                    if (timeout) {
    	                        timeout = timeout * 2;
    	                        if (_this.timeoutLimit) {
    	                            timeout = Math.min(timeout, _this.timeoutLimit);
    	                        }
    	                    }
    	                    runner = _this.tryStrategy(strategies[current], minPriority, { timeout: timeout, failFast: _this.failFast }, tryNextStrategy);
    	                }
    	                else {
    	                    callback(true);
    	                }
    	            }
    	        };
    	        runner = this.tryStrategy(strategies[current], minPriority, { timeout: timeout, failFast: this.failFast }, tryNextStrategy);
    	        return {
    	            abort: function () {
    	                runner.abort();
    	            },
    	            forceMinPriority: function (p) {
    	                minPriority = p;
    	                if (runner) {
    	                    runner.forceMinPriority(p);
    	                }
    	            }
    	        };
    	    };
    	    SequentialStrategy.prototype.tryStrategy = function (strategy, minPriority, options, callback) {
    	        var timer = null;
    	        var runner = null;
    	        if (options.timeout > 0) {
    	            timer = new timers_1.OneOffTimer(options.timeout, function () {
    	                runner.abort();
    	                callback(true);
    	            });
    	        }
    	        runner = strategy.connect(minPriority, function (error, handshake) {
    	            if (error && timer && timer.isRunning() && !options.failFast) {
    	                return;
    	            }
    	            if (timer) {
    	                timer.ensureAborted();
    	            }
    	            callback(error, handshake);
    	        });
    	        return {
    	            abort: function () {
    	                if (timer) {
    	                    timer.ensureAborted();
    	                }
    	                runner.abort();
    	            },
    	            forceMinPriority: function (p) {
    	                runner.forceMinPriority(p);
    	            }
    	        };
    	    };
    	    return SequentialStrategy;
    	}());
    	exports.__esModule = true;
    	exports["default"] = SequentialStrategy;


    /***/ }),
    /* 66 */
    /***/ (function(module, exports, __webpack_require__) {
    	var Collections = __webpack_require__(9);
    	var util_1 = __webpack_require__(11);
    	var BestConnectedEverStrategy = (function () {
    	    function BestConnectedEverStrategy(strategies) {
    	        this.strategies = strategies;
    	    }
    	    BestConnectedEverStrategy.prototype.isSupported = function () {
    	        return Collections.any(this.strategies, util_1["default"].method("isSupported"));
    	    };
    	    BestConnectedEverStrategy.prototype.connect = function (minPriority, callback) {
    	        return connect(this.strategies, minPriority, function (i, runners) {
    	            return function (error, handshake) {
    	                runners[i].error = error;
    	                if (error) {
    	                    if (allRunnersFailed(runners)) {
    	                        callback(true);
    	                    }
    	                    return;
    	                }
    	                Collections.apply(runners, function (runner) {
    	                    runner.forceMinPriority(handshake.transport.priority);
    	                });
    	                callback(null, handshake);
    	            };
    	        });
    	    };
    	    return BestConnectedEverStrategy;
    	}());
    	exports.__esModule = true;
    	exports["default"] = BestConnectedEverStrategy;
    	function connect(strategies, minPriority, callbackBuilder) {
    	    var runners = Collections.map(strategies, function (strategy, i, _, rs) {
    	        return strategy.connect(minPriority, callbackBuilder(i, rs));
    	    });
    	    return {
    	        abort: function () {
    	            Collections.apply(runners, abortRunner);
    	        },
    	        forceMinPriority: function (p) {
    	            Collections.apply(runners, function (runner) {
    	                runner.forceMinPriority(p);
    	            });
    	        }
    	    };
    	}
    	function allRunnersFailed(runners) {
    	    return Collections.all(runners, function (runner) {
    	        return Boolean(runner.error);
    	    });
    	}
    	function abortRunner(runner) {
    	    if (!runner.error && !runner.aborted) {
    	        runner.abort();
    	        runner.aborted = true;
    	    }
    	}


    /***/ }),
    /* 67 */
    /***/ (function(module, exports, __webpack_require__) {
    	var util_1 = __webpack_require__(11);
    	var runtime_1 = __webpack_require__(2);
    	var sequential_strategy_1 = __webpack_require__(65);
    	var Collections = __webpack_require__(9);
    	var CachedStrategy = (function () {
    	    function CachedStrategy(strategy, transports, options) {
    	        this.strategy = strategy;
    	        this.transports = transports;
    	        this.ttl = options.ttl || 1800 * 1000;
    	        this.usingTLS = options.useTLS;
    	        this.timeline = options.timeline;
    	    }
    	    CachedStrategy.prototype.isSupported = function () {
    	        return this.strategy.isSupported();
    	    };
    	    CachedStrategy.prototype.connect = function (minPriority, callback) {
    	        var usingTLS = this.usingTLS;
    	        var info = fetchTransportCache(usingTLS);
    	        var strategies = [this.strategy];
    	        if (info && info.timestamp + this.ttl >= util_1["default"].now()) {
    	            var transport = this.transports[info.transport];
    	            if (transport) {
    	                this.timeline.info({
    	                    cached: true,
    	                    transport: info.transport,
    	                    latency: info.latency
    	                });
    	                strategies.push(new sequential_strategy_1["default"]([transport], {
    	                    timeout: info.latency * 2 + 1000,
    	                    failFast: true
    	                }));
    	            }
    	        }
    	        var startTimestamp = util_1["default"].now();
    	        var runner = strategies.pop().connect(minPriority, function cb(error, handshake) {
    	            if (error) {
    	                flushTransportCache(usingTLS);
    	                if (strategies.length > 0) {
    	                    startTimestamp = util_1["default"].now();
    	                    runner = strategies.pop().connect(minPriority, cb);
    	                }
    	                else {
    	                    callback(error);
    	                }
    	            }
    	            else {
    	                storeTransportCache(usingTLS, handshake.transport.name, util_1["default"].now() - startTimestamp);
    	                callback(null, handshake);
    	            }
    	        });
    	        return {
    	            abort: function () {
    	                runner.abort();
    	            },
    	            forceMinPriority: function (p) {
    	                minPriority = p;
    	                if (runner) {
    	                    runner.forceMinPriority(p);
    	                }
    	            }
    	        };
    	    };
    	    return CachedStrategy;
    	}());
    	exports.__esModule = true;
    	exports["default"] = CachedStrategy;
    	function getTransportCacheKey(usingTLS) {
    	    return "pusherTransport" + (usingTLS ? "TLS" : "NonTLS");
    	}
    	function fetchTransportCache(usingTLS) {
    	    var storage = runtime_1["default"].getLocalStorage();
    	    if (storage) {
    	        try {
    	            var serializedCache = storage[getTransportCacheKey(usingTLS)];
    	            if (serializedCache) {
    	                return JSON.parse(serializedCache);
    	            }
    	        }
    	        catch (e) {
    	            flushTransportCache(usingTLS);
    	        }
    	    }
    	    return null;
    	}
    	function storeTransportCache(usingTLS, transport, latency) {
    	    var storage = runtime_1["default"].getLocalStorage();
    	    if (storage) {
    	        try {
    	            storage[getTransportCacheKey(usingTLS)] = Collections.safeJSONStringify({
    	                timestamp: util_1["default"].now(),
    	                transport: transport,
    	                latency: latency
    	            });
    	        }
    	        catch (e) {
    	        }
    	    }
    	}
    	function flushTransportCache(usingTLS) {
    	    var storage = runtime_1["default"].getLocalStorage();
    	    if (storage) {
    	        try {
    	            delete storage[getTransportCacheKey(usingTLS)];
    	        }
    	        catch (e) {
    	        }
    	    }
    	}


    /***/ }),
    /* 68 */
    /***/ (function(module, exports, __webpack_require__) {
    	var timers_1 = __webpack_require__(12);
    	var DelayedStrategy = (function () {
    	    function DelayedStrategy(strategy, _a) {
    	        var number = _a.delay;
    	        this.strategy = strategy;
    	        this.options = { delay: number };
    	    }
    	    DelayedStrategy.prototype.isSupported = function () {
    	        return this.strategy.isSupported();
    	    };
    	    DelayedStrategy.prototype.connect = function (minPriority, callback) {
    	        var strategy = this.strategy;
    	        var runner;
    	        var timer = new timers_1.OneOffTimer(this.options.delay, function () {
    	            runner = strategy.connect(minPriority, callback);
    	        });
    	        return {
    	            abort: function () {
    	                timer.ensureAborted();
    	                if (runner) {
    	                    runner.abort();
    	                }
    	            },
    	            forceMinPriority: function (p) {
    	                minPriority = p;
    	                if (runner) {
    	                    runner.forceMinPriority(p);
    	                }
    	            }
    	        };
    	    };
    	    return DelayedStrategy;
    	}());
    	exports.__esModule = true;
    	exports["default"] = DelayedStrategy;


    /***/ }),
    /* 69 */
    /***/ (function(module, exports) {
    	var IfStrategy = (function () {
    	    function IfStrategy(test, trueBranch, falseBranch) {
    	        this.test = test;
    	        this.trueBranch = trueBranch;
    	        this.falseBranch = falseBranch;
    	    }
    	    IfStrategy.prototype.isSupported = function () {
    	        var branch = this.test() ? this.trueBranch : this.falseBranch;
    	        return branch.isSupported();
    	    };
    	    IfStrategy.prototype.connect = function (minPriority, callback) {
    	        var branch = this.test() ? this.trueBranch : this.falseBranch;
    	        return branch.connect(minPriority, callback);
    	    };
    	    return IfStrategy;
    	}());
    	exports.__esModule = true;
    	exports["default"] = IfStrategy;


    /***/ }),
    /* 70 */
    /***/ (function(module, exports) {
    	var FirstConnectedStrategy = (function () {
    	    function FirstConnectedStrategy(strategy) {
    	        this.strategy = strategy;
    	    }
    	    FirstConnectedStrategy.prototype.isSupported = function () {
    	        return this.strategy.isSupported();
    	    };
    	    FirstConnectedStrategy.prototype.connect = function (minPriority, callback) {
    	        var runner = this.strategy.connect(minPriority, function (error, handshake) {
    	            if (handshake) {
    	                runner.abort();
    	            }
    	            callback(error, handshake);
    	        });
    	        return runner;
    	    };
    	    return FirstConnectedStrategy;
    	}());
    	exports.__esModule = true;
    	exports["default"] = FirstConnectedStrategy;


    /***/ }),
    /* 71 */
    /***/ (function(module, exports, __webpack_require__) {
    	var defaults_1 = __webpack_require__(5);
    	exports.getGlobalConfig = function () {
    	    return {
    	        wsHost: defaults_1["default"].host,
    	        wsPort: defaults_1["default"].ws_port,
    	        wssPort: defaults_1["default"].wss_port,
    	        wsPath: defaults_1["default"].ws_path,
    	        httpHost: defaults_1["default"].sockjs_host,
    	        httpPort: defaults_1["default"].sockjs_http_port,
    	        httpsPort: defaults_1["default"].sockjs_https_port,
    	        httpPath: defaults_1["default"].sockjs_path,
    	        statsHost: defaults_1["default"].stats_host,
    	        authEndpoint: defaults_1["default"].channel_auth_endpoint,
    	        authTransport: defaults_1["default"].channel_auth_transport,
    	        activity_timeout: defaults_1["default"].activity_timeout,
    	        pong_timeout: defaults_1["default"].pong_timeout,
    	        unavailable_timeout: defaults_1["default"].unavailable_timeout
    	    };
    	};
    	exports.getClusterConfig = function (clusterName) {
    	    return {
    	        wsHost: "ws-" + clusterName + ".pusher.com",
    	        httpHost: "sockjs-" + clusterName + ".pusher.com"
    	    };
    	};


    /***/ })
    /******/ ])
    });
    });

    var Pusher = unwrapExports(pusher);

    /**
     * Global environment objects. This ensures that comparisons are true between
     * object pointers. For example: ENVIRONMENTS.TESTING === Util.Environments.Testing
     *
     * @since 1.0.3
     */
    /** @ignore */ var ProductionEnvironment = {
        environment: 'production'
    };
    /** @ignore */ var AdministrationEnvironment = {
        environment: 'production'
    };
    /** @ignore */ var SandboxDevEnvironment = {
        environment: 'sandbox'
    };
    /** @ignore */ var SandboxAdministrationEnvironment = {
        environment: 'sandbox'
    };
    /** @ignore */ var SandboxTwitchEnvironment = {
        environment: 'sandbox'
    };
    /** @ignore */ var ServerEnvironment = { environment: 'server' };
    /** @ignore */ var TestingEnvironment = {
        environment: 'testing'
    };
    /** @ignore */ var StagingDevEnvironment = {
        environment: 'staging'
    };
    /** @ignore */ var StagingAdministrationEnvironment = {
        environment: 'staging'
    };
    /** @ignore */ var StagingTwitchEnvironment = {
        environment: 'staging'
    };
    /**
     * Possible runtime environments for the SDK.
     * @since 1.0.0
     * @deprecated Use {@link Util.Environments} instead.
     */
    /** @ignore */ var ENVIRONMENTS = {
        ADMIN: AdministrationEnvironment,
        PRODUCTION: ProductionEnvironment,
        SANDBOX_ADMIN: SandboxAdministrationEnvironment,
        SANDBOX_DEV: SandboxDevEnvironment,
        SANDBOX_TWITCH: SandboxTwitchEnvironment,
        SERVER: ServerEnvironment,
        TESTING: TestingEnvironment,
        STAGING_ADMIN: StagingAdministrationEnvironment,
        STAGING_DEV: StagingDevEnvironment,
        STAGING_TWITCH: StagingTwitchEnvironment
    };
    /**
     * A collection of static utility functions, available at {@link Muxy.Util}.
     *
     * @example
     * const a = 'a string';
     * Muxy.Util.forceType(a, 'string');
     */
    var Util = /** @class */ (function () {
        function Util() {
        }
        Object.defineProperty(Util, "Environments", {
            /**
             * Possible runtime environments for the library. Used to define available
             * behavior and services.
             *
             * @since 1.0.3
             * @type {Object}
             */
            get: function () {
                return {
                    Admin: AdministrationEnvironment,
                    Production: ProductionEnvironment,
                    SandboxAdmin: SandboxAdministrationEnvironment,
                    SandboxDev: SandboxDevEnvironment,
                    SandboxTwitch: SandboxTwitchEnvironment,
                    Server: ServerEnvironment,
                    Testing: TestingEnvironment,
                    StagingDev: StagingDevEnvironment,
                    StagingTwitch: StagingTwitchEnvironment,
                    StagingAdmin: StagingAdministrationEnvironment
                };
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Wraps a string error response in an (immediately rejected) promise.
         * @since 1.0.0
         *
         * @param {string} err - A string error that the promise will reject.
         *
         * @returns {Promise<string>} Immediately rejects the returned Promise.
         */
        Util.errorPromise = function (err) {
            return Promise.reject(err);
        };
        /**
         * Returns the length of the longest line in the provided array.
         *
         * @since 1.0.0
         * @ignore
         *
         * @param {string[]} lines - An array of strings.
         */
        Util.widestLine = function (lines) {
            return Math.max.apply(null, lines.map(function (x) { return x.length; }));
        };
        /**
         * Draws a box around the lines of text provided.
         *
         * @since 1.0.0
         * @ignore
         *
         * @param {string[]} lines - An array of strings to surround.
         *
         * @returns {string} A string containing all `lines` of text surrounded
         * in an ASCII box art.
         */
        Util.asciiBox = function (lines) {
            var contentWidth = Util.widestLine(lines);
            var intro = ' '.repeat(contentWidth / 2) + "\uD83E\uDD8A";
            var out = [intro];
            out.push("\u250C" + '─'.repeat(contentWidth + 2) + "\u2510");
            lines.forEach(function (line) {
                var paddingRight = ' '.repeat(contentWidth - line.length);
                out.push("| " + line + paddingRight + " |");
            });
            out.push("\u2514" + '─'.repeat(contentWidth + 2) + "\u2518");
            return out;
        };
        /**
         * Checks if the current window object is running in an iframe.
         *
         * @since 1.0.0
         * @ignore
         */
        Util.isWindowFramed = function (overrideWindow) {
            var vWindow;
            if (typeof window !== 'undefined') {
                vWindow = window;
            }
            if (overrideWindow) {
                vWindow = overrideWindow;
            }
            var isNotChildWindow = !vWindow.opener;
            // Cannot compare WindowProxy objects with ===/!==
            var windowTop = vWindow.top && vWindow != vWindow.top; // tslint:disable-line:triple-equals
            var windowParent = vWindow.parent && vWindow != vWindow.parent; // tslint:disable-line:triple-equals
            var hasWindowAncestors = !!(windowTop || windowParent);
            return isNotChildWindow && hasWindowAncestors;
        };
        /**
         * currentEnvironment uses the hostname and available info to determine in what
         * environment the SDK is running. Possible values are available in {@link Util.Environments}.
         * @since 1.0.0
         *
         * @returns {string} Returns a string representation of the current
         * execution environment.
         */
        Util.currentEnvironment = function (overrideWindow) {
            var vWindow;
            if (typeof window !== 'undefined') {
                vWindow = window;
            }
            if (overrideWindow) {
                vWindow = overrideWindow;
            }
            if (Util.overrideEnvironment) {
                return Util.overrideEnvironment;
            }
            try {
                // NodeJS module system, assume server.
                // istanbul ignore if
                if (typeof module !== 'undefined' && module.exports && typeof vWindow === 'undefined') {
                    return ENVIRONMENTS.SERVER;
                }
                // Not in an iframe, assume sandbox dev.
                if (!Util.isWindowFramed(vWindow)) {
                    // See if we're in the admin state.
                    var urlParams = new URLSearchParams(window.location.search);
                    if (urlParams.get('muxyAdminInterface') || vWindow.name === 'SandboxAdmin') {
                        return ENVIRONMENTS.SANDBOX_ADMIN;
                    }
                    return ENVIRONMENTS.SANDBOX_DEV;
                }
                // See if we're in the admin pane.
                if (vWindow.name === 'Admin') {
                    return ENVIRONMENTS.ADMIN;
                }
                // See if we're in the admin state, but in an iframed context.
                var iFrameUrlParams = new URLSearchParams(window.location.search);
                if (iFrameUrlParams.get('muxyAdminInterface') || vWindow.name === 'SandboxAdmin') {
                    return ENVIRONMENTS.SANDBOX_ADMIN;
                }
                // Loaded from Twitch's CDN, assume production.
                if (vWindow.location.origin.indexOf('.ext-twitch.tv') !== -1) {
                    return ENVIRONMENTS.PRODUCTION;
                }
                // Not on Twitch but with their referrer, assume sandbox twitch.
                if (vWindow.document.referrer && vWindow.document.referrer.indexOf('twitch.tv') !== -1) {
                    return ENVIRONMENTS.SANDBOX_TWITCH;
                }
                // Explicity set testing variable, assume testing.
                if (vWindow.testing) {
                    return ENVIRONMENTS.TESTING;
                }
            }
            catch (err) {
                Util.consolePrint(err.toString(), { type: 'error' });
            }
            // Default, assume we're running in sandbox dev environment.
            return ENVIRONMENTS.SANDBOX_DEV;
        };
        /**
         * consolePrint prints each line of text with optional global settings and per-line
         * console flags.
         *
         * **NOTE:** Twitch's CSP enforcement disallows printing to console. This function
         * will not print anything to the console if it is running in production mode.
         *
         * @since 1.0.0
         * @public
         *
         * @param {string|string[]} lines - A single string to output, or an array of lines
         * of text. If lines is an array, each line will appear on its own line. If lines is
         * a single string, it will be split on '\n'.
         *
         * @param {object?} options - An object containing global options.
         * @param {boolean} options.boxed - If true, surrounds the output in an ASCII art box.
         * @param {string} options.style - A CSS style string to append to the console call.
         * @param {string} options.type - The type of print command. May be one of:
         * ['log', 'error', 'debug', 'info', 'warn'], although browser support may not be
         * available for all. Defaults to 'log'.
         *
         * @example
         * consolePrint('Hello World');
         *  Hello World
         *
         * consolePrint('This is a box', { boxed: true });
         *  ┌───────────────┐
         *  | This is a box |
         *  └───────────────┘
         */
        Util.consolePrint = function (lines, options) {
            if (options === void 0) { options = {}; }
            if (!lines || Util.currentEnvironment() === Util.Environments.Production) {
                return;
            }
            var style = 'font-family: monospace;';
            var lineArr = Array.isArray(lines) ? lines : lines.split('\n');
            var type = options.type || 'log';
            if (options.boxed) {
                lineArr = Util.asciiBox(lineArr);
            }
            if (options.style) {
                style += options.style;
            }
            if (Util.currentEnvironment() === Util.Environments.Server) {
                console[type].call(this, lineArr.join('\n')); // eslint-disable-line no-console
            }
            else {
                console[type].call(this, "%c" + lineArr.join('\n'), style); // eslint-disable-line no-console
            }
        };
        /**
         * Matches an input event name with a pattern. An event name is a : delimited
         * list of terms, while a pattern is a : delimited list of terms, with an
         * optional * instead of a term. '*' will match any term.
         *
         * @since 1.0.0
         * @private
         *
         * @param {string} input - An input event name, : delimited.
         * Allowed characters are alpha-numeric and _
         * @param {string} pattern - A pattern to match against, : delimited.
         * Allowed characters are alpha-numeric and _ and *
         *
         * @return Returns true if the pattern matches the input, false otherwise.
         */
        Util.eventPatternMatch = function (input, pattern) {
            var inputParts = input.split(':');
            var patternParts = pattern.split(':');
            if (inputParts.length !== patternParts.length) {
                return false;
            }
            for (var i = 0; i < inputParts.length; i += 1) {
                if (inputParts[i] !== patternParts[i] && patternParts[i] !== '*') {
                    return false;
                }
            }
            return true;
        };
        /**
         * Takes a variable and a Javascript Type identifier and throws a TypeError
         * if the variable's type is not in the provided type list. If the type check
         * passes, the function returns without error. As a convenience, the type may
         * also be an array of types.
         *
         * Acceptable types:
         * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof
         *
         * @since 1.0.0
         * @public
         *
         * @param {any} value - Any JavaScript variable.
         * @param {string} type - A single type string, or an array of multiple types.
         *
         * @throws {TypeError} Throws if typeof value is not in the type list.
         */
        Util.forceType = function (value, type) {
            var types = [].concat(type);
            var typeString = typeof value;
            if (types.indexOf(typeString) === -1) {
                throw new TypeError("expected '" + typeString + "' to be one of [" + types + "]");
            }
        };
        /**
         * Returns information about the current extension environment on twitch
         *
         * @public
         *
         * @return {TwitchEnvironment}
         */
        Util.getTwitchEnvironment = function () {
            var url = new URL(window.location.search);
            var env = {
                anchor: null,
                language: null,
                mode: null,
                platform: null,
                state: null,
                version: null
            };
            var path = url.pathname;
            var splitPath = path.split('/');
            if (splitPath.length > 2) {
                env.version = splitPath[2];
            }
            var urlParams = url.searchParams;
            env.anchor = urlParams.get('anchor');
            env.language = urlParams.get('language');
            env.mode = urlParams.get('mode');
            env.platform = urlParams.get('platform');
            env.state = urlParams.get('state');
            return env;
        };
        /**
         * Attempts to parse the provided JWT and return the payload info
         *
         * @param {Object} jwt - The auth JWT token as returned from the auth harness.
         */
        Util.extractJWTInfo = function (jwt) {
            try {
                var splitToken = jwt.split('.');
                if (splitToken.length === 3) {
                    return JSON.parse(window.atob(splitToken[1]));
                }
            }
            catch (err) {
                throw new Error('Failed to parse JWT');
            }
        };
        return Util;
    }());
    /** @ignore */ var consolePrint = Util.consolePrint;
    /** @ignore */ var forceType = Util.forceType;
    /** @ignore */ var eventPatternMatch = Util.eventPatternMatch;
    /** @ignore */ var CurrentEnvironment = Util.currentEnvironment;

    /**
     * @module SDK
     */
    // TwitchMessenger implements the basic 'messenger' interface, which should be implemented
    // for all pubsub implementations. This is used by SDK to provide low-level access
    // to a pubsub implementation.
    var TwitchMessenger = /** @class */ (function () {
        function TwitchMessenger(debug) {
            this.channelID = '';
            this.extensionID = '';
            this.debug = debug;
        }
        /**
         * send will send a message to all clients.
         * @param id the extension id or app id of the app thats sending the message.
         * @param event an event name. Event names should be in the form [a-z0-9_]+
         * @param either 'broadcast' or 'whisper-<opaque-user-id>'
         * @param body a json object to send
         * @param client a state-client instance. Used to make external calls.
         * The twitch messenger does not need the client, so its not shown in the signature
         * below.
         */
        /* eslint-disable class-methods-use-this */
        TwitchMessenger.prototype.send = function (id, event, target, body) {
            var data = body || {};
            this.debug.onPubsubSend(id, event, target, body);
            window.Twitch.ext.send(target, 'application/json', {
                data: data,
                event: CurrentEnvironment().environment + ":" + id + ":" + event
            });
        };
        /* eslint-enable class-methods-use-this */
        /**
         * listen is the low level listening interface.
         * @param id the extension id or app id of the app thats sending the message.
         * @param topic either `broadcast` or `whisper-<opaque-user-id>`.
         * @param callback a function(body)
         * @return a handle that can be passed into unlisten to unbind the callback.
         */
        /* eslint-disable class-methods-use-this */
        TwitchMessenger.prototype.listen = function (id, topic, callback) {
            var _this = this;
            var cb = function (t, datatype, message) {
                try {
                    var parsed = JSON.parse(message);
                    _this.debug.onPubsubReceive(id, topic, parsed);
                    callback(parsed);
                }
                catch (err) {
                    // TODO: Silent failure?
                }
            };
            this.debug.onPubsubListen(id, topic);
            window.Twitch.ext.listen(topic, cb);
            if (topic === 'broadcast') {
                window.Twitch.ext.listen('global', cb);
            }
            return {
                cb: cb,
                target: topic
            };
        };
        /* eslint-enable class-methods-use-this */
        /**
         * unlisten will unregister a listening callback.
         * @param id the extension id or app id of the app thats sending the message.
         * @param h the handle returned from listen
         */
        /* eslint-disable class-methods-use-this */
        TwitchMessenger.prototype.unlisten = function (id, h) {
            window.Twitch.ext.unlisten(h.target, h.cb);
        };
        /* eslint-enable class-methods-use-this */
        TwitchMessenger.prototype.close = function () {
            /* Nothing to close on Twitch */
        };
        return TwitchMessenger;
    }());
    // PusherMessenger adheres to the 'messenger' interface, but uses https://pusher.com
    // as a pubsub notification provider.
    var PusherMessenger = /** @class */ (function () {
        function PusherMessenger(debug) {
            // @ts-ignore
            this.client = new Pusher('18c26c0d1c7fafb78ba2', {
                cluster: 'us2',
                encrypted: true
            });
            this.channelID = '';
            this.debug = debug;
        }
        PusherMessenger.prototype.send = function (id, event, target, body, client) {
            var scopedEvent = CurrentEnvironment().environment + ":" + id + ":" + event;
            this.debug.onPubsubSend(id, event, target, body);
            client.signedRequest(id, 'POST', 'pusher_broadcast', JSON.stringify({
                data: body,
                event: scopedEvent,
                target: target,
                user_id: this.channelID
            }));
        };
        PusherMessenger.prototype.listen = function (id, topic, callback) {
            var _this = this;
            if (!this.channel) {
                var channelName = "twitch.pubsub." + this.extensionID + "." + this.channelID;
                var globalName = "twitch.pubsub." + this.extensionID + ".all";
                this.channel = this.client.subscribe(channelName);
                this.globalChannel = this.client.subscribe(globalName);
            }
            var cb = function (message) {
                try {
                    var parsed = JSON.parse(message.message);
                    _this.debug.onPubsubReceive(id, topic, parsed);
                    callback(parsed);
                }
                catch (err) {
                    // TODO: Silent failure?
                }
            };
            this.debug.onPubsubListen(id, topic);
            this.channel.bind(topic, cb);
            this.globalChannel.bind(topic, cb);
            return {
                cb: cb,
                target: topic
            };
        };
        PusherMessenger.prototype.unlisten = function (id, h) {
            this.channel.unbind(h.target, h.cb);
            this.globalChannel.unbind(h.target, h.cb);
        };
        PusherMessenger.prototype.close = function () {
            this.client.disconnect();
        };
        return PusherMessenger;
    }());
    // ServerMessenger implements a 'messenger' that is broadcast-only. It cannot
    // listen for messages, but is able to send with a backend-signed JWT.
    var ServerMessenger = /** @class */ (function () {
        function ServerMessenger(debug, ch) {
            this.channelID = ch;
            this.debug = debug;
        }
        ServerMessenger.prototype.send = function (id, event, target, body, client) {
            this.debug.onPubsubSend(id, event, target, body);
            client.signedRequest(id, 'POST', 'broadcast', JSON.stringify({
                data: body,
                event: event,
                target: target,
                user_id: this.channelID
            }));
        };
        /* tslint:disable:no-console */
        ServerMessenger.prototype.listen = function (id, topic, callback) {
            console.error('Server-side message receiving is not implemented.');
            return {
                cb: function () {
                    /* Not Implemented */
                },
                target: ''
            };
        };
        ServerMessenger.prototype.unlisten = function (id, handle) {
            console.error('Server-side message receiving is not implemented.');
        };
        /* tslint:enable:no-console */
        ServerMessenger.prototype.close = function () {
            /* Nothing to close server-side. */
        };
        return ServerMessenger;
    }());
    function DefaultMessenger(debug) {
        switch (CurrentEnvironment()) {
            case ENVIRONMENTS.SANDBOX_DEV:
            case ENVIRONMENTS.ADMIN: // Currently unable to hook into the twitch pubsub system from admin
            case ENVIRONMENTS.SANDBOX_ADMIN:
            case ENVIRONMENTS.STAGING_ADMIN:
            case ENVIRONMENTS.STAGING_DEV:
                return new PusherMessenger(debug);
            case ENVIRONMENTS.SANDBOX_TWITCH:
            case ENVIRONMENTS.PRODUCTION:
            case ENVIRONMENTS.STAGING_TWITCH:
                return new TwitchMessenger(debug);
            case ENVIRONMENTS.SERVER:
                return new ServerMessenger(debug);
            default:
                throw new Error('Could not determine execution environment.');
        }
    }

    /**
     * @module SDK
     */
    var Observer = /** @class */ (function () {
        function Observer() {
            this.observers = [];
        }
        Observer.prototype.register = function (observer) {
            this.observers.push(observer);
        };
        Observer.prototype.unregister = function (observer) {
            var n = this.observers.indexOf(observer);
            this.observers.splice(n, 1);
        };
        Observer.prototype.notify = function (obj) {
            var i = 0;
            var max = this.observers.length;
            for (; i < max; i += 1) {
                this.observers[i].notify(obj);
            }
        };
        return Observer;
    }());
    var ObserverHandler = /** @class */ (function () {
        function ObserverHandler() {
        }
        ObserverHandler.prototype.notify = function (obj) {
            throw new Error('Abstract Method!');
        };
        return ObserverHandler;
    }());

    /**
     * @module SDK
     */
    // Twitch types
    var TwitchAuth = /** @class */ (function () {
        function TwitchAuth() {
        }
        return TwitchAuth;
    }());
    var ContextUpdateCallbackHandle = /** @class */ (function (_super) {
        __extends(ContextUpdateCallbackHandle, _super);
        function ContextUpdateCallbackHandle(cb) {
            var _this = _super.call(this) || this;
            _this.cb = cb;
            return _this;
        }
        ContextUpdateCallbackHandle.prototype.notify = function (context) {
            this.cb(context);
        };
        return ContextUpdateCallbackHandle;
    }(ObserverHandler));

    var DEFAULT_CONTENT_TYPE = 'application/x-www-form-urlencoded; charset=UTF-8';
    var XHRPromise = /** @class */ (function () {
        function XHRPromise(options) {
            if (options === void 0) { options = {}; }
            this.options = {
                data: null,
                headers: {},
                method: 'GET'
            };
            Object.assign(this.options, options);
        }
        XHRPromise.prototype.send = function () {
            var _this = this;
            return new Promise(function (resolve, reject) {
                if (!XMLHttpRequest) {
                    _this.handleResponse('browser', reject, null, "browser doesn't support XMLHttpRequest");
                    return;
                }
                if (typeof _this.options.url !== 'string' ||
                    _this.options.url.length === 0) {
                    _this.handleResponse('url', reject, null, 'URL is a required parameter');
                    return;
                }
                _this.xhr = new XMLHttpRequest();
                _this.xhr.onload = function () {
                    var responseText;
                    try {
                        responseText = _this.getResponseText();
                    }
                    catch (err) {
                        _this.handleResponse('parse', reject, null, 'invalid JSON response');
                        return;
                    }
                    return resolve({
                        headers: _this.getAllResponseHeaders(),
                        responseText: responseText,
                        status: _this.xhr.status,
                        statusText: _this.xhr.statusText,
                        url: _this.getResponseURL(),
                        xhr: _this.xhr
                    });
                };
                _this.xhr.onerror = function () {
                    return _this.handleResponse('error', reject);
                };
                _this.xhr.ontimeout = function () {
                    return _this.handleResponse('timeout', reject);
                };
                _this.xhr.onabort = function () {
                    return _this.handleResponse('abort', reject);
                };
                _this.xhr.open(_this.options.method, _this.options.url);
                if (_this.options.data !== null && !_this.options.headers['Content-Type']) {
                    _this.options.headers['Content-Type'] = DEFAULT_CONTENT_TYPE;
                }
                var ref = _this.options.headers;
                for (var header in ref) {
                    if (ref.hasOwnProperty(header)) {
                        var value = ref[header];
                        _this.xhr.setRequestHeader(header, value);
                    }
                }
                try {
                    return _this.xhr.send(_this.options.data);
                }
                catch (err) {
                    return _this.handleResponse('send', reject, null, err.toString());
                }
            });
        };
        XHRPromise.prototype.getXHR = function () {
            return this.xhr;
        };
        // Converts response headers to map.
        XHRPromise.prototype.getAllResponseHeaders = function () {
            var map = {};
            if (this.xhr.readyState !== this.xhr.HEADERS_RECEIVED) {
                return map;
            }
            var headers = this.xhr.getAllResponseHeaders();
            var arr = headers.trim().split(/[\r\n]+/);
            arr.forEach(function (header) {
                var parts = header.split(': ');
                var h = parts.shift();
                var v = parts.join(': ');
                map[h] = v;
            });
            return map;
        };
        // Returns the XHR response, parsing as json if applicable.
        XHRPromise.prototype.getResponseText = function () {
            var type = (this.xhr.getResponseHeader('Content-Type') || '').split(';')[0];
            var text = typeof this.xhr.responseText === 'string' ? this.xhr.responseText : '';
            if (type === 'application/json' || type === 'text/javascript') {
                text = JSON.parse("" + text);
            }
            return text;
        };
        XHRPromise.prototype.getResponseURL = function () {
            if (this.xhr.responseURL !== null) {
                return this.xhr.responseURL;
            }
            if (/^X-Request-URL:/m.test(this.xhr.getAllResponseHeaders())) {
                return this.xhr.getResponseHeader('X-Request-URL');
            }
            return '';
        };
        XHRPromise.prototype.handleResponse = function (reason, response, status, statusText) {
            return response({
                reason: reason,
                status: status || this.xhr.status,
                statusText: statusText || this.xhr.statusText,
                xhr: this.xhr
            });
        };
        return XHRPromise;
    }());

    /**
     * @module SDK
     */
    /**
     * Muxy production API URL.
     * @ignore
     */
    var API_URL = 'https://api.muxy.io';
    /**
     * Muxy sandbox API URL.
     * @ignore
     */
    var SANDBOX_URL = 'https://sandbox.api.muxy.io';
    /**
     * Localhost for testing purposes.
     * @ignore
     */
    var LOCALHOST_URL = 'http://localhost:5000';
    /**
     * Muxy staging API URL.
     * @ignore
     */
    var STAGING_URL = 'https://staging.api.muxy.io';
    /**
     * API URL to use for backend requests. Uses production API be default, but
     * can be updated using {@link setEnvironment}.
     * @ignore
     */
    var SERVER_URL = API_URL;
    var FAKEAUTH_URL = SANDBOX_URL;
    /**
     * ServerState enum maps the subsets of state persisted to the server to
     * their respective endpoints.
     * @ignore
     */
    var ServerState = {
        ALL: 'all_state',
        AUTHENTICATION: 'authentication',
        CHANNEL: 'channel_state',
        EXTENSION: 'extension_state',
        EXTENSION_SECRET: 'extension_hidden_state',
        EXTENSION_VIEWER: 'extension_viewer_state',
        USER: 'user_info',
        VIEWER: 'viewer_state'
    };
    /**
     * Wraps all extension backend accessor and mutator endpoints in convenience functions.
     *
     * Should not normally be created directly, instead an instance is made available
     * and namespaced appropriately when using {@link Muxy.SDK}.
     *
     * @private
     *
     * @example
     * const sdk = new Muxy.SDK();
     * sdk.getAllState().then((state) => {
     *   console.log(state);
     * });
     */
    var StateClient = /** @class */ (function () {
        /** @ignore */
        function StateClient(loadedPromise, debug) {
            var _this = this;
            /**
             * getState requests a subset of state stored on the server and sets the
             * local cached version of the state to the response.
             * @ignore
             */
            this.getState = function (identifier, substate) {
                return _this.signedRequest(identifier, 'GET', substate || ServerState.ALL);
            };
            /**
             * postState sends data to the current EBS substate endpoint for persistence.
             * @ignore
             */
            this.postState = function (identifier, substate, data) {
                return _this.signedRequest(identifier, 'POST', substate || ServerState.ALL, data);
            };
            /** @ignore */
            this.getUserInfo = function (identifier) { return _this.getState(identifier, ServerState.USER); };
            /** @ignore */
            this.immediateGetUserInfo = function (identifier) { return _this.signedRequest(identifier, 'GET', ServerState.USER, undefined, true); };
            /** @ignore */
            this.getViewerState = function (identifier) { return _this.getState(identifier, ServerState.VIEWER); };
            /** @ignore */
            this.getExtensionViewerState = function (identifier) { return _this.getState(identifier, ServerState.EXTENSION_VIEWER); };
            /** @ignore */
            this.getExtensionSecretState = function (identifier) { return _this.getState(identifier, ServerState.EXTENSION_SECRET); };
            /** @ignore */
            this.getChannelState = function (identifier) { return _this.getState(identifier, ServerState.CHANNEL); };
            /** @ignore */
            this.getExtensionState = function (identifier) { return _this.getState(identifier, ServerState.EXTENSION); };
            /** @ignore */
            this.setViewerState = function (identifier, state) { return _this.postState(identifier, ServerState.VIEWER, JSON.stringify(state)); };
            /** @ignore */
            this.setExtensionViewerState = function (identifier, state) {
                return _this.postState(identifier, ServerState.EXTENSION_VIEWER, JSON.stringify(state));
            };
            /** @ignore */
            this.patchExtensionViewerState = function (identifier, multiState) {
                return _this.signedRequest(identifier, 'PATCH', 'extension_viewer_state', JSON.stringify(multiState));
            };
            /** @ignore */
            this.multiGetExtensionViewerState = function (identifier, users) {
                return _this.signedRequest(identifier, 'GET', "extension_viewer_state?user_ids=" + users.join(','));
            };
            /** @ignore */
            this.setExtensionSecretState = function (identifier, state) {
                return _this.postState(identifier, ServerState.EXTENSION_SECRET, JSON.stringify(state));
            };
            /** @ignore */
            this.setChannelState = function (identifier, state) {
                return _this.postState(identifier, ServerState.CHANNEL, JSON.stringify(state));
            };
            /** @ignore */
            this.setExtensionState = function (identifier, state) {
                return _this.postState(identifier, ServerState.EXTENSION, JSON.stringify(state));
            };
            /** @ignore */
            this.getAccumulation = function (identifier, id, start) {
                return _this.signedRequest(identifier, 'GET', "accumulate?id=" + (id || 'default') + "&start=" + start);
            };
            /** @ignore */
            this.accumulate = function (identifier, id, data) {
                return _this.signedRequest(identifier, 'POST', "accumulate?id=" + (id || 'default'), JSON.stringify(data));
            };
            /** @ignore */
            this.vote = function (identifier, id, data) {
                return _this.signedRequest(identifier, 'POST', "vote?id=" + (id || 'default'), JSON.stringify(data));
            };
            /** @ignore */
            this.getVotes = function (identifier, id) { return _this.signedRequest(identifier, 'GET', "vote?id=" + (id || 'default')); };
            /** @ignore */
            this.getFullVoteLogs = function (identifier, id) { return _this.signedRequest(identifier, 'GET', "vote_logs?id=" + (id || 'default')); };
            /** @ignore */
            this.rank = function (identifier, id, data) {
                return _this.signedRequest(identifier, 'POST', "rank?id=" + (id || 'default'), JSON.stringify(data));
            };
            /** @ignore */
            this.getRank = function (identifier, id) {
                if (id === void 0) { id = 'default'; }
                return _this.signedRequest(identifier, 'GET', "rank?id=" + id);
            };
            /** @ignore */
            this.deleteRank = function (identifier, id) { return _this.signedRequest(identifier, 'DELETE', "rank?id=" + (id || 'default')); };
            /** @ignore */
            this.getJSONStore = function (identifier, id) { return _this.signedRequest(identifier, 'GET', "json_store?id=" + (id || 'default')); };
            /** @ignore */
            this.validateCode = function (identifier, code) {
                return _this.signedRequest(identifier, 'POST', 'validate_pin', JSON.stringify({ pin: code }));
            };
            /** @ignore */
            this.pinTokenExists = function (identifier) { return _this.signedRequest(identifier, 'GET', 'pin_token_exists'); };
            /** @ignore */
            this.revokeAllPINCodes = function (identifier) { return _this.signedRequest(identifier, 'DELETE', 'pin'); };
            /** @ignore */
            this.getEligibleCodes = function (identifier) { return _this.signedRequest(identifier, 'GET', 'codes/eligible'); };
            /** @ignore */
            this.getRedeemedCodes = function (identifier) { return _this.signedRequest(identifier, 'GET', 'codes/redeemed'); };
            /** @ignore */
            this.redeemCode = function (identifier, prizeIndex) {
                return _this.signedRequest(identifier, 'POST', 'codes/redeem', JSON.stringify({ prize: prizeIndex }));
            };
            /** @ignore */
            this.getExtensionUsers = function (identifier, cursor) {
                return _this.signedRequest(identifier, 'GET', "user_ids?cursor=" + (cursor || 0));
            };
            /** @ignore */
            this.joinExtensionTriviaTeam = function (identifier) { return _this.signedRequest(identifier, 'POST', 'team_membership'); };
            /** @ignore */
            this.getExtensionTriviaJoinedTeam = function (identifier) { return _this.signedRequest(identifier, 'GET', 'team_membership'); };
            /** @ignore */
            this.addExtensionTriviaQuestion = function (identifier, triviaQuestion) {
                return _this.signedRequest(identifier, 'POST', 'curated_poll_edit', JSON.stringify(triviaQuestion));
            };
            /** @ignore */
            this.removeExtensionTriviaQuestion = function (identifier, triviaQuestionID) {
                return _this.signedRequest(identifier, 'DELETE', 'curated_poll_edit', JSON.stringify({ id: triviaQuestionID }));
            };
            /** @ignore */
            this.addExtensionTriviaOptionToQuestion = function (identifier, questionID, option) {
                return _this.signedRequest(identifier, 'POST', 'curated_poll_edit_option', JSON.stringify({ question: questionID, option: option }));
            };
            /** @ignore */
            this.removeExtensionTriviaOptionFromQuestion = function (identifier, questionID, optionID) {
                return _this.signedRequest(identifier, 'DELETE', 'curated_poll_edit_option', JSON.stringify({ question: questionID, option: optionID }));
            };
            /** @ignore */
            this.setExtensionTriviaQuestionState = function (identifier, questionID, state, winner) {
                return _this.signedRequest(identifier, 'POST', "curated_poll_state?id=" + questionID, JSON.stringify({ transition: state, winner: winner }));
            };
            /** @ignore */
            this.setExtensionTriviaQuestionVote = function (identifier, questionID, optionID) {
                return _this.signedRequest(identifier, 'POST', 'curated_poll', JSON.stringify({ question_id: questionID, vote: optionID }));
            };
            /** @ignore */
            this.getExtensionTriviaQuestions = function (identifier) { return _this.signedRequest(identifier, 'GET', 'curated_poll'); };
            /** @ignore */
            this.getExtensionTriviaQuestion = function (identifier, questionID) {
                return _this.signedRequest(identifier, 'GET', "curated_poll?id=" + questionID);
            };
            /** @ignore */
            this.getExtensionTriviaLeaderboard = function (identifer) { return _this.signedRequest(identifer, 'GET', 'curated_poll_leaderboard'); };
            /** @ignore */
            this.token = null;
            this.debug = debug;
            this.loaded = loadedPromise;
        }
        /** @ignore */
        StateClient.fetchTestAuth = function (extensionID, debug) {
            var _this = this;
            var data = JSON.stringify({
                app_id: extensionID,
                channel_id: debug.channelID,
                role: debug.role,
                user_id: debug.userID || '12345678'
            });
            var xhr = new XHRPromise({
                data: data,
                headers: {
                    'Content-Type': 'application/json'
                },
                method: 'POST',
                url: (debug.url || SANDBOX_URL) + "/v1/e/authtoken?role=" + debug.role // pass roll as a param for fixtures
            });
            return xhr.send().then(function (resp) {
                if (resp && resp.status < 400) {
                    _this.setEnvironment(null, debug);
                    // Update the API Server variable to point to test
                    var auth = Object.assign(new TwitchAuth(), resp.responseText, {
                        channelId: debug.channelID,
                        clientId: extensionID,
                        userId: debug.userID ? "U" + debug.userID : 'U12345678'
                    });
                    return Promise.resolve(auth);
                }
                else {
                    return Promise.reject(resp.statusText);
                }
            });
        };
        /** @ignore */
        StateClient.setEnvironment = function (env, debug) {
            if (env === ENVIRONMENTS.SANDBOX_DEV || env === ENVIRONMENTS.SANDBOX_TWITCH || env === ENVIRONMENTS.SANDBOX_ADMIN) {
                SERVER_URL = SANDBOX_URL;
            }
            if (env === ENVIRONMENTS.STAGING_DEV || env === ENVIRONMENTS.STAGING_TWITCH) {
                SERVER_URL = STAGING_URL;
                FAKEAUTH_URL = STAGING_URL;
            }
            if (env === ENVIRONMENTS.TESTING) {
                SERVER_URL = LOCALHOST_URL;
                FAKEAUTH_URL = LOCALHOST_URL;
            }
            if (debug && debug.url) {
                SERVER_URL = debug.url;
                FAKEAUTH_URL = debug.url;
            }
        };
        /** @ignore */
        StateClient.prototype.updateAuth = function (token) {
            this.token = token;
        };
        /**
         * signedRequest checks that we have a valid JWT and wraps a standard AJAX
         * request to the EBS with valid auth credentials.s
         * @ignore
         */
        StateClient.prototype.signedRequest = function (extensionID, method, endpoint, data, skipPromise) {
            var _this = this;
            var waitedPromise = this.loaded;
            if (skipPromise) {
                waitedPromise = Promise.resolve();
            }
            return waitedPromise.then(function () {
                if (!_this.validateJWT()) {
                    return Promise.reject('Your authentication token has expired.');
                }
                var xhrPromise = new XHRPromise({
                    data: data,
                    headers: {
                        Authorization: extensionID + " " + _this.token
                    },
                    method: method,
                    url: SERVER_URL + "/v1/e/" + endpoint
                });
                return xhrPromise.send().then(function (resp) {
                    try {
                        if (resp.status < 400) {
                            return Promise.resolve(resp.responseText);
                        }
                        else if (resp.responseText) {
                            return Promise.reject(resp.responseText);
                        }
                        else {
                            return Promise.reject("Server returned status " + resp.status);
                        }
                    }
                    catch (err) {
                        return Promise.reject(err);
                    }
                });
            });
        };
        /**
         * validateJWT ensures that the current JWT is valid and not expired.
         * @ignore
         */
        StateClient.prototype.validateJWT = function () {
            try {
                var splitToken = this.token.split('.');
                if (splitToken.length !== 3) {
                    return false;
                }
                var tk = JSON.parse(atob(splitToken[1]));
                if (!tk.exp) {
                    return false;
                }
                var now = new Date().valueOf();
                if (tk.exp < now / 1000) {
                    return false;
                }
                return true;
            }
            catch (err) {
                return false;
            }
        };
        return StateClient;
    }());

    // 25 minutes between updates of the testing auth token.
    var TEST_AUTH_TIMEOUT_MS = 25 * 60 * 1000;
    // Only process context callbacks once every 30 seconds.
    var CONTEXT_CALLBACK_TIMEOUT = 30 * 1000;
    // Wrapper around global Twitch extension object.
    var Ext = /** @class */ (function () {
        function Ext() {
        }
        Ext.fetchTestAuth = function (opts, cb) {
            StateClient.fetchTestAuth(this.extensionID, opts)
                .then(function (auth) {
                cb(auth);
            })
                .catch(cb);
        };
        Ext.fetchAdminAuth = function (debug, cb) {
            var _this = this;
            var allowedOrigins = ['^https://dev\\.staging.muxy\\.io$', '^https://dev\\.muxy\\.io$', '^https?://localhost'];
            // Show that we're ready to receive.
            var connectionAttempts = 0;
            var connection = setInterval(function () {
                connectionAttempts++;
                // Once we've tried 60 times, back off on attempting to once every 1.5 seconds or so.
                if (connectionAttempts > 60) {
                    if (connectionAttempts % 10 !== 0) {
                        return;
                    }
                }
                window.parent.postMessage({ type: 'connect', id: _this.extensionID }, '*');
            }, 150);
            window.addEventListener('message', function (auth) {
                var allowed = false;
                allowedOrigins.forEach(function (origin) {
                    var r = new RegExp(origin);
                    if (r.test(auth.origin)) {
                        allowed = true;
                    }
                });
                if (!allowed) {
                    return;
                }
                if (auth.data.type === 'jwt') {
                    StateClient.setEnvironment(null, debug);
                    var resp = Object.assign(new TwitchAuth(), {
                        channelId: debug.channelID,
                        clientId: _this.extensionID,
                        token: auth.data.jwt,
                        userId: debug.userID || 'T12345678'
                    });
                    clearInterval(connection);
                    return cb(resp);
                }
            });
        };
        Ext.onAuthorized = function (opts, cb) {
            if (opts.jwt) {
                var auth_1 = this.authFromJWT(opts.jwt);
                return setTimeout(function () {
                    StateClient.setEnvironment(null, opts);
                    cb(auth_1);
                });
            }
            switch (CurrentEnvironment()) {
                case ENVIRONMENTS.SANDBOX_DEV:
                case ENVIRONMENTS.STAGING_DEV:
                    Ext.fetchTestAuth(opts, cb);
                    setInterval(Ext.fetchTestAuth, TEST_AUTH_TIMEOUT_MS, opts, cb);
                    break;
                case ENVIRONMENTS.SANDBOX_ADMIN:
                case ENVIRONMENTS.STAGING_ADMIN:
                case ENVIRONMENTS.ADMIN:
                    Ext.fetchAdminAuth(opts, cb);
                    break;
                case ENVIRONMENTS.SANDBOX_TWITCH:
                case ENVIRONMENTS.STAGING_TWITCH:
                case ENVIRONMENTS.PRODUCTION: {
                    var timer_1 = setTimeout(cb, 1000 * 15);
                    window.Twitch.ext.onAuthorized(function (auth) {
                        clearTimeout(timer_1);
                        StateClient.setEnvironment(null, opts);
                        cb(auth);
                    });
                    break;
                }
                default:
                    consolePrint("No authorization callback for " + CurrentEnvironment(), {
                        type: 'error'
                    });
            }
        };
        Ext.onContext = function (cb) {
            switch (CurrentEnvironment()) {
                case ENVIRONMENTS.SANDBOX_TWITCH:
                case ENVIRONMENTS.STAGING_TWITCH:
                case ENVIRONMENTS.PRODUCTION:
                    (function setupOnContextCallback() {
                        // Twitch currently (2017-08-25) has an issue where certain browser mis-configurations
                        // (like having incorrect system time/timezone settings) will cause the onContext callback
                        // function to fire repeatedly as quickly as possible. To deal with this issue, we
                        // throttle the onContext callbacks.
                        var lastContextCall = 0;
                        window.Twitch.ext.onContext(function (context) {
                            // Check the last time the auth callback was called and restrict.
                            var diff = new Date().getTime() - lastContextCall;
                            if (diff < CONTEXT_CALLBACK_TIMEOUT) {
                                return;
                            }
                            lastContextCall = new Date().getTime();
                            cb(context);
                        });
                    })();
                    break;
                default:
            }
        };
        Ext.beginPurchase = function (sku) {
            switch (CurrentEnvironment()) {
                case ENVIRONMENTS.SANDBOX_TWITCH:
                case ENVIRONMENTS.STAGING_TWITCH:
                case ENVIRONMENTS.PRODUCTION:
                    window.Twitch.ext.purchases.beginPurchase(sku);
                    break;
                default:
                    consolePrint("beginPurchase not supported for " + CurrentEnvironment(), {
                        type: 'error'
                    });
            }
        };
        Ext.getPrices = function (cb) {
            switch (CurrentEnvironment()) {
                case ENVIRONMENTS.SANDBOX_TWITCH:
                case ENVIRONMENTS.STAGING_TWITCH:
                case ENVIRONMENTS.PRODUCTION:
                    window.Twitch.ext.purchases
                        .getPrices()
                        .then(function (prices) {
                        cb(prices);
                    })
                        .catch(cb);
                    break;
                default:
                    consolePrint("getPrices not supported for " + CurrentEnvironment(), {
                        type: 'error'
                    });
            }
        };
        Ext.onReloadEntitlements = function (cb) {
            switch (CurrentEnvironment()) {
                case ENVIRONMENTS.SANDBOX_TWITCH:
                case ENVIRONMENTS.STAGING_TWITCH:
                case ENVIRONMENTS.PRODUCTION:
                    window.Twitch.ext.purchases.onReloadEntitlements(cb);
                    break;
                default:
                    consolePrint("onReloadEntitlements not supported for " + CurrentEnvironment(), {
                        type: 'error'
                    });
            }
        };
        Ext.onVisibilityChanged = function (callback) {
            switch (CurrentEnvironment()) {
                case ENVIRONMENTS.SANDBOX_TWITCH:
                case ENVIRONMENTS.STAGING_TWITCH:
                case ENVIRONMENTS.PRODUCTION:
                    window.Twitch.ext.onVisibilityChanged(callback);
                    break;
                default:
                    consolePrint("onVisibilityChanged not supported for " + CurrentEnvironment(), {
                        type: 'error'
                    });
            }
        };
        Ext.onPositionChanged = function (callback) {
            switch (CurrentEnvironment()) {
                case ENVIRONMENTS.SANDBOX_TWITCH:
                case ENVIRONMENTS.STAGING_TWITCH:
                case ENVIRONMENTS.PRODUCTION:
                    window.Twitch.ext.onPositionChanged(callback);
                    break;
                default:
                    consolePrint("onVisibilityChanged not supported for " + CurrentEnvironment(), {
                        type: 'error'
                    });
            }
        };
        Ext.authFromJWT = function (jwt) {
            var claims = JSON.parse(atob(jwt.split('.')[1]));
            var res = new TwitchAuth();
            res.token = jwt;
            res.channelId = claims.channel_id;
            res.userId = claims.user_id;
            res.clientId = Ext.extensionID;
            return res;
        };
        return Ext;
    }());

    var UserUpdateCallbackHandle = /** @class */ (function (_super) {
        __extends(UserUpdateCallbackHandle, _super);
        function UserUpdateCallbackHandle(cb) {
            var _this = _super.call(this) || this;
            _this.cb = cb;
            return _this;
        }
        UserUpdateCallbackHandle.prototype.notify = function (user) {
            this.cb(user);
        };
        return UserUpdateCallbackHandle;
    }(ObserverHandler));
    /**
     * Stores fields related to the current extension user, either a viewer or the broadcaster.
     * These fields are automatically updated by the SDK.
     */
    var User = /** @class */ (function () {
        /**
         * @since 1.0.0
         * @param {Object} auth - An auth token usable by this user for backend requests.
         */
        function User(auth) {
            /**
             * channelID holds the numeric id of the channel the user is currently watching.
             *
             * @since 1.0.0
             * @type {string}
             */
            this.channelID = auth.channelId;
            /**
             * twitchJWT holds the raw JWT response from the Twitch Extension SDK.
             *
             * @since 1.0.0
             * @type {Object}
             */
            this.twitchJWT = auth.token;
            /**
             * twitchOpaqueID is a Twitch generated ID that will uniquely identify this
             * user (if they are logged in), but does not give us access to their Twitch ID.
             *
             * @since 1.0.0
             * @type {string}
             */
            this.twitchOpaqueID = auth.userId;
            /**
             * twitchID is this viewer's actual Twitch ID. Used to coordinate access to
             * other Twitch services and across the Twitch universe. Only set if the user
             * grants access, null otherwise.
             *
             * @since 1.0.0
             * @type {null|string}
             */
            this.twitchID = null;
            /**
             * registeredWithMuxy will be true if the user has an active muxy account.
             *
             * @since 1.0.0
             * @type {boolean}
             */
            this.registeredWithMuxy = false;
            /**
             * muxyID is this viewer's ID on Muxy. Null if the user has not authenticated with
             * Muxy or is not sharing their Twitch ID with the extension.
             *
             * @since 1.0.0
             * @type {null|string}
             */
            this.muxyID = null;
            /**
             * visualizationID is a unique user string that can be used to identify this user
             * on Muxy's a.muxy.io subdomain. This is used for things like alerts and
             * cheer visualizations, but is not generally useful. Empty string if
             * `registeredWithMuxy` is false.
             *
             * @since 1.0.0
             * @type {string}
             */
            this.visualizationID = '';
            /**
             * role is the current user's role in the extension. May be one of {@link Roles}.
             *
             * @since 1.0.0
             * @type {string}
             */
            this.role = User.Roles.Viewer;
            /**
             * ip is the current user's IP address. May be an empty string if undetectable.
             *
             * @since 1.0.0
             * @type {string}
             */
            this.ip = '';
            /**
             * game is the title of the current channel's game as set by the broadcaster.
             *
             * @since 1.0.0
             * @type {string}
             */
            this.game = '';
            /**
             * User's current video mode. One of {@link VideoModes}.
             *
             * @since 1.0.0
             * @type {string}
             */
            this.videoMode = User.VideoModes.Default;
            /**
             * Current video bitrate. Null if no video or unknown.
             *
             * @since 1.0.0
             * @type {null|number}
             */
            this.bitrate = null;
            /**
             * Current video latency. Null if no video or unknown.
             *
             * @since 1.0.0
             * @type {null|number}
             */
            this.latency = null;
            /**
             * Current buffer size of the viewer's player. Null if no video or unknown.
             *
             * @since 1.0.0
             * @type {null|number}
             */
            this.buffer = null;
            /**
             * Current theme the user has selected on twitch. Null if unknown, otherwise "light" or "dark"
             * @type {null|string}
             */
            this.theme = null;
            /**
             * Current volume level of the Twitch video player. Values between 0 and 1.
             * @type {number}
             */
            this.volume = 0;
            // If the user has authorized an extension to see their Twitch ID, it will be
            // hidden in the JWT payload.
            this.extractJWTInfo(auth.token);
            /**
             * Offset of this user from the server time.
             * @private
             */
            this.timeOffset = 0;
        }
        Object.defineProperty(User, "Roles", {
            /**
             * Defines the current user's role on Twitch relative to the current channel being
             * viewed. May be "viewer" if the user is simply viewing the channel, "moderator"
             * if the user is a moderator of the channel or "broadcaster" if the user is also
             * the broadcaster of the channel.
             *
             * @since 1.0.3
             */
            get: function () {
                return {
                    Broadcaster: 'broadcaster',
                    Moderator: 'moderator',
                    Viewer: 'viewer'
                };
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(User, "VideoModes", {
            /**
             * Defines the video mode for the current user. This may be "default" for the default
             * windowed viewing experience on Twitch, "fullscreen" for the fullscreen, video-only
             * mode or "theatre" for the video full window-width.
             *
             * @since 1.0.3
             */
            get: function () {
                return {
                    Default: 'default',
                    Fullscreen: 'fullscreen',
                    Theatre: 'theatre'
                };
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Attempts to parse the provided JWT and persist any found information in store.
         * @since 1.0.0
         *
         * @param {Object} jwt - The auth JWT token as returned from the auth harness.
         */
        User.prototype.extractJWTInfo = function (jwt) {
            try {
                var token = Util.extractJWTInfo(jwt);
                this.role = token.role;
                if (token.user_id) {
                    this.twitchID = token.user_id;
                }
            }
            catch (err) {
                // Silently fail (enforcement of Twitch ID is done externally).
            }
        };
        /**
         * Returns whether or not the current extension user is anonymous.
         * Twitch defines an anonymous user as one who is not logged in to the channel
         * page running this extension, or one who has not opted-in to sharing
         * auth information with this extension.
         * @since 1.0.0
         *
         * @return {boolean} True if the user is not logged in to Twitch or has not granted
         * access to their Twitch ID.
         */
        User.prototype.anonymous = function () {
            return !this.twitchOpaqueID || this.twitchOpaqueID[0] !== 'U';
        };
        /**
         * Stores values from a new auth token in the local store.
         * @since 1.0.0
         *
         * @param {Object} auth - An auth JWT with updated user information.
         */
        User.prototype.updateAuth = function (auth) {
            this.twitchJWT = auth.token;
            this.extractJWTInfo(auth.token);
        };
        /**
         * Returns a date object that is based on the Muxy server time.
         *
         * @return {Date}
         */
        User.prototype.getOffsetDate = function () {
            return new Date(new Date().getTime() + this.timeOffset);
        };
        return User;
    }());

    /**
     * @module SDK
     */
    var TriviaQuestionState;
    (function (TriviaQuestionState) {
        // Inactive marks a poll as inactive. Only admins can see an inactive poll.
        TriviaQuestionState["Inactive"] = "state-inactive";
        // Unlocked marks a poll as being visible to everyone, and open to votes.
        TriviaQuestionState["Unlocked"] = "state-unlocked";
        // Unlocked marks a poll as being visible to everyone, but closed to votes. No results
        // are visible while unlocked.
        TriviaQuestionState["Locked"] = "state-locked";
        // Results marks a poll as complete, and results are available.
        TriviaQuestionState["Results"] = "state-results";
    })(TriviaQuestionState || (TriviaQuestionState = {}));
    /**
     * The Muxy Extensions SDK, used to communicate with Muxy's Extension Backend Service.
     *
     * Instances of this class created through the global `Muxy` object can be used to easily
     * interact with Muxy's Extension Backend Service. It includes functionality to aggregate
     * and persist user data, set extension configuration, send analytics events and authenticate
     * broadcasters across servers and applications.
     *
     * To begin using the SDK, create a new instance by calling `const sdk = Muxy.SDK()`.
     *
     * **Note for Overlay App Developers:**
     * An instance of the Muxy SDK is automatically created for you that is namespaced to your
     * app id. You can access it in any app that imports AppMixin as `this.muxy.<method>`. The
     * methods described below behave similarly to how they would in an extension context, however
     * all data is exclusive to your app. Differences are noted in the comments to the individual
     * methods.
     */
    var SDK = /** @class */ (function () {
        /** @ignore */
        function SDK(id) {
            if (!mxy.setupCalled) {
                throw new Error('Muxy.setup() must be called before creating a new SDK instance');
            }
            var identifier = id || mxy.twitchClientID;
            if (!identifier) {
                return null;
            }
            if (!mxy.watchingAuth) {
                mxy.watchingAuth = true;
                mxy.watchAuth(identifier);
            }
            if (!mxy.SDKClients[identifier]) {
                this.setup(identifier, mxy.client, mxy.user, mxy.messenger, mxy.analytics, mxy.loadPromise, mxy.SKUs, mxy.debugOptions);
                mxy.SDKClients[identifier] = this;
            }
            return mxy.SDKClients[identifier];
        }
        /**
         * Returns a Promise that will resolve once this SDK instance is ready for use.
         * Will reject if an error occurs communicating with the backend server.
         * @since 1.0.0
         *
         * @return {Promise}
         *
         * @example
         * const sdk = new Muxy.SDK();
         * sdk.loaded().then(() => {
         *   sdk.send('Hello World');
         * }).catch((err) => {
         *   console.error(err);
         * });
         */
        SDK.prototype.loaded = function () {
            return this.loadPromise;
        };
        /**
         * Updates the internally stored user object with the provided value.
         * Also calls any stored user update callbacks with the new user object.
         * @since 1.5
         *
         * @example
         * const sdk = new Muxy.SDK();
         * sdk.loaded().then(() => {
         *   sdk.updateUser({<user object>});
         * });
         */
        SDK.prototype.updateUser = function (user) {
            this.user = user;
            this.userObservers.notify(user);
        };
        /**
         * Registers a new callback for when the current user's info is updated.
         */
        SDK.prototype.onUserUpdate = function (callback) {
            var handler = new UserUpdateCallbackHandle(callback);
            this.userObservers.register(handler);
            return handler;
        };
        /**
         * Registers a new callback for when the context is updated.
         */
        SDK.prototype.onContextUpdate = function (callback) {
            var handler = new ContextUpdateCallbackHandle(callback);
            this.contextObservers.register(handler);
            return handler;
        };
        /**
         * Returns a date object that is based on the Muxy server time.
         * This method only returns valid results after .loaded() resolves.
         *
         * @return {Date}
         */
        SDK.prototype.getOffsetDate = function () {
            return new Date(new Date().getTime() + this.timeOffset);
        };
        /**
         * Returns a promise to get the user object. This automatically
         * waits for .loaded() to resolve.
         */
        SDK.prototype.getUser = function () {
            var _this = this;
            return this.loaded().then(function () {
                return Promise.resolve(_this.user);
            });
        };
        /**
         * Invokes a request to the backend.
         */
        SDK.prototype.signedRequest = function (method, endpoint, data) {
            return this.client.signedRequest(this.identifier, method, endpoint, data);
        };
        /**
         * Data Accumulation
         */
        /**
         * Fetches the accumulated user data for a given id received by the backend since start.
         *
         * Broadcaster-only functionality.
         *
         * @async
         * @since 1.0.0
         *
         * @throws {TypeError} Will throw an error if accumulationID is not a string.
         *
         * @param {string} accumulationID - The identifier of the accumulated data to fetch.
         * @param {number} start - A Unix timestamp in milliseconds of the earliest accumulation
         * record to fetch.
         *
         * @return {Promise<AccumulateData>} Resolves with requested accumulation data on
         * server response.
         *
         * @example
         * const oneMinuteAgo = (new Date().getTime()) - (1000 * 60);
         * sdk.getAccumulation('awesomeness_level', oneMinuteAgo).then((resp) => {
         *   console.log(`${resp.data.length}: ${resp.latest}`);
         *   console.log(resp.data); // A list of all accumulate values since oneMinuteAgo.
         * });
         */
        SDK.prototype.getAccumulateData = function (accumulationID, start) {
            forceType(accumulationID, 'string');
            return this.client.getAccumulation(this.identifier, accumulationID, start);
        };
        /**
         * @deprecated Use getAccumulateData instead.
         */
        SDK.prototype.getAccumulation = function (accumulationID, start) {
            return this.getAccumulateData(accumulationID, start);
        };
        /**
         * Sends data to be accumulated by the server.
         * @since 1.0.0
         *
         * @param {string} accumulationID - The identifier that this datum is accumulated with.
         * @param {Object} data - Any JSON serializable JavaScript object.
         *
         * @return {Promise} Will resolve on successful server-send. Rejects on failure.
         *
         * @example
         * sdk.accumulate('awesomeness_level', {
         *   awesomeness_level: {
         *     great: 10,
         *     good: 2.5,
         *     poor: 'dank'
         *   }
         * });
         */
        SDK.prototype.accumulate = function (accumulationID, data) {
            forceType(accumulationID, 'string');
            return this.client.accumulate(this.identifier, accumulationID, data);
        };
        /**
         * User Voting
         */
        /**
         * Fetches the current stored vote data for a given vote identifier.
         * @async
         * @since 1.0.0
         *
         * @throws {TypeError} Will throw an error if voteID is not a string.
         *
         * @param {string} voteID - The identifer to fetch associated vote data.
         *
         * @return {Promise<VoteData>} Resolves with requested vote data on server response. Rejects on
         * server error.
         *
         * @example
         * sdk.getVoteData('poll-number-1').then((voteData) => {
         *   console.log(voteData.sum);
         * });
         */
        SDK.prototype.getVoteData = function (voteID) {
            forceType(voteID, 'string');
            return this.client.getVotes(this.identifier, voteID);
        };
        /**
         * Gets the vote logs for a given vote ID. This endpoint may only be called by
         * an admin.
         *
         * @async
         * @param voteID - the identifier to fetch the vote logs for.
         * @return {Promise<VoteLog>} Resolves with the logs on server response. Rejects on server error.
         *
         * @example
         * const sdk = new Muxy.SDK();
         * sdk.getFullVoteLogs('global-12345').then((logs) => {
         *   const audit = logs.result;
         *
         *   // ... process the audit logs ...
         *   const valueToUsersMapping = {};
         *   for (const i = 0; i < audit.length; ++i) {
         *     const value = audit[i].value;
         *     const identifier = audit[i].identifier;
         *
         *     const list = valueToUsersMapping[value] || [];
         *     list.append(identifier);
         *
         *     valueTousersMapping[value] = list;
         *   }
         * });
         */
        SDK.prototype.getFullVoteLogs = function (voteID) {
            forceType(voteID, 'string');
            return this.client.getFullVoteLogs(this.identifier, voteID);
        };
        /**
         * Submit a user vote associated with a vote identifier.
         * @async
         * @since 1.0.0
         *
         * @throws {TypeError} Will throw an error if `voteID` is not a string or if `value` is not
         * a Number.
         *
         * @param {string} voteID - The identifer to fetch associated vote data.
         * @param {number} value - Any numeric value to represent this user's vote. Note that only
         * values of 0-5 will be included in the `specific` field returned from `getVoteData`.
         *
         * @return {Promise} Will resolve on successful server-send. Rejects on failure.
         *
         * @example
         * sdk.vote('poll-number-1', 1);
         */
        SDK.prototype.vote = function (voteID, value) {
            forceType(voteID, 'string');
            forceType(value, 'number');
            return this.client.vote(this.identifier, voteID, { value: value });
        };
        /**
         * User Ranking
         */
        /**
         * Fetches the current ranked data associated with the rank identifier.
         * @async
         * @since 1.0.0
         *
         * @throws {TypeError} Will throw an error if rankID is not a string.
         *
         * @param {string} rankID - The identifier to fetch associated rank data.
         *
         * @return {Promise<RankData>} Resolves with requested rank data on server response. Rejects
         * on server error.
         *
         * @example
         * sdk.getRankData('favorite_color').then((colors) => {
         *   if (colors.length > 0) {
         *     colors.forEach((color) => {
         *       console.log(`${color.key}: ${color.score}`);
         *     });
         *   }
         * });
         */
        SDK.prototype.getRankData = function (rankID) {
            var _this = this;
            forceType(rankID, 'string');
            return new Promise(function (accept, reject) {
                _this.client
                    .getRank(_this.identifier, rankID)
                    .then(function (data) {
                    accept(data.data);
                })
                    .catch(reject);
            });
        };
        /**
         * Submit user rank data associated with a rank identifier.
         * @async
         * @since 1.0.0
         *
         * @throws {TypeError} Will throw an error if rankID or value are not strings.
         *
         * @param {string} rankID - The identifer to fetch associated rank data.
         * @param {string} value - Any string value to represent this user's rank data. Will be returned
         * as the `key` field when rank data is requested.
         *
         * @return {Promise<RankResponse>} Will resolve on success. Rejects on failure.
         *
         * @example
         * const usersFavoriteColor = 'rebeccapurple';
         * this.muxy.rank('favorite_color', usersFavoriteColor);
         */
        SDK.prototype.rank = function (rankID, value) {
            forceType(rankID, 'string');
            forceType(value, 'string');
            return this.client.rank(this.identifier, rankID, { key: value });
        };
        /**
         * Clear all rank data associated with the rank identifier.
         *
         * Broadcaster-only functionality.
         *
         * @async
         * @since 1.0.0
         *
         * @throws {TypeError} Will throw an error if rankID is not a string.
         *
         * @param {string} rankID - The identifer to fetch associated rank data.
         *
         * @return {Promise} Will resolve on success. Rejects on failure.
         */
        SDK.prototype.clearRankData = function (rankID) {
            forceType(rankID, 'string');
            return this.client.deleteRank(this.identifier, rankID);
        };
        /**
         * @deprecated Deprecated in 1.0.0. Use getRankData instead.
         */
        SDK.prototype.getRankingData = function (rankID) {
            return this.getRankData(rankID);
        };
        /**
         * @deprecated Deprecated in 1.0.0. Use clearRankData instead.
         */
        SDK.prototype.clearRanking = function (rankID) {
            return this.clearRanking(rankID);
        };
        /**
         * User State
         */
        /**
         * Sets the channel specific viewer-specific state to a JS object, this can be called by
         * any viewer.
         * Future calls to {@link getAllState} by **this** user will have a clone of this object in the
         * `viewer` field.
         * @async
         * @since 1.0.0
         *
         * @param {Object} state - A complete JS object representing the current viewer state.
         *
         * @return {Promise} Will resolve on successful server-send. Rejects on failure.
         *
         * @example
         * sdk.setViewerState({
         *   favorite_movie: 'Jaws: The Revenge'
         * }).then(() => {
         *   console.log('Viewer state saved!');
         * }).catch((err) => {
         *   console.error(`Failed saving viewer state: ${err}`);
         * });
         */
        SDK.prototype.setViewerState = function (state) {
            return this.client.setViewerState(this.identifier, state);
        };
        /**
         * Sets the extension wide viewer-specific state to a JS object, this is only a valid call for a
         * user that has shared their identity.
         * Future calls to {@link getAllState} by **this** user will have a clone of this object in the
         * `extension_viewer` field.
         * @async
         * @since 1.1.0
         *
         * @param {Object} state - A complete JS object representing the current viewer state.
         *
         * @return {Promise} Will resolve on successful server-send. Rejects on failure.
         *
         * @example
         * sdk.setExtensionViewerState({
         *   favorite_movie: 'Jaws: The Revenge'
         * }).then(() => {
         *   console.log('Viewer state saved!');
         * }).catch((err) => {
         *   console.error(`Failed saving viewer state: ${err}`);
         * });
         */
        SDK.prototype.setExtensionViewerState = function (state) {
            return this.client.setExtensionViewerState(this.identifier, state);
        };
        /**
         * Applies a set of patches to multiple extension-wide viewer-specific states.
         * This method requires a mapping of user_id to objects. The provided state
         * objects per user are merged server-side. A key may be specified to be 'null'
         * to delete the key on the server. Arrays are overwritten in their entirety on merge.
         * Objects are merged recursively.
         *
         * This method can only set state for viewers who have shared their ID.
         *
         * This method requires an admin context.
         * @async
         * @param userStates - a mapping of userID to patch objects.
         *
         * @return {Promise} Will resolve on successful setting of state. Rejects on failure.
         *
         * @example
         * sdk.patchExtensionViewerState({
         *  '12452': { 'hello': 'world' },
         *  '12422': { 'foo': 'bar' }
         * });
         */
        SDK.prototype.patchExtensionViewerState = function (userStates) {
            return this.client.patchExtensionViewerState(this.identifier, userStates);
        };
        /**
         * Sets the extension wide state to a JS object, this may only be called in a broadcaster context
         * for the extension owner. Extension owner may be configured through the development portal.
         * Future calls to {@link getAllState} by all users will have a clone of this object in the
         * `extension` field.
         * @async
         * @since 1.1.0
         *
         * @param {Object} state - A complete JS object representing the current extension's state.
         *
         * @return {Promise} Will resolve on successful server-send. Rejects on failure.
         *
         * @example
         * sdk.setExtensionState({
         *   favorite_movie: 'Jaws: The Revenge'
         * }).then(() => {
         *   console.log('Extension state saved!');
         * }).catch((err) => {
         *   console.error(`Failed saving viewer state: ${err}`);
         * });
         */
        SDK.prototype.setExtensionState = function (state) {
            return this.client.setExtensionState(this.identifier, state);
        };
        /**
         * Sets the extension-wide secret state to a JS object, this may only be called by an extension
         * owner. This state object will never be returned to the broadcaster or viewers.
         * @async
         * @since 2.0.0
         *
         * @param {Object} state - A complete JS object
         *
         * @return {Promise} Will resolve on successful server-send. Rejects on failure.
         *
         * @example
         * sdk.setExtensionSecretState({
         *   favorite_movie: 'Twilight: New Moon'
         * }).then(() => {
         *   console.log('Extension secrets saved!');
         * }).catch((err) => {
         *   console.error(`Failed saving secret state: ${err}`);
         * });
         */
        SDK.prototype.setExtensionSecretState = function (state) {
            return this.client.setExtensionSecretState(this.identifier, state);
        };
        /**
         * Sets the channel-specific state to a JS object. Future calls to {@link getAllState} by **any**
         * user on this channel will have a clone of this object in the `channel` field.
         *
         * Broadcaster-only functionality.
         *
         * @async
         * @since 1.0.0
         *
         * @param {Object} state - A complete JS object representing the current channel state.
         *
         * @return {Promise} Will resolve on successful server-send. Rejects on failure.
         *
         * @example
         * sdk.setChannelState({
         *   broadcasters_mood: 'sanguine, my brother',
         *   chats_mood: 'kreygasm'
         * }).then(() => {
         *   // Let viewers know that new channel state is available.
         * }).catch((err) => {
         *   console.error(`Failed saving channel state: ${err}`);
         * });
         */
        SDK.prototype.setChannelState = function (state) {
            return this.client.setChannelState(this.identifier, state);
        };
        /**
         * Returns the current state object as set for the current extension, channel and
         * viewer combination.
         * @async
         * @since 1.0.0
         *
         * @return {Promise<AllState>} Resolves on successful server request with a populated AllState
         * object.
         *
         * @example
         * sdk.getAllState().then((state) => {
         *   if (state.channel.broadcasters_mood) {
         *     console.log(`Broadcaster set their mood as: ${state.channel.broadcasters_mood}`);
         *   }
         *   if (state.viewer.favorite_movie) {
         *     console.log(`But your favorite movie is: ${state.viewer.favorite_movie}`);
         *   }
         * });
         */
        SDK.prototype.getAllState = function () {
            return this.client.getState(this.identifier);
        };
        /**
         * Returns the current extension state object
         * @async
         *
         * @return {Promise<Object>} Resolves on successful server request with a populated extension state object.
         */
        SDK.prototype.getExtensionState = function () {
            return this.client.getExtensionState(this.identifier);
        };
        /**
         * Returns the current channel state object
         * @async
         *
         * @return {Promise<Object>} Resolves on successful server request with a populated channel state object.
         */
        SDK.prototype.getChannelState = function () {
            return this.client.getChannelState(this.identifier);
        };
        /**
         * Returns the current extension viewer state object
         * @async
         *
         * @return {Promise<Object>} Resolves on successful server request with a populated extension viewer state object.
         */
        SDK.prototype.getExtensionViewerState = function () {
            return this.client.getExtensionViewerState(this.identifier);
        };
        /**
         * Returns the current viewer state object
         * @async
         *
         * @return {Promise<Object>} Resolves on successful server request with a populated viewer state object.
         */
        SDK.prototype.getViewerState = function () {
            return this.client.getViewerState(this.identifier);
        };
        /**
         * Returns the current extension secret state if the requesting user has access to the secret state.
         * @async
         *
         * @return {Promise<Object>} Resolves on successful server request with a populated extension secret state object.
         */
        SDK.prototype.getExtensionSecretState = function () {
            return this.client.getExtensionSecretState(this.identifier);
        };
        /**
         * Returns a mapping of user_id to extension specific viewer states.
         * If a viewer doesn't have state set, but was requested, that user will
         * not be in the response object. The maximum numer of users that can be
         * queried with this call is 1000.
         * @async
         *
         * @param users - an array of userIDs to request state for.
         *
         * @return {Promise<object>} Resolves on successful server request with an object that is a mapping
         *  of userID to state. Rejects on failure.
         *
         * @example
         * sdk.patchExtensionViewerState({
         *  'valid-user-id': {
         *    'hello': 'world'
         *  }
         * }).then(() => {
         *  sdk.multiGetExtensionViewerState(['valid-user-id', 'invalid-user-id']).then(state => {
         *    console.log(state['valid-user-id'].hello) // prints 'world'
         *    console.log(state['invalid-user-id']) // is undefined.
         *  });
         * }
         */
        SDK.prototype.multiGetExtensionViewerState = function (users) {
            if (users.length > 1000) {
                throw new Error('Too many users specified in call to multiGetExtensionViewerState');
            }
            return this.client.multiGetExtensionViewerState(this.identifier, users);
        };
        /**
         * JSON Store
         */
        /**
         * The JSON store is used similarly to the channel state, in that a broadcaster can use it to
         * store arbitrary JSON data that is accessible to all viewers. The stored data is specific to
         * a particular channel and cannot be accessed by viewers of a different channel.
         *
         * Unlike channel state however, each channel can have several JSON stores, accessed by different
         * keys. The data associated with each key must be under 2KB, but there is no limit to the number
         * of keys in use.
         *
         * Also, when pushing new data to the JSON store, a messenger event is automatically sent to all
         * active viewers of the associated channel and the broadcaster's live and config pages. This
         * event will have the format `json_store_update:${key}`. See {@link listen} for details on
         * receiving this event.
         *
         * @async
         * @since 1.0.0
         *
         * @throws {TypeError} Will throw an error if key is provided but is not a string.
         *
         * @param {string?} key - The lookup key for data in the JSON store. Uses 'default' if no value
         * is provided.
         *
         * @return {Promise<Object>} Resolves with the stored JSON parsed to a JS Object associated with
         * the key. Rejects on server error or if the key has no associated data.
         *
         * @example
         * sdk.getJSONStore('basecamp').then((basecamp) => {
         *   if (basecamp && basecamp.tanks) {
         *     deploy(basecamp.tanks);
         *   }
         * });
         */
        SDK.prototype.getJSONStore = function (key) {
            if (key) {
                forceType(key, 'string');
            }
            return this.client.getJSONStore(this.identifier, key);
        };
        /**
         * Two-Factor Auth
         */
        /**
         * Attempts to validate a broadcaster's PIN with Muxy's Two-Factor auth system. For this to work,
         * the broadcaster must have initiated a Two-Factor request for this channel within the auth
         * window.
         *
         * Broadcaster-only functionality.
         *
         * @async
         * @since 1.0.0
         *
         * @throws {TypeError} Will throw an error if `pin` is not a string.
         *
         * @param {string} pin - The broadcaster's PIN to validate the associated auth token.
         *
         * @return {Promise} Resolves if the auth token associated with this PIN can now be used to make
         * requests on behalf of this broadcaster, rejects with an error otherwise.
         *
         * @example
         * sdk.validateCode('MUXY').then(() => {
         *   console.log('Validated! Go go go!');
         * });
         */
        SDK.prototype.validateCode = function (pin) {
            forceType(pin, 'string');
            return this.client.validateCode(this.identifier, pin);
        };
        /**
         * Checks to see if the broadcaster has validated an auth token in the current context. It does
         * not return information about the PIN used or auth token that is valid.
         *
         * Broadcaster-only functionality.
         *
         * @async
         * @since 1.0.0
         *
         * @return {Promise<Object>}
         * @property {boolean} exists - True if an auth token has been validated, false otherwise.
         *
         * @example
         * sdk.pinTokenExists().then((resp) => {
         *   if (!resp.exists) {
         *     showBroadcasterPINInput();
         *   } else {
         *     console.log('Already authorized');
         *   }
         * });
         */
        SDK.prototype.pinTokenExists = function () {
            return this.client.pinTokenExists(this.identifier);
        };
        /**
         * Revokes all auth tokens ever generated for this channel and identifier. After calling this
         * method, tokens currently in use by external apps will cease to function.
         *
         * Broadcaster-only functionality.
         *
         * @async
         * @since 1.0.0
         *
         * @return {Promise} Resolves on sucess, rejects with an error otherwise.
         *
         * @example
         * sdk.revokeAllPINCodes().then(() => {
         *   console.log('No more data coming in!');
         * });
         */
        SDK.prototype.revokeAllPINCodes = function () {
            return this.client.revokeAllPINCodes(this.identifier);
        };
        /**
         * Event System
         */
        /**
         * Sends a message to all listening clients. And viewers or broadcaters listening for the
         * event name will be automatically notified. See {@link listen} for receiving events.
         *
         * Broadcaster-only functionality.
         *
         * @async
         * @since 1.0.0
         *
         * @param {string} event - An event name, in the form [a-z0-9_]+
         * @param {string|*} userID - An optional opaque user id, used to limit the
         * scope of send to that user only.
         * @param {*} [data] - Any JSON serializable primitive to send to all viewers.
         *
         * @example
         * sdk.send('new_song', {
         *   artist: 'Celine Dion',
         *   title: 'My Heart Will Go On',
         *   album: 'Let\'s Talk About Love',
         *   year: 1997
         * });
         */
        SDK.prototype.send = function (event, userID, data) {
            if (!mxy.didLoad) {
                throw new Error('sdk.loaded() was not complete. Please call this method only after the promise has resolved.');
            }
            forceType(event, 'string');
            var target = 'broadcast';
            var realData = data;
            if (!data) {
                realData = userID;
            }
            else {
                target = "whisper-" + userID;
            }
            this.messenger.send(this.identifier, event, target, realData, this.client);
        };
        /**
         * Registers a callback to listen for events. In general, events are named in the form
         * `event[:identifier]`, where the identifier is the `event` parameter to {@link send}.
         *
         * You can listen to wildcards by using * instead of an event or identifier name.
         *
         * Some methods also automatically send special namespaced events. See {@link vote} and
         * {@link getJSONStore} for examples.
         *
         * You can listen for these events by using `vote_update:next_game` or `vote_update:*`
         * to receive vote updates for specifically the `next_game` vote id, or all vote
         * updates respectively.
         *
         * @since 1.0.0
         *
         * @param {string} inEvent - The event name to listen on. May include wildcards `*`.
         * @param {string|Function} inUserID - An optional opaque user id, used to limit
         * the scope of this listen to that user only.
         * @param {Function} [inCallback] - A callback with the signature `function(body, eventname)`.
         * This callback will receive the message body as its first parameter and the `event` parameter
         * to {@link send} as the second.
         *
         * @return {Object} A listener handle that can be passed to {@see unlisten} to unbind
         * this callback.
         *
         * @example
         * sdk.listen('new_song', (track) => {
         *   console.log(`${track.artist} - {track.title} (${track.year})`);
         * });
         */
        SDK.prototype.listen = function (inEvent, inUserID, inCallback) {
            var _this = this;
            if (!mxy.didLoad) {
                throw new Error('sdk.loaded() was not complete. Please call this method only after the promise has resolved.');
            }
            var realEvent = CurrentEnvironment().environment + ":" + this.identifier + ":" + inEvent;
            var l = 'broadcast';
            var callback = inCallback;
            if (callback) {
                l = "whisper-" + inUserID;
            }
            else {
                callback = inUserID;
            }
            var messageBuffer = [];
            var cb = function (msg) {
                try {
                    // Production messages may be unprefixed.
                    if (CurrentEnvironment().environment === 'production') {
                        if (eventPatternMatch(msg.event, _this.identifier + ":" + inEvent)) {
                            var truncatedEvent = msg.event
                                .split(':')
                                .slice(1)
                                .join(':');
                            callback(msg.data, truncatedEvent);
                            return;
                        }
                    }
                    if (eventPatternMatch(msg.event, realEvent)) {
                        // Consumers of the SDK only ever interact with events
                        // without the app-id or extension-id prefix.
                        var truncatedEvent = msg.event
                            .split(':')
                            .slice(2)
                            .join(':');
                        var serialized_1 = JSON.stringify(msg);
                        var now_1 = new Date().valueOf();
                        var deduped_1 = false;
                        messageBuffer.forEach(function (b) {
                            if (b.content === serialized_1) {
                                if (now_1 - b.timestamp < 5 * 1000) {
                                    deduped_1 = true;
                                }
                            }
                        });
                        if (deduped_1) {
                            return;
                        }
                        messageBuffer.unshift({
                            content: serialized_1,
                            timestamp: now_1
                        });
                        messageBuffer = messageBuffer.slice(0, 10);
                        callback(msg.data, truncatedEvent);
                    }
                }
                catch (err) {
                    // TODO: Should this fail silently?
                    consolePrint(err, { type: 'error' });
                }
            };
            return this.messenger.listen(this.identifier, l, cb);
        };
        /**
         * Unbinds a callback from the event system.
         *
         * @since 1.0.0
         *
         * @param {Object} handle - An event handle as returned from {@see listen}.
         */
        SDK.prototype.unlisten = function (handle) {
            return this.messenger.unlisten(this.identifier, handle);
        };
        /**
         * Analytics
         */
        /**
         * Sends an arbitrary event to the analytics backend.
         *
         * @async
         * @since 1.0.0
         *
         * @param {string} name - A unique identifier for this event.
         * @param {number} [value=1] - A value to associate with this event.
         * @param {string} [label=''] - A human-readable label for this event.
         */
        SDK.prototype.sendAnalyticsEvent = function (name, value, label) {
            if (value === void 0) { value = 1; }
            if (label === void 0) { label = ''; }
            this.analytics.sendEvent(this.identifier, name, value, label);
        };
        /**
         * Monetization
         */
        /**
         * Begins the purchase flow for a given product's SKU.
         *
         * @param {string} sku - The SKU of the digital good that the user has indicated they want to buy.
         */
        SDK.prototype.beginPurchase = function (sku) {
            if (this.SKUs.length === 0) {
                throw new Error('beginPurchase() cannot be used unless SKUs are provided.');
            }
            forceType(sku, 'string');
            return Ext.beginPurchase(sku);
        };
        /**
         * Gets the current price for each item offered.
         *
         * @async
         *
         * @return {Object} An object with the SKU codes as keys.
         */
        SDK.prototype.getPrices = function () {
            if (this.SKUs.length === 0) {
                throw new Error('getPrices() cannot be used unless SKUs are provided.');
            }
            return new Promise(function (resolve) {
                Ext.getPrices(function (prices) {
                    resolve(prices);
                });
            });
        };
        /**
         * Sets a function to be used as a callback when entitlements need to be reloaded, i.e. after a
         * purchase has been made.
         *
         * @param {function} callback - A function to be called to update user entitlements.
         */
        SDK.prototype.onReloadEntitlements = function (callback) {
            if (this.SKUs.length === 0) {
                throw new Error('onReloadEntitlements() cannot be used unless SKUs are provided.');
            }
            return Ext.onReloadEntitlements(callback);
        };
        /**
         * Sets a function to be used as a callback that is triggered when the extension visibility changes
         * (This occurs only for mobile or component extensions.)
         *
         * @param {function} callback
         */
        SDK.prototype.onVisibilityChanged = function (callback) {
            return Ext.onVisibilityChanged(callback);
        };
        /**
         * Sets a function to be used as a callback that is triggered when the extension changes position in the player
         * This occurs only for video-component extensions.
         *
         * @param {function} callback
         */
        SDK.prototype.onPositionChanged = function (callback) {
            return Ext.onPositionChanged(callback);
        };
        /**
         * Attempt to exchange one eligibility status for a single prize code.
         * If a code is redeemed, the returned body will have a `code` member, which is the code that was redeemed.
         * @async
         *
         * @throws {TypeError} Will throw an error if prizeIndex is not a valid number
         *
         * @param {number} prize_idx - The prize index
         *
         * @return {Promise<RedeemResult>}
         */
        SDK.prototype.redeemCode = function (prizeIndex) {
            forceType(prizeIndex, 'number');
            return this.client.redeemCode(this.identifier, prizeIndex);
        };
        /**
         * Fetches all codes that the user has redeemed for this extension.
         * @async
         *
         * @return {Promise<RedeemedCodes>} Will resolve on success. Rejects on failure.
         */
        SDK.prototype.getRedeemedCodes = function () {
            return this.client.getRedeemedCodes(this.identifier);
        };
        /**
         * Fetches information about which codes a user is eligible for
         * @async
         *
         * @return {Promise<EligibleCodes>} Will resolve on success. Rejects on failure.
         */
        SDK.prototype.getEligibleCodes = function () {
            return this.client.getEligibleCodes(this.identifier);
        };
        /**
         * Sets the user's trivia team to the current channel.
         * @async
         *
         * @return {Promise<any>}
         */
        SDK.prototype.joinExtensionTriviaTeam = function () {
            return this.client.joinExtensionTriviaTeam(this.identifier);
        };
        /**
         * Return the user's stored trivia team.
         * @async
         *
         * @return {Promise<TriviaTeam>}
         */
        SDK.prototype.getExtensionTriviaJoinedTeam = function () {
            return this.client.getExtensionTriviaJoinedTeam(this.identifier);
        };
        /**
         * Add a trivia question to the extension.
         * Requires extension admin permissions.
         * @async
         *
         * @return {Promise<any>}
         */
        SDK.prototype.addExtensionTriviaQuestion = function (question) {
            return this.client.addExtensionTriviaQuestion(this.identifier, question);
        };
        /**
         * Removes a trivia question from the extension.
         * Requires extension admin permissions.
         * @async
         *
         * @return {Promise<any>}
         */
        SDK.prototype.removeExtensionTriviaQuestion = function (triviaQuestionID) {
            return this.client.removeExtensionTriviaQuestion(this.identifier, triviaQuestionID);
        };
        /**
         * Add an option to a trivia question.
         * Requires extension admin permissions.
         * @async
         *
         * @return {Promise<any>}
         */
        SDK.prototype.addExtensionTriviaOptionToQuestion = function (questionID, option) {
            return this.client.addExtensionTriviaOptionToQuestion(this.identifier, questionID, option);
        };
        /**
         * Remove an option from a trivia question.
         * Requires extension admin permissions.
         * @async
         *
         * @return {Promise<any>}
         */
        SDK.prototype.removeExtensionTriviaOptionFromQuestion = function (questionID, optionID) {
            return this.client.removeExtensionTriviaOptionFromQuestion(this.identifier, questionID, optionID);
        };
        /**
         * Change the state of a extension trivia question.
         * Requires extension admin permissions.
         * @async
         *
         * @return {Promise<any>}
         */
        SDK.prototype.setExtensionTriviaQuestionState = function (questionID, state, winner) {
            return this.client.setExtensionTriviaQuestionState(this.identifier, questionID, state, winner);
        };
        /**
         * As a user place a vote on a trivia question
         * @async
         *
         * @return {Promise<any>}
         */
        SDK.prototype.setExtensionTriviaQuestionVote = function (questionID, optionID) {
            return this.client.setExtensionTriviaQuestionVote(this.identifier, questionID, optionID);
        };
        /**
         * Returns all of the current trivia questions
         * @async
         *
         * @return {Promise<TriviaQuestionResponse>}
         */
        SDK.prototype.getExtensionTriviaQuestions = function () {
            return this.client.getExtensionTriviaQuestions(this.identifier);
        };
        /**
         * Get information about a specific trivia question
         * @async
         *
         * @return {Promise<TriviaQuestion>}
         */
        SDK.prototype.getExtensionTriviaQuestion = function (questionID) {
            return this.client.getExtensionTriviaQuestion(this.identifier, questionID);
        };
        /**
         * Return the trivia leaderboard
         * @async
         *
         * @return {Promise<TriviaLeaderboardTeam[]>}
         */
        SDK.prototype.getExtensionTriviaLeaderboard = function () {
            return this.client.getExtensionTriviaLeaderboard(this.identifier);
        };
        /**
         * Admin-level functionality
         */
        /**
         * Fetches a list of all users who have shared their identity with the extension.
         *
         * This function takes an optional `next` value which should match that returned from previous
         * invocations to iterate through the response. If the returned `next` value is `0`, all
         * available values have been returned and iteration can be stopped.
         *
         * At most 1000 entries will be returned in a single call.
         *
         * Note that because of the asynchronous nature, duplicate entries may be returned and should be
         * uniqued on the client.
         *
         * Admin-only function.
         * @async
         *
         * @return {Promise<ExtensionUsersResult>} Will resolve on success. Rejects on failure.
         */
        SDK.prototype.getExtensionUsers = function (next) {
            return this.client.getExtensionUsers(this.identifier, next);
        };
        /**
         * Private Instance Methods
         */
        /** @ignore */
        SDK.prototype.setup = function (identifier, client, user, messenger, analytics, loadPromise, SKUs, debug) {
            /** @ignore */
            this.userObservers = new Observer();
            /** @ignore */
            this.contextObservers = new Observer();
            /** @ignore */
            this.loadPromise = loadPromise;
            /**
             * A unique instance identifier. Either the extension or app ID.
             * @public
             * @type {string}
             */
            this.identifier = identifier;
            /**
             * The backend state client.
             * @private
             * @type {Client}
             *
             */
            this.client = client;
            /**
             * The backend event messenger client.
             * @private
             * @type {Messenger}
             *
             */
            this.messenger = messenger;
            /**
             * The backend analytics client.
             * @private
             * @type {Analytics}
             *
             */
            this.analytics = analytics;
            /**
             * An automatically updated User instance for the current extension user.
             * This is only valid after .loaded() has resolved.
             * @public
             * @type {User}
             */
            this.user = user;
            /**
             * SKUs associated with the products offered in the extension.
             * @public
             * @type {Object}
             */
            this.SKUs = SKUs;
            /** @ignore */
            this.debug = debug;
        };
        return SDK;
    }());

    /**
     * A single good object as from {@link getUserGoods}.
     *
     * @typedef {Object} ExtensionGood
     *
     * @property {string} next_instruction - The next instruction (action) for the purchase. Can be:
     *   - "NOOP" - No action is needed, the good was fullfilled.
     *   - "FULFILL" - Fulfill the purchase, then call the Twitch entitlement system to indicate
     *     successful completion of the fullfillment.
     *   - "REVOKE" - Unwind the transaction.
     * @property {string} receipt_id - An ID which uniquely identifies the purchase transaction.
     * @property {string} sku - The SKU for the digital good.
     */
    /**
     * A receipt detailing which good's fulfillment status needs to be set. Used as a parameter for
     * {@link updateFulfilledGoods}.
     *
     * @typedef {Object} Receipt
     *
     * @property {string} fulfillment_address - Twitch User ID
     * @property {string} receipt_id - Receipt ID for the digital good, returned by {@link getUserGoods}
     * @property {string} last_instruction - The last thing you did. Corresponds to the "next
     * instruction" for the purchase returned by {@link getUserGoods}. Value value: `FULFILL`.
     */
    /**
     * Provides a convenient interface for Twitch API requests with an automatically set and updated
     * extension client id.
     *
     * Should not normally be created directly, instead an instance is made available
     * and namespaced appropriately when using {@link Muxy.TwitchClient}.
     *
     * @private
     *
     * @example
     * const twitchClient = new Muxy.TwitchClient();
     * twitchClient.getAllState().then((state) => {
     *   console.log(state);
     * });
     */
    var TwitchClient = /** @class */ (function () {
        /**
         * Create an instance of TwitchClient bound to the provided client ID.
         *
         * Prefer {@link Muxy.TwitchClient} instead.
         *
         * @since 1.0.0
         * @ignore
         *
         * @param {string} clientID - A valid Twitch Extension Client ID.
         */
        function TwitchClient(clientID) {
            /** @ignore */
            this.extensionId = clientID;
            /** @ignore */
            this.promise = Promise.resolve();
        }
        /**
         * Returns a promise which will resolve once the TwitchClient is available for use.
         *
         * @since 1.0.0
         * @public
         *
         * @return {Promise} Will resolve when the TwitchClient is ready for use.
         */
        TwitchClient.prototype.loaded = function () {
            return this.promise;
        };
        /**
         * Wraps an AJAX request to Twitch's kraken API. Used internally by the API
         * convenience methods.
         *
         * @async
         * @since 1.0.0
         * @ignore
         *
         * @param {string} method - The AJAX request method, e.g. "POST", "GET", etc.
         * @param {string} endpoint - The Twitch kraken API endpoint.
         * @param {string?} data - A string-encoded JSON payload to send with the request.
         * @param {Object} JWT - Signed JWT, accessible from sdk.user.twitchJWT.
         *
         * @return {Promise} Resolves with the AJAX payload on response < 400.
         * Rejects otherwise.
         */
        TwitchClient.prototype.signedTwitchRequest = function (method, endpoint, data, JWT) {
            var headers = {
                Accept: 'application/vnd.twitchtv.v5+json',
                'Client-ID': this.extensionId,
                Authorization: undefined
            };
            if (JWT) {
                headers.Authorization = "Bearer " + JWT;
            }
            return new Promise(function (resolve, reject) {
                var xhrPromise = new XHRPromise({
                    data: data,
                    headers: headers,
                    method: method,
                    url: "https://api.twitch.tv/kraken/" + endpoint
                });
                return xhrPromise
                    .send()
                    .catch(reject)
                    .then(function (resp) {
                    if (resp.status < 400) {
                        resolve(resp.responseText);
                    }
                    reject(resp.responseText);
                });
            });
        };
        /**
         * Wraps an AJAX request to Twitch's helix API. Used internally by the API
         * convenience methods.
         *
         * @async
         * @ignore
         *
         * @param {string} method - The AJAX request method, e.g. "POST", "GET", etc.
         * @param {string} endpoint - The Twitch helix API endpoint.
         * @param {string?} data - A string-encoded JSON payload to send with the request.
         * @param {Object} JWT - Signed JWT, accessible from sdk.user.twitchJWT.
         *
         * @return {Promise} Resolves with the AJAX payload on response < 400.
         * Rejects otherwise.
         */
        TwitchClient.prototype.signedTwitchHelixRequest = function (method, endpoint, data, JWT) {
            var headers = {
                Authorization: undefined,
                'Client-ID': this.extensionId
            };
            if (JWT) {
                headers.Authorization = "Bearer " + JWT;
            }
            return new Promise(function (resolve, reject) {
                var xhrPromise = new XHRPromise({
                    data: data,
                    headers: headers,
                    method: method,
                    url: "https://api.twitch.tv/helix/" + endpoint
                });
                return xhrPromise
                    .send()
                    .then(function (resp) {
                    if (resp.status < 400) {
                        try {
                            if (resp.responseText.hasOwnProperty('data')) {
                                var anyResp = resp.responseText;
                                var r = anyResp.data;
                                resolve(r);
                            }
                            else {
                                resolve(resp.responseText);
                            }
                        }
                        catch (err) {
                            reject('Unexpected response from Twitch');
                        }
                    }
                    reject(resp.responseText);
                })
                    .catch(reject);
            });
        };
        /**
         * Wraps an AJAX request to Twitch's Extension API. Used internally by the API
         * convenience methods.
         *
         * @async
         * @ignore
         *
         * @param {string} method - The AJAX request method, e.g. "POST", "GET", etc.
         * @param {string} endpoint - The Twitch Extension API endpoint.
         * @param {string?} data - A string-encoded JSON payload to send with the request.
         * @param {Object} JWT - Signed JWT, accessible from sdk.user.twitchJWT.
         *
         * @return {Promise} Resolves with the AJAX payload on response < 400.
         * Rejects otherwise.
         */
        TwitchClient.prototype.signedTwitchExtensionRequest = function (method, endpoint, data, JWT) {
            var headers = {
                'Client-ID': this.extensionId,
                Authorization: undefined
            };
            if (JWT) {
                headers.Authorization = "Bearer " + JWT;
            }
            return new Promise(function (resolve, reject) {
                var xhrPromise = new XHRPromise({
                    data: data,
                    headers: headers,
                    method: method,
                    url: "https://api.twitch.tv/extensions/" + endpoint
                });
                return xhrPromise
                    .send()
                    .catch(reject)
                    .then(function (resp) {
                    if (resp.status < 400) {
                        resolve(resp.responseText);
                    }
                    reject(resp.responseText);
                });
            });
        };
        /**
         * Returns a list of Twitch User objects for a given list of usernames.
         *
         * @async
         * @since 1.0.0
         *
         * @throws {TypeError} Will throw an error if users is not an array of strings.
         *
         * @param {[]string} usernames - A list of usernames to lookup on Twitch.
         *
         * @return {Promise<[]TwitchUser>} Resolves with a list of {@link TwitchUser}
         * objects for each of the usernames provided.
         *
         * @example
         * twitchClient.getTwitchUsers(['muxy'], (response) => {
         *  console.log(response.users[0].display_name);
         * });
         */
        TwitchClient.prototype.getTwitchUsers = function (usernames) {
            if (usernames.length === 0) {
                return Promise.resolve([]);
            }
            return this.signedTwitchRequest('GET', "users?login=" + usernames.join(','));
        };
        /**
         * Returns a list of Twitch User objects for a given list of user IDs.
         *
         * @async
         *
         * @throws {TypeError} Will throw an error if userIDs is not an array of strings.
         *
         * @param {[]string} userIDs - A list of user IDs to lookup on Twitch.
         *
         * @return {Promise<[]HelixTwitchUser>} Resolves with a list of {@link HelixTwitchUser}
         * objects for each of the user IDs provided.
         *
         * @example
         * twitchClient.getTwitchUsersByID(['126955211'], (response) => {
         *  console.log(response.users[0].display_name);
         * });
         */
        TwitchClient.prototype.getTwitchUsersByID = function (userIDs) {
            if (userIDs.length === 0) {
                return Promise.resolve([]);
            }
            return this.signedTwitchHelixRequest('GET', "users?id=" + userIDs.join(','));
        };
        /**
         * Monetization
         */
        /**
         * Gets a list of the digital goods the current user has.
         *
         * @param {Object} jwt - Signed JWT, accessible from sdk.user.twitchJWT
         *
         * @return {Promise<[]ExtensionGood>} Resolves with a list of {@link ExtensionGood} objects for
         * each of the goods the user is entitled to.
         */
        TwitchClient.prototype.getUserGoods = function (jwt) {
            return this.signedTwitchRequest('POST', 'commerce/user/goods', '{}', jwt);
        };
        /**
         * Sets the fulfillment status for the specified receipts (purchases).
         *
         * @param {Object} jwt - Signed JWT, accessible from sdk.user.twitchJWT
         * @param {[]Receipt} receipts - List of {@link Receipt} objects detailing which goods need to be
         * updated.
         *
         * @return {Promise<[]Object>} Resolves with a list of results, one for each Receipt in the
         * Receipts parameter.
         */
        TwitchClient.prototype.updateFulfilledGoods = function (jwt, receipts) {
            return this.signedTwitchRequest('POST', 'commerce/user/goods/fulfill', receipts, jwt);
        };
        /**
         * Sets the required configuration string enabling an extension to be enabled
         *
         * SEE: https://dev.twitch.tv/docs/extensions/reference/#set-extension-required-configuration
         *
         * @param jwt - Signed JWT, accessible from sdk.user.twitchJWT
         * @param configurationString - A string that matches the required configuration string in the extension config
         */
        TwitchClient.prototype.setExtensionRequiredConfiguration = function (jwt, configurationString) {
            var environment = Util.getTwitchEnvironment();
            var data = { required_configuration: configurationString };
            var token = Util.extractJWTInfo(jwt);
            return this.signedTwitchExtensionRequest('PUT', this.extensionId + "/" + environment.version + "/required_configuration?channel_id=" + token.channel_id, JSON.stringify(data), jwt);
        };
        return TwitchClient;
    }());

    var author = "Muxy, Inc.";
    var version = "2.2.6";
    var repository = "https://github.com/muxy/extensions-js";

    /**
     * @module Muxy
     */
    /**
     * The main extension entry interface, available as the global `Muxy` object.
     *
     * This class handles environment detection, data harness collection and updates (for
     * authentication and backend communication) and SDK instance creation.
     *
     * On import or inclusion in an HTML file, a singleton object will be globally accessible
     * as `Muxy`.
     */
    var Muxy = /** @class */ (function () {
        /**
         * Private constructor for singleton use only.
         * @ignore
         */
        function Muxy() {
            var _this = this;
            /**
             * Returns a version of the Muxy SDK associated with the provided identifier.
             * @since 1.0.0
             * @public
             *
             * @param {string?} id - A unique identifier for this extension or app. If omitted, the
             * extension client id will be used.
             *
             * @throws {Error} Will throw an error if called before {@link Muxy.setup}.
             *
             * @returns {SDK} An instance of the SDK class.
             *
             * @example
             * const sdk = new Muxy.SDK();
             * sdk.loaded().then(() => {
             *   sdk.send('Hello World');
             * }).catch((err) => {
             *   console.error(err);
             * });
             */
            this.SDK = SDK;
            /**
             * Makes trivia state enum available from the global `Muxy` object
             */
            this.TriviaQuestionState = TriviaQuestionState;
            this.Util = Util;
            this.setupCalled = false;
            this.testChannelID = '23161357';
            this.testJWTRole = 'viewer';
            this.twitchClientID = '';
            this.SDKClients = {};
            this.client = null;
            this.messenger = null;
            this.cachedTwitchClient = null;
            this.analytics = null;
            this.user = null;
            this.didLoad = false;
            this.loadPromise = new Promise(function (resolve, reject) {
                /** @ignore */
                _this.loadResolve = resolve;
                /** @ignore */
                _this.loadReject = reject;
            });
            this.SKUs = [];
            this.debugOptions = null;
            this.watchingAuth = false;
            StateClient.setEnvironment(Util.currentEnvironment(), null);
        }
        /**
         * Prints to console a description of the library's current version and
         * environment info. This is called automatically when the library is
         * setup, unless the `quiet` parameter is passed to {@link setup}.
         *
         * @since 1.0.0
         * @public
         *
         * @example
         * Muxy.printInfo();
         * ┌──────────────────────────────────────────────────┐
         * | Muxy Extensions SDK                              |
         * | v1.0.0 © 2017 Muxy, Inc.                         |
         * | https://github.com/muxy/extensions-js            |
         * |                                                  |
         * | Running in sandbox environment outside of Twitch |
         * └──────────────────────────────────────────────────┘
         *
         */
        Muxy.printInfo = function () {
            var SDKInfoText = [
                'Muxy Extensions SDK',
                "v" + version + " \u00A9 " + new Date().getFullYear() + " " + author,
                repository,
                ''
            ];
            switch (Util.currentEnvironment()) {
                case Util.Environments.Production:
                    SDKInfoText.push('Running on production');
                    break;
                case Util.Environments.SandboxDev:
                    SDKInfoText.push('Running in sandbox environment outside of Twitch');
                    break;
                case Util.Environments.SandboxTwitch:
                    SDKInfoText.push('Running in sandbox environment on Twitch');
                    break;
                case Util.Environments.SandboxAdmin:
                    SDKInfoText.push('Running in sandbox environment in the Admin panel');
                    break;
                case Util.Environments.Admin:
                    SDKInfoText.push('Running in the Admin panel');
                    break;
                case Util.Environments.Testing:
                    SDKInfoText.push('Running in testing environment outside of Twitch');
                    break;
                case Util.Environments.Server:
                    SDKInfoText.push('Running on a NodeJS server');
                    break;
                default:
                    SDKInfoText.push('Could not determine execution environment.');
            }
            Util.consolePrint(SDKInfoText, { boxed: true });
        };
        /**
         * Called the first time the {@link setup} is called to start watching the auth
         * and context callbacks and updating values automatically. This method should
         * not normally be called directly.
         *
         * @since 1.0.0
         * @ignore
         *
         * @param {string} extensionID - The Twitch Extension Client ID to use for all
         * Twitch API requests.
         */
        Muxy.prototype.watchAuth = function (extensionID) {
            var _this = this;
            Ext.extensionID = extensionID;
            // Auth callback handler
            Ext.onAuthorized(this.debugOptions, function (auth) {
                if (!auth) {
                    _this.loadReject('Received invalid authorization from Twitch');
                    return;
                }
                _this.twitchClientID = auth.clientId;
                _this.messenger.extensionID = auth.clientId;
                _this.messenger.channelID = auth.channelId;
                _this.client.updateAuth(auth.token);
                var resolvePromise = function (user) {
                    _this.user = user;
                    var keys = Object.keys(_this.SDKClients);
                    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
                        var key = keys_1[_i];
                        _this.SDKClients[key].updateUser(_this.user);
                    }
                    if (_this.analytics) {
                        _this.analytics.user = _this.user;
                    }
                };
                var onFirstAuth = function () {
                    _this.client
                        .immediateGetUserInfo(extensionID)
                        .then(function (userinfo) {
                        var offset = userinfo.server_time - new Date().getTime();
                        var user = new User(auth);
                        user.ip = userinfo.ip_address;
                        user.registeredWithMuxy = userinfo.registered || false;
                        user.visualizationID = userinfo.visualization_id || '';
                        user.timeOffset = offset;
                        var keys = Object.keys(_this.SDKClients);
                        for (var _i = 0, keys_2 = keys; _i < keys_2.length; _i++) {
                            var key = keys_2[_i];
                            _this.SDKClients[key].timeOffset = offset;
                        }
                        updateUserContextSettings.call(_this);
                        _this.didLoad = true;
                        resolvePromise(user);
                        _this.loadResolve();
                    })
                        .catch(function (err) {
                        _this.loadReject(err);
                    });
                };
                if (_this.user) {
                    _this.user.updateAuth(auth);
                    resolvePromise(_this.user);
                }
                else {
                    onFirstAuth();
                }
            });
            // Context callback handler
            var updateUserContextSettings = function () {
                if (!_this.user || !_this.context) {
                    return;
                }
                // Set Video Mode
                if (_this.context.isFullScreen) {
                    _this.user.videoMode = 'fullscreen';
                }
                else if (_this.context.isTheatreMode) {
                    _this.user.videoMode = 'theatre';
                }
                else {
                    _this.user.videoMode = 'default';
                }
                _this.user.game = _this.context.game;
                _this.user.bitrate = Math.round(_this.context.bitrate || 0);
                _this.user.latency = _this.context.hlsLatencyBroadcaster;
                _this.user.buffer = _this.context.bufferSize;
                _this.user.theme = _this.context.theme;
                _this.user.volume = _this.context.volume;
                var keys = Object.keys(_this.SDKClients);
                for (var _i = 0, keys_3 = keys; _i < keys_3.length; _i++) {
                    var key = keys_3[_i];
                    _this.SDKClients[key].updateUser(_this.user);
                }
                // If buffer size goes to 0, send an analytics event that
                // this user's video is buffering.
                if (_this.context.bufferSize < 1 && _this.analytics) {
                    _this.analytics.user = _this.user;
                    _this.analytics.sendEvent('video', 'buffer', 1);
                }
            };
            Ext.onContext(function (context) {
                _this.context = context;
                if (_this.user) {
                    updateUserContextSettings.call(_this);
                }
                var keys = Object.keys(_this.SDKClients);
                for (var _i = 0, keys_4 = keys; _i < keys_4.length; _i++) {
                    var key = keys_4[_i];
                    _this.SDKClients[key].contextObservers.notify(context);
                }
            });
        };
        /**
         * Mandatory SDK setup call. Must be called once and only once to establish the Extension
         * environment and client ID to use.
         *
         * @since 1.0.0
         * @public
         *
         * @param {Object} options
         *
         * @param {string} options.clientID - The Extension Client ID as provided by Twitch.
         * @since 1.0.4
         *
         * @param {string?} options.uaString - An optional Google Analytics UA_String to send
         * events to.
         * @since 1.0.0
         *
         * @param {boolean?} options.quiet - If true, will not print library information to the
         * console. This is always true when running in production.
         * @since 1.0.3
         *
         * @throws {Error} Will throw an error if setup() has already been called, or if no
         * Extension Client ID is provided.
         *
         * @example
         * Muxy.setup({
         *   clientID: <your extension client id>
         * });
         */
        Muxy.prototype.setup = function (options) {
            if (this.setupCalled) {
                throw new Error('Muxy.setup() can only be called once.');
            }
            if (!options) {
                throw new Error('Muxy.setup() was called with invalid options');
            }
            var clientID = options.clientID || options.extensionID;
            if (!clientID) {
                throw new Error('Muxy.setup() was called without an Extension Client ID');
            }
            if (!this.debugOptions) {
                var noop = function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    /* Default to doing nothing on callback */
                };
                this.debugOptions = {
                    channelID: this.testChannelID,
                    role: this.testJWTRole,
                    onPubsubListen: noop,
                    onPubsubReceive: noop,
                    onPubsubSend: noop
                };
            }
            if (this.debugOptions.environment) {
                Util.overrideEnvironment = Util.Environments[this.debugOptions.environment];
            }
            this.client = new StateClient(this.loadPromise, this.debugOptions);
            this.messenger = DefaultMessenger(this.debugOptions);
            this.twitchClientID = clientID;
            this.cachedTwitchClient = new TwitchClient(this.twitchClientID);
            this.cachedTwitchClient.promise = this.loadPromise;
            if (options.uaString) {
                this.analytics = new Analytics(options.uaString, this.loadPromise);
            }
            if (!options.quiet) {
                Muxy.printInfo();
            }
            this.setupCalled = true;
        };
        /**
         * Setup debugging options for the application. This allows the application to fake
         * what user they are running as, the channel the extension is running on, pubsub debug
         * message frequency, and even the backend URL that the extension uses.
         *
         * This should be called before setup().
         *
         * @param {*} options - an instance of DebuggingOptions
         */
        Muxy.prototype.debug = function (options) {
            this.debugOptions = __assign({ channelID: this.testChannelID, role: this.testJWTRole }, this.debugOptions, options.options);
        };
        /**
         * Returns a twitch client to use. Can only be used after the loaded promise resolves.
         *
         * @since 1.0.0
         * @public
         *
         * @returns {TwitchClient} An instance of the TwitchClient class.
         *
         * @throws {Error} Will throw an error if called before {@link Muxy.setup}.
         */
        Muxy.prototype.TwitchClient = function () {
            /* Implemented below to deal with scoping issues. */
            return undefined;
        };
        return Muxy;
    }());
    /**
     * Global Muxy singleton object.
     * @ignore
     */
    var mxy = new Muxy();
    /** @ignore */
    mxy.TwitchClient = function NewTwitchClient() {
        if (!mxy.setupCalled) {
            throw new Error('Muxy.setup() must be called before creating a new TwitchClient instance');
        }
        return mxy.cachedTwitchClient;
    };
    mxy.DebuggingOptions = DebuggingOptions;
    // Backwards compatibility shim
    // tslint:disable-next-line
    mxy['default'] = mxy;

    return mxy;

})));
