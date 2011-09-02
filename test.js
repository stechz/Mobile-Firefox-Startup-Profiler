// TEST.JS
// By Benjamin Stover
// Magical WIP embedding test framework
//
// TODO: visuals for test errors
// TODO: allow for test pages to be html?
// TODO: output tests in handy microformat? JSON?

(function() {

var stylesheet =
  "iframe.test { opacity: 0; background: white; width: 100%; position: fixed; bottom: 0; left: 0; }" +
  "#test-results { text-align: left; white-space: nowrap; border-radius: 4px; padding: 0; margin: 0; -webkit-transition-duration: .5s; -webkit-transition-property: opacity, min-width;  -moz-transition-duration: .5s; -moz-transition-property: opacity, min-width; position: fixed; bottom: 2em; right: 2em; max-width: 0px; overflow: hidden; border-left: solid 5px #333; border-right: solid 5px #333; border-top: solid 1px #333; border-bottom: solid 1px #333; }" +
  "#test-results > div:first-child { z-index: 1; position: absolute; width: 100%; margin: auto; text-align: center; padding: 5px; }" +
  "#test-results > div.progress { opacity: .4; display: inline-block; max-width: 0px; padding: 5px 0; -webkit-transition-duration: .2s; -webkit-transition-property: background-color, min-width; -moz-transition-duration: .2s; -moz-transition-property: background-color, min-width; height: 100%; }";

// Add properties to an object.
function extend(object, properties) {
  Object.keys(properties).forEach(function(property) {
    object[property] = properties[property];
  });
}

// Dispatch custom events.
function dispatchEvent(node, name, props) {
  var ev = document.createEvent("Event");
  ev.initEvent(name, true, true);
  if (props)
    extend(ev, props);
  (node || window).dispatchEvent(ev);
}

// All functions on an object get the right this object.
function bindAll(obj) {
  Object.keys(obj).forEach(function(fnKey) {
    var fn = obj[fnKey];
    if (fn && fn.bind)
      obj[fnKey] = fn.bind(obj);
  });
}

// Collect names of test scripts to run in the iframe
function collectScriptNames() {
  var scripts = document.querySelectorAll('script[type="text/javascript"]');
  var result = [];
  for (var i = 0; i < scripts.length; i++) {
    var script = scripts[i];
    var testName = script.dataset["tests"];
    var src = script.getAttribute("src");
    var regex = /\.(\S+)$/;

    if (src)
      result.push(src);

    if (!testName && src && src.match(regex)) {
      testName = src.replace(regex, ".test.$1");
    }
    if (testName)
      result.push(testName);
  }
  return result;
}

// Adds our stylesheet to the document.
function addStylesheet() {
  if (document.getElementById("test-style"))
    return;
  var style = document.createElement("link");
  style.setAttribute("href", "data:text/css;charset=utf-8," +
    encodeURIComponent(stylesheet));
  style.setAttribute("rel", "stylesheet");
  style.setAttribute("id", "test-style");
  document.querySelector("head").appendChild(style);
}


// options is an object containing:
//   filename: name of file containing test
//   suiteName: name of test suite (if any)
//   testName: name of test
//   type: "pass", "fail", "log", "error"
//   message: basic string message
//   details: object containing objects specific to message
function defaultLog(options) {
  var type = options.type;
  if (type == "fail") {
    console.error("FAIL: " + options.message);
    console.error("Details:", options.details);
    console.error(options.stack);
  } else if (type == "error") {
    var stack = options.details.exception.stack || "";
    console.error(options.message + "\n" + stack);
  }

  parent.postMessage("test:log:" + JSON.stringify(options), "*");
}


// Define tests using this function. Anything in the object beginning with
// "test" will be considered a test function.
function test(obj) {
  bindAll(obj);

  var tests = [];
  Object.keys(obj).forEach(function(key) {
    if (key.indexOf("test") == 0) {
      tests.push({
        testName: key
      });
    }
  });

  test._objs.push({
    object: obj,
    tests: tests
  });
}

extend(test, {
  _objs: [],  // JSON object containing all tests
  _currentTest: null,
  _currentObj: null,
  _steps: [],
  _async: 0,
  _logger: defaultLog,

  _log: function(options) {
    var stack;
    try { notDefinedVariableHereWeGo(); } catch(e) { stack = e.stack; }

    this._logger({
      filename: this._currentFilename, //XXX
      suiteName: this._currentObj.object.name, //XXX rename to suite
      testName: this._currentTest.testName,
      type: options.type,
      message: options.message,
      details: options.details || {},
      stack: stack
    });
  },

  // XXX timeout and errors in setup need to not run the rest of the steps
  //     for that test.
  _timeout: function() {
    this.error("Timeout waiting for next step");
    this._timer = null;
    this._popSteps();
  },

  _popSteps: function() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }

    var step = this._steps.pop();
    var result = null;
    var args = [];
    for (var i = 0; i < arguments.length; i++)
      args[i] = arguments[i];

    for (; step; step = this._steps.pop()) {
      this._async = 0;
      try {
        result = null;
        result = step.apply(window, args);
        args = null; // Only first callback gets the parameters passed back.
      } catch(e) {
        this.error(e);
      }

      if (this._async) {
        // Waiting for _popSteps to be called later. We are finished for now.
        this._timer = setTimeout(this._timeout, this._async);
        break;
      }
    }
  },

  _run: function() {
    // Steps are in a stack, so steps will be popped in reverse order they
    // are pushed.
    var self = this;

    // Cleanup after tests.
    this.pushStep(function() {
      self._currentTest = null;
      self._currentObj = null;
      parent.postMessage("test:finish", "*");
    });

    function forEachTest(fn) {
      self._objs.reverse().forEach(function(obj) {
        obj.tests.reverse().forEach(function(test) {
          fn(obj, test);
        });
      });
    }

    // Run all the tests and their fixtures.
    forEachTest(function(obj, test) {
      var object = obj.object;
      var json = JSON.stringify({
        suiteName: object.name,
        name: test.testName
      });
      parent.postMessage("test:register:" + json, "*");

      if (object.teardown)
        self.pushStep(function() { return object.teardown(); });

      self.pushStep(function() {
        self.pushStep(function() { return object[test.testName](); });
        if (object.setup)
          object.setup();
      });

      self.pushStep(function() {
        parent.postMessage("test:runtest:" + json, "*");
        self._currentTest = test;
        self._currentObj = obj;
      });
    });

    this._popSteps();
  },

  ok: function(value, message) {
    this._log({
      type: value ? "pass" : "fail",
      message: message || "Failed ok check"
    });
  },

  is: function(actual, expected, message) {
    this._log({
      type: actual === expected ? "pass" : "fail",
      message: message || "Values not equal",
      details: { actual: actual, expected: expected }
    });
  },

  error: function(exception) {
    this._log({
      type: "error",
      message: exception.toString(),
      details: { exception: exception }
    });
  },

  click: function(element) {
    var event = document.createEvent("MouseEvents");
    event.initMouseEvent("click", true, true, window,
      0, 0, 0, 0, 0, false, false, false, false, 0, null);
    element.dispatchEvent(event);
  },

  pushStep: function(step) {
    this._steps.push(step);
  },

  async: function async(number) {
    this._async = number || 1000;
  },

  waitForEvent: function(element, name, fn) {
    this.async();
    if (fn)
      this.pushStep(fn);
    var self = this;
    element.addEventListener(name, function wait() {
      element.removeEventListener(name, wait, false);

      var args = [];
      for (var i = 0; i < arguments.length; i++)
        args[i] = arguments[i];
      self._popSteps.apply(self, args);
    }, false);
  },

  waitForTimeout: function(timeout, fn) {
    this.async();
    if (fn)
      this.pushStep(fn);
    var self = this;
    setTimeout(function() {
      var args = [];
      for (var i = 0; i < arguments.length; i++)
        args[i] = arguments[i];
      self._popSteps.apply(self, args);
    }, timeout);
  }
});

