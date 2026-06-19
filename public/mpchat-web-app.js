(function (window) {
  "use strict";

  function isRecord(value) {
    return typeof value === "object" && value !== null;
  }

  function pickInitPayload(rawData) {
    if (isRecord(rawData) && "data" in rawData) {
      return rawData.data;
    }

    return rawData;
  }

  function callNative(method, params, timeout) {
    return new Promise(function (resolve, reject) {
      if (!window.JSBridge || typeof window.JSBridge.call !== "function") {
        reject(new Error("JSBridge not available"));
        return;
      }

      var resolved = false;
      var timeoutId = null;
      var waitTimeout = typeof timeout === "number" ? timeout : 10000;

      if (waitTimeout > 0) {
        timeoutId = window.setTimeout(function () {
          if (!resolved) {
            resolved = true;
            reject(new Error("JSBridge call timeout: " + method));
          }
        }, waitTimeout);
      }

      window.JSBridge.call(method, params, function (result) {
        if (!resolved) {
          resolved = true;
          if (timeoutId) {
            window.clearTimeout(timeoutId);
          }
          resolve(result);
        }
      });
    });
  }

  function callNativeNoResult(method, params) {
    if (!window.JSBridge || typeof window.JSBridge.call !== "function") {
      throw new Error("JSBridge not available");
    }

    window.JSBridge.call(method, params);
  }

  function applyInitData(webApp, rawInitData, source) {
    var initPayload = pickInitPayload(rawInitData);
    var initPayloadRecord = isRecord(initPayload) ? initPayload : {};
    var initDataUnsafe =
      initPayloadRecord.initDataUnsafe !== undefined
        ? initPayloadRecord.initDataUnsafe
        : initPayload;

    Object.assign(webApp, initPayloadRecord, {
      initData: initPayloadRecord.initData,
      initDataUnsafe: initDataUnsafe,
      initError: "",
      initSource: source,
    });

    Object.defineProperty(webApp, "__rawInitData", {
      value: rawInitData,
      enumerable: false,
      configurable: true,
      writable: true,
    });

    return webApp;
  }

  var WebApp = Object.assign({}, window.MpChat && window.MpChat.WebApp, {
    initData: "",
    initDataUnsafe: null,
    initError: "",
    initSource: "",
    call: callNativeNoResult,
  });

  function initFromInjected() {
    if (typeof window.initWebApp !== "function") {
      throw new Error("window.initWebApp is not injected");
    }

    return applyInitData(WebApp, window.initWebApp(), "injected");
  }

  function initFromJSBridge() {
    return callNative("initWebApp").then(function (rawInitData) {
      return applyInitData(WebApp, rawInitData, "jsbridge");
    });
  }

  function initWebApp() {
    try {
      return Promise.resolve(initFromInjected());
    } catch (injectedError) {
      return initFromJSBridge().catch(function (jsBridgeError) {
        var injectedMessage =
          injectedError && injectedError.message
            ? injectedError.message
            : String(injectedError);
        var jsBridgeMessage =
          jsBridgeError && jsBridgeError.message
            ? jsBridgeError.message
            : String(jsBridgeError);

        WebApp.initError =
          "initWebApp failed. injected: " +
          injectedMessage +
          "; jsbridge: " +
          jsBridgeMessage;
        WebApp.initSource = "";
        throw new Error(WebApp.initError);
      });
    }
  }

  WebApp.ready = function () {
    return WebApp.__readyPromise.then(function () {
      if (WebApp.__readyError) {
        throw WebApp.__readyError;
      }

      return WebApp;
    });
  };

  Object.defineProperty(WebApp, "ready", {
    value: WebApp.ready,
    enumerable: false,
    configurable: true,
    writable: true,
  });

  Object.defineProperty(WebApp, "__readyPromise", {
    value: initWebApp()
      .then(function () {
        WebApp.__readyError = null;
        return WebApp;
      })
      .catch(function (error) {
        WebApp.__readyError = error;
        return WebApp;
      }),
    enumerable: false,
    configurable: true,
    writable: true,
  });

  window.MpChat = Object.assign({}, window.MpChat || {}, {
    WebApp: WebApp,
    webapp: WebApp,
  });
  window.mpchat = window.MpChat;
})(window);