bindAll(test);

if (window.name == "test:run") {
  // We are running tests.

  window.test = test;

  addEventListener("load", function() {
    test._run();
  }, false);
} else {
  // Sit by and wait for tests to be run.

  function Handler(showUI) {
    addStylesheet();

    this.messageHandler = this.messageHandler.bind(this);

    var self = this;
    setTimeout(function() {
      var scriptNames = collectScriptNames();
      scriptNames.sort(function(a, b) {
        if (a == "test.js")
          return -1;
        else if (b == "test.js")
          return 1;
        else
          return 0;
      });

      var iframe = document.createElement("iframe");
      iframe.setAttribute("name", "test:run");
      iframe.setAttribute("class", "test");
      self.iframe = iframe;
      document.body.appendChild(iframe);

      for (var i = 0; i < scriptNames.length; i++) {
        iframe.contentDocument.write(
          '<script type="text/javascript" src="' + scriptNames[i] +
          '"><\/script>');
      }
      iframe.contentDocument.close();

      window.addEventListener("message", self.messageHandler, false);
    }, 0);

    this.json = [];
    this._showUI = showUI;
    this._numberTests = 0;

    this.initUI();
  }

  Handler.prototype = {
    messageHandler: function(ev) {
      // message will look like test:(name)[:(payload)]
      var match = ev.data.match(/^test:[a-z]+/);
      if (!match)
        return;
      // payload, if any, will occur after the match and the following colon.
      var payload = ev.data.substring(match[0].length + 1);
      var json = null;
      if (payload)
        json = JSON.parse(payload);

      switch (match[0]) {
        case "test:register":
          this.registerUI(json);
          break;
        case "test:runtest":
          this.runTestUI(json);
          break;
        case "test:log":
          this.json.push(json);
          this.updateUI(json);
          break;
        case "test:finish":
          this.finish();
          break;
      }
    },

    initUI: function() {
      if (!this._showUI)
        return;

      var old = document.getElementById("test-results");
      if (old)
        old.parentNode.removeChild(old);

      var div = document.createElement("div");
      div.setAttribute("id", "test-results");
      div.innerHTML = "<div>&nbsp;</div><div class='progress'>&nbsp;</div>";
      document.body.appendChild(div);
      setTimeout(function() { div.style.minWidth = "10em"; }, 10);

      this.div = div;
    },

    registerUI: function(json) {
      if (!this._showUI)
        return;

      this._numberTests++; 
    },

    runTestUI: function(json) {
      if (!this._showUI)
        return;

      this.testCompleteUI();

      this.currentTestFailed = false;
      var testDiv = document.createElement("div");
      testDiv.className = "progress";
      testDiv.innerHTML = "&nbsp;";
      testDiv.style.backgroundColor = "#aaa";
      this.div.appendChild(testDiv);
      this.currentTestDiv = testDiv;

      var self = this;
      setTimeout(function() {
        testDiv.style.maxWidth = "10em";
        testDiv.style.minWidth = (10 / self._numberTests) + "em";
      }, 10);
    },

    updateUI: function(json) {
      if (!this._showUI)
        return;

      var testDiv = this.currentTestDiv;
      if (json.type == "fail" || json.type == "error") {
        testDiv.style.backgroundColor = "red";
        this.currentTestFailed = true;
      }
    },

    testCompleteUI: function() {
      if (!this._showUI)
        return;

      var oldDiv = this.currentTestDiv;
      if (oldDiv && !this.currentTestFailed)
        this.currentTestDiv.style.backgroundColor = "green";
    },

    finishUI: function() {
      if (!this._showUI)
        return;

      this.testCompleteUI();

      function successFilter(item) { return item.type == "pass"; };
      function problemFilter(item) {
        return item.type == "fail" || item.type == "error";
      };

      var json = this.json;
      var problemCount = json.filter(problemFilter).length;

      var div = this.div;
      div.firstChild.innerHTML = problemCount > 0 ? problemCount + " problems" : "Success";
      setTimeout(function() {
        div.style.opacity = 0;
        setTimeout(function() {
          if (div.parentNode)
            div.parentNode.removeChild(div);
        }, 500);
      }, 2000);
    },

    finish: function() {
      window.removeEventListener("message", this.messageHandler, false);

      var iframe = this.iframe;
      iframe.parentNode.removeChild(iframe);
      dispatchEvent(document, "test:complete");

      this.finishUI();
    }
  };

  window.runTests = function(showUI) {
    new Handler();
  };

  window.addEventListener("keydown", function(ev) {
    if (ev.keyCode == 119) {
      new Handler(true);
    }
  }, false);
}

})();
